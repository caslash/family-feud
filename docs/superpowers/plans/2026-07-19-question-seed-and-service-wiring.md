# Question Seed + Server-Owned Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed the PostgreSQL question store from the Family Feud dataset and make the `apps/api` server pull questions from it (feeding the game machine) instead of trusting client-supplied `Question` payloads.

**Architecture:** A committed JSON fixture (parsed once from the source XLSX) is loaded into Postgres by a truncate-then-reload seed runner. At runtime the socket actor — already the host-authorization edge — gains async handlers for the three question-bearing events that fetch from a `QuestionProvider` (implemented by `QuestionService`), enrich the event with the fetched `Question`(s), and `sendBack` into the machine. A per-game served-id set in the actor closure prevents repeats. The XState machine, its events, and the gateway are untouched.

**Tech Stack:** NestJS 11, TypeORM 0.3 (Postgres), XState v5, Socket.io, Vitest (globals on), `exceljs` (dev-only, for the one-time parser).

## Global Constraints

- Package manager is **npm workspaces**; run all installs from the repo root (never inside `apps/*`).
- Tests: **Vitest with globals enabled** — do NOT import `describe`/`it`/`expect`/`vi`. Specs are co-located `*.spec.ts`.
- Imports within `apps/api/src/game/` are **relative** (`./game.types`) — there is no `@/` alias.
- Cross-package imports go through the entry point: `@family-feud/types` and `@family-feud/types/entities`. Never reach into another workspace's `src/`.
- TypeORM: `synchronize: false` always; schema changes happen only through migrations (append-only — never edit `InitQuestions`).
- **Game state is never persisted.** The only DB use is the read-only question store. No-repeat tracking is in-memory per game.
- The machine's `GameEvent` union does NOT change: `HOST_START_GAME` / `HOST_NEXT_ROUND` still carry `question: Question`; `HOST_START_FAST_MONEY` still carries `questions: Question[]`.
- Fast Money draws exactly **5** questions.
- Run checks from repo root: `npm run typecheck`, `npm run test`, `npm run lint`. To run a single api spec: `npm run test -w @family-feud/api -- <path> -t "<name>"`.
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Reclassify the schema (drop `category`/`difficulty`, add `kind`)

**Files:**
- Create: `apps/api/src/migrations/1721000000000-ReclassifyQuestions.ts`
- Modify: `packages/types/src/question.entity.ts` (remove `category` + `difficulty` fields; add `kind`)
- Modify: `apps/api/src/question/question.service.spec.ts` (fixture: drop the two columns, add `kind`)

**Interfaces:**
- Produces: `QuestionEntity` now has `kind: 'standard' | 'fast_money'` (text column, default `'standard'`) and no longer has `category`/`difficulty`. `toQuestion(entity)` is unchanged.

- [ ] **Step 1: Edit the entity — remove the dead columns, add `kind`**

In `packages/types/src/question.entity.ts`, delete these two blocks from `QuestionEntity`:

```ts
  @Column('text', { nullable: true })
  category!: string | null;

  @Column('text', { nullable: true })
  difficulty!: string | null;
```

and in their place add:

```ts
  @Column('text', { default: 'standard' })
  kind!: 'standard' | 'fast_money';
```

(Leave `id`, `prompt`, the `answers` relation, `AnswerEntity`, and `toQuestion` exactly as they are — `toQuestion` maps only `prompt` + ordered answers.)

- [ ] **Step 2: Write the migration**

Create `apps/api/src/migrations/1721000000000-ReclassifyQuestions.ts`:

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reclassifies `questions`: drops the unused `category`/`difficulty` metadata
 * columns (the source dataset carries neither) and adds a `kind` discriminator
 * separating standard-round questions from Fast Money questions.
 *
 * Append-only: `InitQuestions` is left untouched; this migration edits the
 * table forward. `DEFAULT 'standard'` keeps `ADD COLUMN NOT NULL` safe on an
 * already-created (empty) table; the seed always sets the real value.
 */
export class ReclassifyQuestions1721000000000 implements MigrationInterface {
  name = 'ReclassifyQuestions1721000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "kind" text NOT NULL DEFAULT 'standard'`,
    );
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "category"`);
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "difficulty"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "difficulty" text`,
    );
    await queryRunner.query(`ALTER TABLE "questions" ADD COLUMN "category" text`);
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "kind"`);
  }
}
```

- [ ] **Step 3: Fix the service-spec fixture**

In `apps/api/src/question/question.service.spec.ts`, in `buildEntity()`, replace:

```ts
  return {
    id: 'q1',
    prompt: 'Name a fruit',
    category: null,
    difficulty: null,
    answers,
  } as QuestionEntity;
```

with:

```ts
  return {
    id: 'q1',
    prompt: 'Name a fruit',
    kind: 'standard',
    answers,
  } as QuestionEntity;
```

- [ ] **Step 4: Typecheck and run the question spec**

