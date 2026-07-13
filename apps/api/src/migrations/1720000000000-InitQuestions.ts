import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the read-only question store: `questions` and its `answers`, linked
 * by a cascading foreign key. Mirrors `QuestionEntity` / `AnswerEntity` in
 * `@family-feud/types/entities`.
 *
 * `gen_random_uuid()` is built into PostgreSQL 13+; no extension required.
 */
export class InitQuestions1720000000000 implements MigrationInterface {
  name = 'InitQuestions1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "prompt" text NOT NULL,
        "category" text,
        "difficulty" text,
        CONSTRAINT "PK_questions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "answers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "text" text NOT NULL,
        "points" integer NOT NULL,
        "rank" integer NOT NULL,
        "questionId" uuid NOT NULL,
        CONSTRAINT "PK_answers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_answers_questionId" ON "answers" ("questionId")
    `);

    await queryRunner.query(`
      ALTER TABLE "answers"
        ADD CONSTRAINT "FK_answers_question"
        FOREIGN KEY ("questionId") REFERENCES "questions"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_answers_question"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_answers_questionId"`);
    await queryRunner.query(`DROP TABLE "answers"`);
    await queryRunner.query(`DROP TABLE "questions"`);
  }
}
