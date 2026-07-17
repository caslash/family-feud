import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database/typeorm.config';

// Load `.env` for the standalone TypeORM CLI (migration:generate/run/revert).
// The Nest app loads env via ConfigModule; this covers the CLI's own process.
config();

/**
 * Standalone DataSource consumed by the TypeORM CLI. Not used by the running
 * Nest app (which builds its connection via `TypeOrmModule.forRootAsync`).
 *
 * Must be the file's ONLY export — the CLI's `loadDataSource` rejects a module
 * that exports more than one value.
 */
export default new DataSource(buildDataSourceOptions());