Run: `npm run typecheck && npm run test -w @family-feud/api -- src/question/question.service.spec.ts`
Expected: typecheck passes; existing `QuestionService` tests still PASS (behavior unchanged — `toQuestion` never read the dropped columns).

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/question.entity.ts apps/api/src/migrations/1721000000000-ReclassifyQuestions.ts apps/api/src/question/question.service.spec.ts
git commit -m "$(printf 'Reclassify questions schema: drop category/difficulty, add kind\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Dataset parser + committed seed JSON

**Files:**
- Create: `apps/api/scripts/parse-dataset.ts`
- Create: `apps/api/scripts/parse-dataset.spec.ts`
- Create (generated, committed): `apps/api/src/seed/questions.seed.json`
- Modify: `apps/api/package.json` (add `exceljs` to `devDependencies`)

**Interfaces:**
- Produces: an exported pure function `parseRow(cells: (string | number | undefined)[], kind: SeedKind): SeedQuestion | null` and the `SeedQuestion` shape consumed by Task 3's seed runner:
  ```ts
  type SeedKind = 'standard' | 'fast_money';
  interface SeedAnswer { text: string; points: number; rank: number }
  interface SeedQuestion { kind: SeedKind; prompt: string; answers: SeedAnswer[] }
  ```
- Produces: `apps/api/src/seed/questions.seed.json` — a JSON array of `SeedQuestion`.

- [ ] **Step 1: Add the dev dependency**

From the repo root:

```bash
npm install -D -w @family-feud/api exceljs
```

Expected: `exceljs` appears under `devDependencies` in `apps/api/package.json`.

- [ ] **Step 2: Write the failing test for the pure transform**

Create `apps/api/scripts/parse-dataset.spec.ts`:

```ts
import { parseRow } from './parse-dataset';

// exceljs row.values is 1-indexed (index 0 is undefined); column A = [1].
describe('parseRow', () => {
  it('maps a standard row to prompt + rank-ordered answers with points', () => {
    const cells = [undefined, 'Name a fruit', 'Apple', 40, 'Banana', 20, 'Pear', 15];
    expect(parseRow(cells, 'standard')).toEqual({
      kind: 'standard',
      prompt: 'Name a fruit',
      answers: [
        { text: 'Apple', points: 40, rank: 0 },
        { text: 'Banana', points: 20, rank: 1 },
        { text: 'Pear', points: 15, rank: 2 },
      ],
    });
  });

  it('stops at the first empty answer pair and trims prompt whitespace', () => {
    const cells = [undefined, '  Name a fruit  ', 'Apple', 40, '', ''];
    expect(parseRow(cells, 'standard')).toEqual({
      kind: 'standard',
      prompt: 'Name a fruit',
      answers: [{ text: 'Apple', points: 40, rank: 0 }],
    });
  });

  it('coerces numeric answer text to a string (numbers-as-answers rows)', () => {
    const cells = [undefined, 'Name a lucky number', 7, 68, 13, 26];
    expect(parseRow(cells, 'fast_money')).toEqual({
      kind: 'fast_money',
      prompt: 'Name a lucky number',
      answers: [
        { text: '7', points: 68, rank: 0 },
        { text: '13', points: 26, rank: 1 },
      ],
    });
  });

  it('returns null for a header row (no numeric points)', () => {
    const cells = [undefined, 'Question', 'Answer 1', '#1', 'Answer 2', '#2'];
    expect(parseRow(cells, 'standard')).toBeNull();
  });

  it('returns null when the prompt is empty', () => {
    expect(parseRow([undefined, '', 'Apple', 40], 'standard')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -w @family-feud/api -- scripts/parse-dataset.spec.ts`
Expected: FAIL — `parse-dataset` has no export `parseRow` (module not found / not a function).

- [ ] **Step 4: Write the parser**

Create `apps/api/scripts/parse-dataset.ts`:

