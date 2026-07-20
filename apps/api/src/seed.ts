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

interface SeedAnswer {
  text: string;
  points: number;
  rank: number;
}
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
  const raw = readFileSync(
    join(__dirname, 'seed', 'questions.seed.json'),
    'utf8',
  );
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
