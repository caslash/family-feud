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
 * gateway can feed them straight into `HOST_START_GAME` / `HOST_NEXT_ROUND`.
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
  async getRandomStandard(
    excludeIds: string[],
  ): Promise<PickedQuestion | null> {
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