```ts
/**
 * One-time provenance script: turns the Family Feud source workbook into the
 * committed `apps/api/src/seed/questions.seed.json` fixture. The JSON is the
 * source of truth for the seed runner; this script only regenerates it.
 *
 * Usage (from apps/api):  ts-node scripts/parse-dataset.ts [path/to/workbook.xlsx]
 * With no path arg it downloads the workbook from the documented Drive URL.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';

export type SeedKind = 'standard' | 'fast_money';
export interface SeedAnswer {
  text: string;
  points: number;
  rank: number;
}
export interface SeedQuestion {
  kind: SeedKind;
  prompt: string;
  answers: SeedAnswer[];
}

const DRIVE_URL =
  'https://drive.google.com/uc?export=download&id=0Bzs-xvR-5hQ3WktpWVA2RmROY1U';

// Sheets to import and the kind each maps to. Everything else (No Points *,
// Broken Fast Money) is intentionally skipped.
const SHEETS: { name: string; kind: SeedKind }[] = [
  { name: '3 Answers', kind: 'standard' },
  { name: '4 Answers', kind: 'standard' },
  { name: '5 Answers', kind: 'standard' },
  { name: '6 Answers', kind: 'standard' },
  { name: '7 Answers', kind: 'standard' },
  { name: 'Fast Money', kind: 'fast_money' },
];

const OUT = join(__dirname, '..', 'src', 'seed', 'questions.seed.json');

/**
 * Maps one worksheet row (exceljs 1-indexed `row.values`) to a SeedQuestion.
 * Column A (index 1) is the prompt; columns then alternate answer text / points.
 * Returns null for header rows, empty prompts, or rows with no scored answers.
 */
export function parseRow(
  cells: (string | number | undefined)[],
  kind: SeedKind,
): SeedQuestion | null {
  const prompt = String(cells[1] ?? '').trim();
  if (!prompt || prompt === 'Question') return null;

  const answers: SeedAnswer[] = [];
  for (let i = 2; i < cells.length; i += 2) {
    const text = String(cells[i] ?? '').trim();
    const points = Number(cells[i + 1]);
    if (!text || !Number.isFinite(points)) break;
    answers.push({ text, points, rank: answers.length });
  }

  if (answers.length === 0) return null;
  return { kind, prompt, answers };
}

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const path = join(tmpdir(), 'family-feud-dataset.xlsx');
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

async function main(): Promise<void> {
  const src = process.argv[2] ?? (await download(DRIVE_URL));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);

  const out: SeedQuestion[] = [];
  for (const { name, kind } of SHEETS) {
    const sheet = wb.getWorksheet(name);
    if (!sheet) throw new Error(`Missing sheet: ${name}`);
    sheet.eachRow((row) => {
      const parsed = parseRow(row.values as (string | number | undefined)[], kind);
      if (parsed) out.push(parsed);
    });
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  const standard = out.filter((q) => q.kind === 'standard').length;
  const fastMoney = out.filter((q) => q.kind === 'fast_money').length;
  console.log(
    `Wrote ${out.length} questions (${standard} standard, ${fastMoney} fast_money) to ${OUT}`,
  );
}

// Only run when invoked directly, so the spec can import parseRow cleanly.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -w @family-feud/api -- scripts/parse-dataset.spec.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 6: Generate the committed fixture**

From `apps/api`:

```bash
npx ts-node scripts/parse-dataset.ts
```

Expected: prints `Wrote <N> questions (<S> standard, <F> fast_money) to .../questions.seed.json` with N > 4000, S ~3900, F ~800, and creates `apps/api/src/seed/questions.seed.json`. Spot-check the file: the first record has `kind`, a non-empty `prompt`, and an `answers` array whose `rank` values start at 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json package-lock.json apps/api/scripts/parse-dataset.ts apps/api/scripts/parse-dataset.spec.ts apps/api/src/seed/questions.seed.json
git commit -m "$(printf 'Add dataset parser and committed question seed fixture\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Seed runner

**Files:**
- Create: `apps/api/src/seed.ts`
- Modify: `apps/api/package.json` (add `"seed"` script)

**Interfaces:**
- Consumes: `apps/api/src/seed/questions.seed.json` (array of `SeedQuestion` from Task 2), `QuestionEntity` (with `kind`, from Task 1), and the default-exported `DataSource` from `apps/api/src/data-source.ts`.
- Produces: `npm run seed` — a truncate-then-reload of `questions`/`answers`.

- [ ] **Step 1: Write the seed runner**

Create `apps/api/src/seed.ts`:

```ts
/**
 * Loads the committed question fixture into Postgres. Truncate-then-reload:
 * the store is read-only game content, so a clean reload each run is correct
 * and keeps this idempotent. Run with `npm run seed` (needs a reachable DB and
 * the DB_* env vars — see data-source.ts / .env).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QuestionEntity } from '@family-feud/types/entities';
import AppDataSource from './data-source';

interface SeedAnswer { text: string; points: number; rank: number }
interface SeedQuestion {
  kind: 'standard' | 'fast_money';
  prompt: string;
  answers: SeedAnswer[];
}

const CHUNK = 500;

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

async function main(): Promise<void> {
  const raw = readFileSync(join(__dirname, 'seed', 'questions.seed.json'), 'utf8');
  const seed = JSON.parse(raw) as SeedQuestion[];

  const ds = await AppDataSource.initialize(); // runs pending migrations first
  try {
    // Order-independent thanks to CASCADE; clears both tables.
    await ds.query('TRUNCATE "answers", "questions" CASCADE');

    const repo = ds.getRepository(QuestionEntity);
    let inserted = 0;
    for (const batch of chunks(seed, CHUNK)) {
      const entities = batch.map((q) =>
        repo.create({
          kind: q.kind,
          prompt: q.prompt,
          answers: q.answers.map((a) => ({
            text: a.text,
            points: a.points,
            rank: a.rank,
          })),
        }),
      );
      await repo.save(entities); // cascades to answers
      inserted += entities.length;
    }
    console.log(`Seeded ${inserted} questions.`);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `apps/api/package.json`, add to `scripts` (next to the `migration:*` entries):

```json
    "seed": "ts-node src/seed.ts",
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the runner and its JSON import compile; `repo.create` accepts the nested `answers` because `QuestionEntity.answers` has `cascade: true`).

- [ ] **Step 4: Manual DB verification (requires a local Postgres + `.env`)**

> No automated DB test — the api has no test database configured. Verify manually if a Postgres is available; otherwise the seed is exercised by whoever runs the app.

With `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME` set in `apps/api/.env` and the DB reachable, from `apps/api`:

```bash
npm run seed
```

Expected: migrations run (including `ReclassifyQuestions`), then `Seeded <N> questions.` with N matching Task 2's count. A follow-up `SELECT count(*) FROM questions;` returns N, and `SELECT count(*) FROM questions WHERE kind='fast_money';` is ~800.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/seed.ts apps/api/package.json
git commit -m "$(printf 'Add truncate-then-reload question seed runner\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: `QuestionService` fetch-by-kind methods (with exclusion)

**Files:**
- Modify: `apps/api/src/question/question.service.ts`
- Modify: `apps/api/src/question/question.service.spec.ts`

**Interfaces:**
- Consumes: `QuestionEntity` (`kind` column), `toQuestion`, `Question` from `@family-feud/types`.
- Produces (relied on by Tasks 5 & 6):
  ```ts
  interface PickedQuestion { id: string; question: Question }
  getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null>
  getRandomFastMoney(count: number, excludeIds: string[]): Promise<PickedQuestion[]>
  ```
  These make `QuestionService` structurally a `QuestionProvider` (Task 5).

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/question/question.service.spec.ts`, add a shared query-builder factory near the top of the file (after the existing imports) and two new `describe` blocks. First, add this helper above `describe('QuestionService', ...)`:

```ts
/** A chainable createQueryBuilder stub whose getMany/getOne are controllable. */
function makeQb(result: unknown) {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'limit']) {
    qb[m] = vi.fn().mockReturnThis();
  }
  qb.getMany = vi.fn().mockResolvedValue(result);
  qb.getOne = vi.fn().mockResolvedValue(result);
  return qb;
}
```

Then add these blocks inside `describe('QuestionService', ...)`:

```ts
  describe('getRandomStandard', () => {
    it('filters by kind=standard and returns { id, question }', async () => {
      const qb = makeQb({ id: 'q1' });
      createQueryBuilder.mockReturnValue(qb);
      findOne.mockResolvedValue(buildEntity());

      const picked = await service.getRandomStandard([]);

      expect(qb.where).toHaveBeenCalledWith('question.kind = :kind', {
        kind: 'standard',
      });
      expect(qb.andWhere).not.toHaveBeenCalled(); // empty excludeIds → no NOT IN
      expect(picked).toEqual({
        id: 'q1',
        question: {
          prompt: 'Name a fruit',
          answers: [
            { text: 'First', points: 40, revealed: false },
            { text: 'Second', points: 20, revealed: false },
          ],
        },
      });
    });

    it('excludes already-served ids when the list is non-empty', async () => {
      const qb = makeQb({ id: 'q2' });
      createQueryBuilder.mockReturnValue(qb);
      findOne.mockResolvedValue(buildEntity());

      await service.getRandomStandard(['q1']);

      expect(qb.andWhere).toHaveBeenCalledWith('question.id NOT IN (:...ids)', {
        ids: ['q1'],
      });
    });

    it('returns null when the pool is empty', async () => {
      createQueryBuilder.mockReturnValue(makeQb(null));

      expect(await service.getRandomStandard([])).toBeNull();
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('getRandomFastMoney', () => {
    it('filters by kind=fast_money, honors count, and maps each pick', async () => {
      const qb = makeQb([{ id: 'q1' }, { id: 'q2' }]);
      createQueryBuilder.mockReturnValue(qb);
      findOne.mockResolvedValue(buildEntity());

      const picks = await service.getRandomFastMoney(5, ['old']);

      expect(qb.where).toHaveBeenCalledWith('question.kind = :kind', {
        kind: 'fast_money',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('question.id NOT IN (:...ids)', {
        ids: ['old'],
      });
      expect(qb.limit).toHaveBeenCalledWith(5);
      expect(picks).toHaveLength(2);
      expect(picks[0]).toEqual({ id: 'q1', question: expect.any(Object) });
    });

    it('returns [] when the pool is empty', async () => {
      createQueryBuilder.mockReturnValue(makeQb([]));

      expect(await service.getRandomFastMoney(5, [])).toEqual([]);
      expect(findOne).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @family-feud/api -- src/question/question.service.spec.ts`
Expected: FAIL — `service.getRandomStandard`/`getRandomFastMoney` are not functions.

- [ ] **Step 3: Implement the methods**

In `apps/api/src/question/question.service.ts`, add the `PickedQuestion` interface (exported) and the two methods. Replace the file's body with:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionEntity, toQuestion } from '@family-feud/types/entities';
import type { Question } from '@family-feud/types';
import { Repository } from 'typeorm';

/** A question plus its DB row id — the id is used only for no-repeat exclusion. */
export interface PickedQuestion {
  id: string;
  question: Question;
}

/**
 * Read-only access to the PostgreSQL question store. Returns questions already
 * mapped to the plain {@link Question} shape the game machine consumes, so the
 * socket edge can feed them straight into `HOST_START_GAME` / `HOST_NEXT_ROUND`
 * / `HOST_START_FAST_MONEY`.
 */
@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questions: Repository<QuestionEntity>,
  ) {}

  /**
   * Fetches a single question (with its answers) by id.
   *
   * @returns The mapped {@link Question}, or `null` if no row matches.
   */
  async getById(id: string): Promise<Question | null> {
    const entity = await this.questions.findOne({
      where: { id },
      relations: { answers: true },
    });
    return entity ? toQuestion(entity) : null;
  }

  /**
   * Fetches a random question (with its answers).
   *
   * @returns The mapped {@link Question}, or `null` if the store is empty.
   */
  async getRandom(): Promise<Question | null> {
    const picked = await this.questions
      .createQueryBuilder('question')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();

    if (!picked) {
      return null;
    }

    // Re-fetch with the answers relation; the random pick only needs the id.
    return this.getById(picked.id);
  }

  /**
   * Picks a random standard-round question not in `excludeIds`.
   *
   * @returns `{ id, question }`, or `null` if the (post-exclusion) pool is empty.
   */
  async getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null> {
    const qb = this.questions
      .createQueryBuilder('question')
      .where('question.kind = :kind', { kind: 'standard' });
    if (excludeIds.length > 0) {
      qb.andWhere('question.id NOT IN (:...ids)', { ids: excludeIds });
    }
    const picked = await qb.orderBy('RANDOM()').limit(1).getOne();
    if (!picked) return null;

    const question = await this.getById(picked.id);
    return question ? { id: picked.id, question } : null;
  }

  /**
   * Picks up to `count` random Fast Money questions not in `excludeIds`.
   *
   * @returns An array of `{ id, question }` (possibly shorter than `count`).
   */
  async getRandomFastMoney(
    count: number,
    excludeIds: string[],
  ): Promise<PickedQuestion[]> {
    const qb = this.questions
      .createQueryBuilder('question')
      .where('question.kind = :kind', { kind: 'fast_money' });
    if (excludeIds.length > 0) {
      qb.andWhere('question.id NOT IN (:...ids)', { ids: excludeIds });
    }
    const rows = await qb.orderBy('RANDOM()').limit(count).getMany();

    const picks: PickedQuestion[] = [];
    for (const row of rows) {
      const question = await this.getById(row.id);
      if (question) picks.push({ id: row.id, question });
    }
    return picks;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @family-feud/api -- src/question/question.service.spec.ts`
Expected: PASS (existing `getById`/`getRandom` tests plus the 5 new cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/question/question.service.ts apps/api/src/question/question.service.spec.ts
git commit -m "$(printf 'Add kind-filtered question fetch with id exclusion\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: `QuestionProvider` interface + DI plumbing (no behavior change)

Threads a provider through DI so it reaches the socket actor's input. The actor does NOT use it yet — this task only wires it up and keeps everything green.

**Files:**
- Create: `apps/api/src/game/game.questions.ts`
- Modify: `apps/api/src/game/game.socket.actor.ts` (widen `SocketActorInput`)
- Modify: `apps/api/src/game/game.service.ts` (inject `QuestionService`, pass it in)
- Modify: `apps/api/src/game/game.module.ts` (import `QuestionModule`)
- Modify: `apps/api/src/game/game.machine.spec.ts` (add `questions` stub to input)
- Modify: `apps/api/src/game/game.service.spec.ts` (construct with a stub)

**Interfaces:**
- Consumes: `PickedQuestion` shape from Task 4 (`QuestionService` structurally satisfies the provider — the two `Question` shapes, `game.types` and `@family-feud/types`, are structurally identical, so no import crosses from `question/` into `game/`).
- Produces:
  ```ts
  // game/game.questions.ts
  interface PickedQuestion { id: string; question: Question }        // Question from ./game.types
  interface QuestionProvider {
    getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null>;
    getRandomFastMoney(count: number, excludeIds: string[]): Promise<PickedQuestion[]>;
  }
  ```
  `SocketActorInput` gains `questions: QuestionProvider`.

- [ ] **Step 1: Create the provider interface**

Create `apps/api/src/game/game.questions.ts`:

```ts
import type { Question } from './game.types';

/** A question plus its DB row id — the id is used only for no-repeat exclusion. */
export interface PickedQuestion {
  id: string;
  question: Question;
}

/**
 * The narrow, framework-agnostic slice of the question store the socket actor
 * needs. `QuestionService` implements this structurally; keeping it an interface
 * (not a Nest class) keeps `game/` free of DB/DI coupling.
 */
export interface QuestionProvider {
  getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null>;
  getRandomFastMoney(count: number, excludeIds: string[]): Promise<PickedQuestion[]>;
}
```

- [ ] **Step 2: Widen `SocketActorInput`**

In `apps/api/src/game/game.socket.actor.ts`, update the import and the input type. Change:

```ts
import type { ClientRole, TeamId } from './game.types';

export type SocketActorInput = { io: Server; roomId: string };
```

to:

```ts
import type { ClientRole, TeamId } from './game.types';
import type { QuestionProvider } from './game.questions';

export type SocketActorInput = {
  io: Server;
  roomId: string;
  questions: QuestionProvider;
};
```

(Do not touch the actor body yet — Task 6 consumes `questions`.)

- [ ] **Step 3: Inject `QuestionService` into `GameService` and pass it through**

In `apps/api/src/game/game.service.ts`:

Add the import near the top:

```ts
import { QuestionService } from '../question/question.service';
```

Add a constructor (the class currently has none):

```ts
  constructor(private readonly questions: QuestionService) {}
```

And in `createRoom`, change:

```ts
    const actor = createActor(
      createGameMachine({ io, roomId: roomCode }),
    ).start();
```

to:

```ts
    const actor = createActor(
      createGameMachine({ io, roomId: roomCode, questions: this.questions }),
    ).start();
```

- [ ] **Step 4: Import `QuestionModule` in `GameModule`**

Replace `apps/api/src/game/game.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { QuestionModule } from '../question/question.module';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [QuestionModule],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
```

- [ ] **Step 5: Fix the two specs that construct these directly**

In `apps/api/src/game/game.machine.spec.ts`, change the input at line ~43:

```ts
    createGameMachine({ io: {} as unknown as Server, roomId: 'ROOM1' }),
```

to:

```ts
    createGameMachine({
      io: {} as unknown as Server,
      roomId: 'ROOM1',
      questions: {
        getRandomStandard: async () => null,
        getRandomFastMoney: async () => [],
      },
    }),
```

In `apps/api/src/game/game.service.spec.ts`, change the construction (line ~28):

```ts
    service = new GameService();
```

to:

```ts
    service = new GameService({
      getRandomStandard: async () => null,
      getRandomFastMoney: async () => [],
    } as unknown as QuestionService);
```

and add the import at the top of that spec:

```ts
import { QuestionService } from '../question/question.service';
```

- [ ] **Step 6: Typecheck and run the full api suite**

Run: `npm run typecheck && npm run test -w @family-feud/api`
Expected: typecheck PASS; all existing specs PASS (the socket actor, machine, service, and gateway behavior are unchanged — the provider is threaded but unused).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/game/game.questions.ts apps/api/src/game/game.socket.actor.ts apps/api/src/game/game.service.ts apps/api/src/game/game.module.ts apps/api/src/game/game.machine.spec.ts apps/api/src/game/game.service.spec.ts
git commit -m "$(printf 'Thread QuestionProvider through DI to the socket actor input\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: Socket actor fetches questions server-side (with no-repeat)

**Files:**
- Modify: `apps/api/src/game/game.socket.actor.ts`
- Modify: `apps/api/src/game/game.socket.actor.spec.ts`

**Interfaces:**
- Consumes: `input.questions: QuestionProvider` (Task 5). The three question events are no longer in the generic pass-through; the machine still receives them with `question`/`questions` populated (server-sourced).

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/game/game.socket.actor.spec.ts`:

First, update the harness to inject a mock provider. Change `makeHarness` to accept one and put it in the input:

```ts
function makeHarness(
  io: Server,
  questions: {
    getRandomStandard: ReturnType<typeof vi.fn>;
    getRandomFastMoney: ReturnType<typeof vi.fn>;
  } = {
    getRandomStandard: vi.fn().mockResolvedValue(null),
    getRandomFastMoney: vi.fn().mockResolvedValue([]),
  },
) {
  const received: GameEvent[] = [];
  const machine = createMachine({
    types: {},
    context: {},
    invoke: {
      id: 'socket',
      src: socketActor,
      input: { io, roomId: ROOM_ID, questions },
    },
    on: {
      '*': {
        actions: assign(({ event }) => {
          received.push(event);
          return {};
        }),
      },
    },
  });
  const actor = createActor(machine).start();
  return { actor, received };
}
```

Then add a new `describe` block (a fresh `Question` fixture makes the assertions readable):

```ts
const Q1 = { prompt: 'Q1', answers: [{ text: 'a', points: 50, revealed: false }] };
const Q2 = { prompt: 'Q2', answers: [{ text: 'b', points: 40, revealed: false }] };

describe('server-sourced question events', () => {
  it('fetches a standard question on HOST_START_GAME and sends it into the machine', async () => {
    const io = makeFakeIo();
    const getRandomStandard = vi.fn().mockResolvedValue({ id: 'q1', question: Q1 });
    const { received } = makeHarness(io, {
      getRandomStandard,
      getRandomFastMoney: vi.fn().mockResolvedValue([]),
    });
    const socket = makeFakeSocket({ role: 'host' });

    io.emit('connection', socket);
    socket.emit('HOST_START_GAME', {});

    await vi.waitFor(() =>
      expect(received).toContainEqual({ type: 'HOST_START_GAME', question: Q1 }),
    );
    expect(getRandomStandard).toHaveBeenCalledWith([]);
  });

  it('excludes the previously served id on the next fetch (no repeats)', async () => {
    const io = makeFakeIo();
    const getRandomStandard = vi
      .fn()
      .mockResolvedValueOnce({ id: 'q1', question: Q1 })
      .mockResolvedValueOnce({ id: 'q2', question: Q2 });
    const { received } = makeHarness(io, {
      getRandomStandard,
      getRandomFastMoney: vi.fn().mockResolvedValue([]),
    });
    const socket = makeFakeSocket({ role: 'host' });

    io.emit('connection', socket);
    socket.emit('HOST_START_GAME', {});
    await vi.waitFor(() =>
      expect(received).toContainEqual({ type: 'HOST_START_GAME', question: Q1 }),
    );
    socket.emit('HOST_NEXT_ROUND', {});
    await vi.waitFor(() =>
      expect(received).toContainEqual({ type: 'HOST_NEXT_ROUND', question: Q2 }),
    );

    expect(getRandomStandard).toHaveBeenNthCalledWith(1, []);
    expect(getRandomStandard).toHaveBeenNthCalledWith(2, ['q1']);
  });

  it('emits ERROR and sends nothing when no question is available', async () => {
    const io = makeFakeIo();
    const { received } = makeHarness(io, {
      getRandomStandard: vi.fn().mockResolvedValue(null),
      getRandomFastMoney: vi.fn().mockResolvedValue([]),
    });
    const socket = makeFakeSocket({ role: 'host' });
    const errors: unknown[] = [];
    socket.on('ERROR', (e) => errors.push(e));

    io.emit('connection', socket);
    received.length = 0;
    socket.emit('HOST_START_GAME', {});

    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(received).not.toContainEqual(
      expect.objectContaining({ type: 'HOST_START_GAME' }),
    );
  });

  it('fetches 5 Fast Money questions on HOST_START_FAST_MONEY', async () => {
    const io = makeFakeIo();
    // A full set of 5 picks (the handler errors on fewer).
    const fmPicks = [1, 2, 3, 4, 5].map((n) => ({
      id: `f${n}`,
      question: { prompt: `FM${n}`, answers: [{ text: 'x', points: 30, revealed: false }] },
    }));
    const getRandomFastMoney = vi.fn().mockResolvedValue(fmPicks);
    const { received } = makeHarness(io, {
      getRandomStandard: vi.fn().mockResolvedValue(null),
      getRandomFastMoney,
    });
    const socket = makeFakeSocket({ role: 'host' });

    io.emit('connection', socket);
    socket.emit('HOST_START_FAST_MONEY', {});

    await vi.waitFor(() =>
      expect(received).toContainEqual({
        type: 'HOST_START_FAST_MONEY',
        questions: fmPicks.map((p) => p.question),
      }),
    );
    expect(getRandomFastMoney).toHaveBeenCalledWith(5, []);
  });

  it('emits ERROR when fewer than 5 Fast Money questions are available', async () => {
    const io = makeFakeIo();
    const { received } = makeHarness(io, {
      getRandomStandard: vi.fn().mockResolvedValue(null),
      getRandomFastMoney: vi.fn().mockResolvedValue([{ id: 'f1', question: Q1 }]),
    });
    const socket = makeFakeSocket({ role: 'host' });
    const errors: unknown[] = [];
    socket.on('ERROR', (e) => errors.push(e));

    io.emit('connection', socket);
    received.length = 0;
    socket.emit('HOST_START_FAST_MONEY', {});

    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(received).not.toContainEqual(
      expect.objectContaining({ type: 'HOST_START_FAST_MONEY' }),
    );
  });

  it('ignores server-sourced events from a non-host socket', async () => {
    const io = makeFakeIo();
    const getRandomStandard = vi.fn().mockResolvedValue({ id: 'q1', question: Q1 });
    const { received } = makeHarness(io, {
      getRandomStandard,
      getRandomFastMoney: vi.fn().mockResolvedValue([]),
    });
    const socket = makeFakeSocket({ role: 'player', teamId: 'home' });

    io.emit('connection', socket);
    received.length = 0;
    socket.emit('HOST_START_GAME', {});

    await new Promise((r) => setTimeout(r, 10));
    expect(getRandomStandard).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @family-feud/api -- src/game/game.socket.actor.spec.ts`
Expected: FAIL — with the events still in the generic pass-through, `HOST_START_GAME {}` is forwarded verbatim (no `question`), so the `toContainEqual({ type, question: Q1 })` assertions time out / fail and the provider is never called.

- [ ] **Step 3: Implement server-side fetch in the actor**

In `apps/api/src/game/game.socket.actor.ts`:

Remove the three server-sourced events from the generic pass-through list:

```ts
const HOST_EVENT_TYPES = [
  'HOST_SET_TEAM_NAME',
  'HOST_SET_TARGET_SCORE',
  'HOST_OPEN_BUZZER',
  'HOST_MARK_CORRECT',
  'HOST_MARK_WRONG',
  'HOST_REVEAL_ANSWER',
  'HOST_STRIKE',
  'HOST_CONFIRM_STEAL',
  'HOST_CANCEL_STEAL',
  'HOST_AWARD_BUZZ',
  'HOST_PLAY',
  'HOST_PASS',
  'HOST_FM_END_ANSWERING',
  'HOST_FM_SUBMIT_ANSWERS',
  'HOST_FM_CONTINUE',
] as const;
```

(Removed: `HOST_START_GAME`, `HOST_NEXT_ROUND`, `HOST_START_FAST_MONEY`.)

Add a Fast Money size constant near the top of the file (below the imports):

```ts
/** Fast Money always asks the same fixed number of questions. */
const FAST_MONEY_QUESTION_COUNT = 5;
```

Destructure `questions` from input:

```ts
    const { io, roomId, questions } = input;
```

Declare the per-game served-id set in the actor closure (once per room, survives host reconnects) — put it just above `const onConnection = ...`:

```ts
    // Row ids already served this game; passed as exclusions so questions never
    // repeat. Scoped to the actor (one per room) and discarded on teardown.
    const servedIds = new Set<string>();
```

Inside the `if (role === 'host') { ... }` block, after the existing generic `for (const type of HOST_EVENT_TYPES)` loop, add the three dedicated handlers:

```ts
        socket.on('HOST_START_GAME', () => {
          void (async () => {
            const picked = await questions.getRandomStandard([...servedIds]);
            if (!picked) {
              socket.emit('ERROR', { message: 'No questions available' });
              return;
            }
            servedIds.add(picked.id);
            sendBack({ type: 'HOST_START_GAME', question: picked.question });
          })();
        });

        socket.on('HOST_NEXT_ROUND', () => {
          void (async () => {
            const picked = await questions.getRandomStandard([...servedIds]);
            if (!picked) {
              socket.emit('ERROR', { message: 'No questions available' });
              return;
            }
            servedIds.add(picked.id);
            sendBack({ type: 'HOST_NEXT_ROUND', question: picked.question });
          })();
        });

        socket.on('HOST_START_FAST_MONEY', () => {
          void (async () => {
            const picks = await questions.getRandomFastMoney(
              FAST_MONEY_QUESTION_COUNT,
              [...servedIds],
            );
            if (picks.length < FAST_MONEY_QUESTION_COUNT) {
              socket.emit('ERROR', { message: 'Not enough Fast Money questions' });
              return;
            }
            for (const p of picks) servedIds.add(p.id);
            sendBack({
              type: 'HOST_START_FAST_MONEY',
              questions: picks.map((p) => p.question),
            });
          })();
        });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @family-feud/api -- src/game/game.socket.actor.spec.ts`
Expected: PASS (all new cases plus the unchanged existing ones).

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npm run typecheck && npm run test -w @family-feud/api && npm run lint -w @family-feud/api`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/game/game.socket.actor.ts apps/api/src/game/game.socket.actor.spec.ts
git commit -m "$(printf 'Fetch questions server-side in the socket actor with no-repeat\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Notes for the implementer

- **Why the mid-plan "plumbing" task (5) exists:** widening `SocketActorInput` and injecting `QuestionService` are separated from the actor's behavior change (6) so each task compiles and its tests pass in isolation. Don't merge them.
- **The two `Question` types** (`game/game.types.ts` and `@family-feud/types`) are structurally identical, which is why `QuestionService` satisfies `QuestionProvider` without `question/` importing from `game/`. If you change either shape, this assignment breaks — keep them in sync.
- **The host client (`apps/web`) is out of scope.** After this lands, the host emits `HOST_START_GAME` / `HOST_NEXT_ROUND` / `HOST_START_FAST_MONEY` with **no payload**; any content it still sends on those events is ignored. Coordinate the client change separately.
- **No automated DB test** covers the migration or seed runner (no test database is configured); they're verified by the manual `npm run seed` step in Task 3.
