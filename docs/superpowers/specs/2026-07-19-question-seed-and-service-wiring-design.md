# Design — Dataset Seed + Server-Owned Question Fetch

**Date:** 2026-07-19
**Status:** Approved (pending spec review)
**Area:** `apps/api` (question store + game transport), `packages/types` (entity)

## Goal

Make the `apps/api` server the source of question content. Two pieces:

1. **Seed** the PostgreSQL question store from the existing Family Feud Q&A
   dataset (a Google Sheet, exported as an XLSX).
2. **Wire** `QuestionService` into the live game so that when the host starts a
   game / next round / Fast Money, the **server** pulls the question(s) from
   Postgres and feeds the machine — replacing today's client-supplied
   `Question` payloads.

The XState machine's event/context shape does **not** change: a question is
still a plain `Question` object riding on `HOST_START_GAME` /
`HOST_NEXT_ROUND` / `HOST_START_FAST_MONEY`. Only the *source* of that object
moves from the client to the server.

## Background — current state

- The store layer exists (PR #5): `QuestionEntity` / `AnswerEntity` +
  `toQuestion` in `@family-feud/types/entities`, the `InitQuestions` migration,
  `buildDataSourceOptions` (TypeORM, `synchronize:false`, `migrationsRun:true`),
  and a read-only `QuestionService` with `getById` / `getRandom`.
- **Nothing seeds the store** — there is no dataset file in the repo and no seed
  script.
- The host client currently emits the three question-bearing events **with the
  `Question` content inline**. The socket actor (`game.socket.actor.ts`), invoked
  at the machine root, forwards every allow-listed `HOST_*` event straight to the
  machine via `sendBack({ ...data, type })`. It is the host-authorization edge
  (only sockets whose handshake `role === 'host'` may emit `HOST_*`).

## Dataset shape (verified against the source workbook)

The XLSX has one sheet per answer count plus Fast Money and unusable extras:

| Sheet(s)          | ~Rows | Layout                                             | Import? |
| ----------------- | ----- | -------------------------------------------------- | ------- |
| `3`–`7 Answers`   | ~3,900 | `Question`, then `Answer N` / `#N` pairs (points)  | ✅ `standard` |
| `Fast Money`      | ~800  | `Question`, 2 × (`Answer N` / `#N`)                | ✅ `fast_money` |
| `No Points 3`–`7` | ~1,850 | Answers but **no point values**                    | ❌ skip (points NOT NULL) |
| `Broken Fast Money` | ~795 | Only one answer per row — malformed                | ❌ skip |

`#N` is the survey point value (per question they sum to ~100). Imported total:
~4,700 questions, all with real points.

## Part 1 — Seed

### 1a. Schema: reclassify by `kind`

The game must distinguish a **standard-round** question from a **Fast Money**
question (different game phase). The existing `category` / `difficulty` columns
(added by `InitQuestions` in PR #5) don't capture this, and — now that the source
dataset is known to carry neither — nothing writes or reads them. So the schema
is reclassified: drop both dead columns and add a dedicated `kind` discriminator.

- **New migration** `apps/api/src/migrations/<timestamp>-ReclassifyQuestions.ts`
  (append-only — `InitQuestions` is left untouched; this migration edits the
  table forward):
  ```sql
  ALTER TABLE "questions" ADD COLUMN "kind" text NOT NULL DEFAULT 'standard';
  ALTER TABLE "questions" DROP COLUMN "category";
  ALTER TABLE "questions" DROP COLUMN "difficulty";
  ```
  The `DEFAULT 'standard'` keeps `ADD COLUMN NOT NULL` safe even against an
  already-created (empty) table; the seed always sets the real value. `down`
  reverses it (re-add the two nullable columns, drop `kind`).
- **`QuestionEntity`** (in `packages/types/src/question.entity.ts`) drops the
  `category` and `difficulty` fields and gains:
  ```ts
  @Column('text', { default: 'standard' })
  kind!: 'standard' | 'fast_money';
  ```
- The game distinguishes question type purely by `kind`; answer count is already
  derivable from the answers array. `toQuestion` is unaffected (it only maps
  `prompt` + ordered answers).

### 1b. Provenance parser (one-time, kept in-repo)

`apps/api/scripts/parse-dataset.ts` — a standalone dev script that:

- downloads the workbook from the documented Drive URL (or accepts a local path
  arg),
- parses the `3`–`7 Answers` sheets → `kind: 'standard'`,
- parses `Fast Money` → `kind: 'fast_money'`,
- skips `No Points *` and `Broken Fast Money`,
- for each row: `prompt` from column A; answers from each non-empty
  `Answer N` / `#N` pair, `rank` = 0-based position, `points` = `#N`,
- writes `apps/api/src/seed/questions.seed.json`.

The **JSON is the committed source of truth**; the parser exists only to
regenerate it. The row→question transform is factored into a pure function so it
can be unit-tested without the workbook.

Fixture shape (array of):
```jsonc
{
  "kind": "standard",
  "prompt": "Name the most used piece of furniture in a house.",
  "answers": [
    { "text": "Couch", "points": 55, "rank": 0 },
    { "text": "Bed", "points": 23, "rank": 1 },
    { "text": "Arm Chair", "points": 15, "rank": 2 }
  ]
}
```

### 1c. Seed runner

`apps/api/src/seed.ts` + `"seed"` npm script (run via `typeorm-ts-node-commonjs`
/ ts-node, reusing the exported `DataSource` from `data-source.ts`):

- opens the DataSource (which runs pending migrations first),
- **truncate-then-bulk-insert**: `TRUNCATE questions, answers RESTART IDENTITY
  CASCADE`, then insert questions and their answers from the JSON. Idempotent —
  a clean reload each run is correct for read-only content and keeps the script
  trivial. Inserts are chunked to stay within parameter limits.
- logs counts and exits.

Not run automatically on boot — it is an explicit operator step (`npm run seed`).

## Part 2 — Server-owned fetch (socket-actor enriches)

The socket actor is already the host-authorization edge, so the async DB fetch
lives there. The machine and gateway are untouched.

### 2a. A framework-agnostic provider

Define (in `game/`, e.g. `game.questions.ts`) a minimal interface so the socket
actor stays free of NestJS coupling. Because the machine's `Question` shape
carries no id, the provider returns a small `PickedQuestion` wrapper so the
caller can record which rows it has served (for no-repeat tracking, §2b), and it
accepts an `excludeIds` list so already-served rows are filtered out at query
time:

```ts
export interface PickedQuestion {
  id: string;        // DB row id — used only for no-repeat exclusion, never sent to the machine
  question: Question;
}

export interface QuestionProvider {
  getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null>;
  getRandomFastMoney(count: number, excludeIds: string[]): Promise<PickedQuestion[]>;
}
```

`QuestionService` implements it structurally (see 2d). `SocketActorInput` gains
`questions: QuestionProvider`.

### 2b. Socket actor: async handlers for the three events

`HOST_START_GAME`, `HOST_NEXT_ROUND`, `HOST_START_FAST_MONEY` are **removed from
the generic pass-through list** and given dedicated async handlers (still only
registered for `role === 'host'` sockets, reusing the existing auth gate). The
remaining `HOST_*` events keep the current synchronous `sendBack({ ...data,
type })` pass-through.

**No-repeat tracking.** The socket actor is invoked once per room and lives for
the whole game, so a `Set<string>` of served row ids held in its closure is
naturally scoped to a single game (a new room/game starts with an empty set;
teardown discards it). Standard and Fast Money draw from disjoint `kind` pools,
so one shared set is correct. Each handler passes the current ids as
`excludeIds`, then records the ids it just served:

```ts
const servedIds = new Set<string>();

socket.on('HOST_START_GAME', async () => {
  const picked = await questions.getRandomStandard([...servedIds]);
  if (!picked) { socket.emit('ERROR', { message: 'No questions available' }); return; }
  servedIds.add(picked.id);
  sendBack({ type: 'HOST_START_GAME', question: picked.question });
});
// HOST_NEXT_ROUND: identical, getRandomStandard([...servedIds])
// HOST_START_FAST_MONEY:
//   const picks = await questions.getRandomFastMoney(FAST_MONEY_QUESTION_COUNT /* 5 */, [...servedIds])
//   if (picks.length < 5) → ERROR; else record every id, sendBack({ type, questions: picks.map(p => p.question) })
```

- Client-supplied content on these events is **ignored** — the server always
  sources it. The inbound wire contract becomes "emit the event with no payload".
- On a failed/empty fetch (store empty, or the pool is exhausted by exclusions):
  emit `ERROR` to the requesting socket, do **not** `sendBack`; the machine stays
  put. Errors are logged.
- The machine's guard (`canStartGame`) still runs when it receives the event; a
  rejected start merely wastes one fetch (rare, negligible against ~4,700 rows).
  A wasted fetch still records its id — acceptable, since the pool is enormous.

### 2c. Threading the provider through DI

- `GameModule` imports `QuestionModule` (already exports `QuestionService`).
- `GameService` constructor-injects `QuestionService` and passes it into
  `createGameMachine({ io, roomId, questions })`.
- `createGameMachine` widens its input to `SocketActorInput` (now incl.
  `questions`) and forwards it to the invoked socket actor. No state/action/guard
  changes.

### 2d. QuestionService additions

- `getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null>` —
  random row where `kind = 'standard'` and `id` not in `excludeIds` (mirrors
  existing `getRandom`: random id, then re-fetch with answers, then
  `toQuestion`), returned as `{ id, question }`.
- `getRandomFastMoney(count, excludeIds): Promise<PickedQuestion[]>` — up to
  `count` random rows where `kind = 'fast_money'` and `id` not in `excludeIds`,
  each mapped to `{ id, question }`.
- The exclusion is applied with a query-builder `andWhere('id NOT IN (:...ids)')`
  added **only when `excludeIds` is non-empty** (an empty `NOT IN ()` is invalid
  SQL). `RANDOM()` ordering with `LIMIT count` yields distinct rows within a Fast
  Money batch.
- Existing `getById` unchanged. `getRandom` retained (now kind-agnostic) but
  unused by the wiring.

## Testing

- **Parser transform** — unit-test the pure row→question function: correct
  rank/points ordering, skips empty answer pairs, tags `kind`/`category`.
- **QuestionService** — extend `question.service.spec.ts` (mock repo /
  query-builder) for `getRandomStandard` (filters `kind='standard'`, applies
  `NOT IN` only when `excludeIds` non-empty, returns `{ id, question }`) and
  `getRandomFastMoney` (filters `kind='fast_money'`, returns N mapped picks,
  empty store → `[]`).
- **Socket actor** — extend `game.socket.actor.spec.ts` with a mock
  `QuestionProvider` in input: host `HOST_START_GAME` → provider called →
  `sendBack` carries the fetched question; provider returns `null` → `ERROR`
  emitted, no `sendBack`; **a second fetch passes the first pick's id in
  `excludeIds`** (no-repeat); `HOST_START_FAST_MONEY` → `getRandomFastMoney(5,
  …)`; non-host socket cannot trigger a fetch.
- **Seed runner / migration** — DB integration is a manual step (`npm run seed`
  against a local Postgres); no automated DB test (no test database is
  configured). The migration is exercised via `migrationsRun` on that manual run.

## Out of scope

- Client (`apps/web`) changes — the host UI will drop the inline `Question`
  payload later; this spec only changes the server contract.
- Persisting served-question history — no-repeat tracking is in-memory per game
  and resets when the room ends.
- Importing the No-Points / Broken sheets.
- Any question metadata beyond `kind` (no `category` / `difficulty` in v1).

## Files touched

**New:** `apps/api/scripts/parse-dataset.ts`,
`apps/api/src/seed/questions.seed.json`, `apps/api/src/seed.ts`,
`apps/api/src/migrations/<timestamp>-ReclassifyQuestions.ts`,
`apps/api/src/game/game.questions.ts` (provider interface).

**Modified:** `packages/types/src/question.entity.ts` (drop `category` /
`difficulty`, add `kind`),
`apps/api/src/question/question.service.ts` (+2 methods),
`apps/api/src/question/question.service.spec.ts` (fixture drops the two columns),
`apps/api/src/game/game.socket.actor.ts` (async handlers + input),
`apps/api/src/game/game.machine.ts` (input type),
`apps/api/src/game/game.service.ts` (inject + pass provider),
`apps/api/src/game/game.module.ts` (import QuestionModule),
`apps/api/package.json` (`seed` script; xlsx parser dev-dep for the parser),
`apps/api/src/game/game.socket.actor.spec.ts` (mock provider + no-repeat), plus a
new unit test for the parser transform.
