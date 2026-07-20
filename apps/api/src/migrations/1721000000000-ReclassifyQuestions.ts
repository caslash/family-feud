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
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "category" text`,
    );
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "kind"`);
  }
}
