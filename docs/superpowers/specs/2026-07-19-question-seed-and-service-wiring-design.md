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

### 1a. Schema: add a `kind` discriminator

The game must distinguish a **standard-round** question from a **Fast Money**
question (different game phase). `category` / `difficulty` are generic metadata
that don't capture this, so add a dedicated column.

- **New migration** `apps/api/src/migrations/<timestamp>-AddQuestionKind.ts`
  (append-only — the existing `InitQuestions` migration is left untouched):
  ```sql
  ALTER TABLE "questions"
    ADD COLUMN "kind" text NOT NULL DEFAULT 'standard';
  ```
  The `DEFAULT 'standard'` keeps the `ADD COLUMN NOT NULL` safe even against an
  already-created (empty) table; the seed always sets the real value. `down`
  drops the column.
- **`QuestionEntity`** (in `packages/types/src/question.entity.ts`) gains:
  ```ts
  @Column('text', { default: 'standard' })
  kind!: 'standard' | 'fast_money';
  ```
- **`category`** is repurposed at seed time to hold the source answer-count
  bucket (`"3"`…`"7"`) for standard questions, `null` for Fast Money. This is
  cheap and lets the host later filter a round by answer count. `difficulty`
  stays `null` (the dataset has none). `toQuestion` is unaffected (it only maps
  `prompt` + ordered answers).

### 1b. Provenance parser (one-time, kept in-repo)

`apps/api/scripts/parse-dataset.ts` — a standalone dev script that:

- downloads the workbook from the documented Drive URL (or accepts a local path
  arg),
- parses the `3`–`7 Answers` sheets → `kind: 'standard'`, `category: "<n>"`,
- parses `Fast Money` → `kind: 'fast_money'`, `category: null`,
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
  "category": "3",
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
actor stays free of NestJS coupling:

```ts
export interface QuestionProvider {
  getRandomStandard(): Promise<Question | null>;
  getRandomFastMoney(count: number): Promise<Question[]>;
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

```ts
socket.on('HOST_START_GAME', async () => {
  const question = await questions.getRandomStandard();
  if (!question) { socket.emit('ERROR', { message: 'No questions available' }); return; }
  sendBack({ type: 'HOST_START_GAME', question });
});
// HOST_NEXT_ROUND: identical, getRandomStandard()
// HOST_START_FAST_MONEY: const qs = await questions.getRandomFastMoney(FAST_MONEY_QUESTION_COUNT /* 5 */)
//   if (qs.length < 5) → ERROR; else sendBack({ type, questions: qs })
```

- Client-supplied content on these events is **ignored** — the server always
  sources it. The inbound wire contract becomes "emit the event with no payload".
- On a failed/empty fetch: emit `ERROR` to the requesting socket, do **not**
  `sendBack`; the machine stays put. Errors are logged.
- The machine's guard (`canStartGame`) still runs when it receives the event; a
  rejected start merely wastes one fetch (rare, negligible against ~4,700 rows).
- Repeats within a game are not tracked in v1 (probability is tiny at this
  dataset size). Noted as a possible later refinement, deliberately out of scope.

### 2c. Threading the provider through DI

- `GameModule` imports `QuestionModule` (already exports `QuestionService`).
- `GameService` constructor-injects `QuestionService` and passes it into
  `createGameMachine({ io, roomId, questions })`.
- `createGameMachine` widens its input to `SocketActorInput` (now incl.
  `questions`) and forwards it to the invoked socket actor. No state/action/guard
  changes.

### 2d. QuestionService additions

- `getRandomStandard(): Promise<Question | null>` — random row where
  `kind = 'standard'` (mirrors existing `getRandom`: random id, then re-fetch
  with answers, then `toQuestion`).
- `getRandomFastMoney(count: number): Promise<Question[]>` — up to `count` random
  rows where `kind = 'fast_money'`, each mapped via `toQuestion`.
- Existing `getById` unchanged. `getRandom` retained (now kind-agnostic) but
  unused by the wiring.

## Testing

- **Parser transform** — unit-test the pure row→question function: correct
  rank/points ordering, skips empty answer pairs, tags `kind`/`category`.
- **QuestionService** — extend `question.service.spec.ts` (mock repo /
  query-builder) for `getRandomStandard` (filters `kind='standard'`) and
  `getRandomFastMoney` (filters `kind='fast_money'`, returns N mapped questions,
  empty store → `[]`).
- **Socket actor** — extend `game.socket.actor.spec.ts` with a mock
  `QuestionProvider` in input: host `HOST_START_GAME` → provider called →
  `sendBack` carries the fetched question; provider returns `null` → `ERROR`
  emitted, no `sendBack`; `HOST_START_FAST_MONEY` → `getRandomFastMoney(5)`;
  non-host socket cannot trigger a fetch.
- **Seed runner / migration** — DB integration is a manual step (`npm run seed`
  against a local Postgres); no automated DB test (no test database is
  configured). The migration is exercised via `migrationsRun` on that manual run.

## Out of scope

- Client (`apps/web`) changes — the host UI will drop the inline `Question`
  payload later; this spec only changes the server contract.
- No-repeat-within-a-game tracking.
- Importing the No-Points / Broken sheets.
- Any question metadata beyond `kind` + answer-count `category`.

## Files touched

**New:** `apps/api/scripts/parse-dataset.ts`,
`apps/api/src/seed/questions.seed.json`, `apps/api/src/seed.ts`,
`apps/api/src/migrations/<timestamp>-AddQuestionKind.ts`,
`apps/api/src/game/game.questions.ts` (provider interface).

**Modified:** `packages/types/src/question.entity.ts` (kind column),
`apps/api/src/question/question.service.ts` (+2 methods),
`apps/api/src/game/game.socket.actor.ts` (async handlers + input),
`apps/api/src/game/game.machine.ts` (input type),
`apps/api/src/game/game.service.ts` (inject + pass provider),
`apps/api/src/game/game.module.ts` (import QuestionModule),
`apps/api/package.json` (`seed` script; xlsx parser dev-dep for the parser),
plus the three `*.spec.ts` above.
