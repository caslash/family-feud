import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Question } from './entities.js';

/**
 * A persisted Family Feud question and its answers.
 *
 * Read-only game content sourced from the question dataset. Map it down to the
 * machine's plain {@link Question} shape with {@link toQuestion} before feeding
 * `HOST_START_GAME` — never hand the entity to the machine directly.
 *
 * Declared before {@link AnswerEntity} because `emitDecoratorMetadata` emits an
 * eager `design:type` reference to this class from `AnswerEntity.question`; the
 * referenced class must already be initialized to avoid a temporal-dead-zone
 * error at import time.
 */
@Entity('questions')
export class QuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  prompt!: string;

  @Column('text', { default: 'standard' })
  kind!: 'standard' | 'fast_money';

  @OneToMany(() => AnswerEntity, (answer) => answer.question, {
    cascade: true,
  })
  answers!: AnswerEntity[];
}

/**
 * A single boardable answer belonging to a {@link QuestionEntity}.
 *
 * This is the persisted, read-only content shape — it is NOT the runtime
 * `Answer` the game machine boards. `rank` fixes the display order (top answer
 * first); `revealed` is intentionally absent because it is game state, not
 * content (the machine seeds it via `normalizeQuestion`).
 */
@Entity('answers')
export class AnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  text!: string;

  @Column('int')
  points!: number;

  /** Display order within the question, 0-based (0 = top answer). */
  @Column('int')
  rank!: number;

  @Column('uuid')
  questionId!: string;

  @ManyToOne(() => QuestionEntity, (question) => question.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question!: QuestionEntity;
}

/**
 * Maps a persisted {@link QuestionEntity} down to the plain {@link Question}
 * the game machine consumes. Answers are ordered by `rank` and every answer is
 * seeded `revealed: false` (the machine's `normalizeQuestion` also enforces
 * this, but we produce a clean shape regardless).
 */
export function toQuestion(entity: QuestionEntity): Question {
  return {
    prompt: entity.prompt,
    answers: [...entity.answers]
      .sort((a, b) => a.rank - b.rank)
      .map((answer) => ({
        text: answer.text,
        points: answer.points,
        revealed: false,
      })),
  };
}
