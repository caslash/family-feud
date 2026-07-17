import { join } from 'node:path';
import { AnswerEntity, QuestionEntity } from '@family-feud/types/entities';
import type { DataSourceOptions } from 'typeorm';

/**
 * Reads a required environment variable, throwing if it is absent. Connection
 * config must be explicit — we never silently fall back to a default database.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Builds the TypeORM options shared by the Nest connection
 * (`TypeOrmModule.forRootAsync`) and the standalone migration CLI
 * (`data-source.ts`), so both stay in lock-step.
 *
 * `synchronize` is always off — schema changes only ever happen through
 * migrations. `migrationsRun` is on, so pending migrations are applied when the
 * connection opens (see below). The store is read-only game content.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    username: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    entities: [QuestionEntity, AnswerEntity],
    // Resolve migrations relative to this file so it works from both `src`
    // (ts-node CLI) and the compiled `dist` output.
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    synchronize: false,
    // Apply pending migrations on connection (every environment, prod included).
    // A failed migration hard-blocks startup — we'd rather the API refuse to
    // boot on a bad/unmigrated DB than surface the problem mid-session.
    migrationsRun: true,
  };
}
