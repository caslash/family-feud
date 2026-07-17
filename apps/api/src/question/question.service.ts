import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionEntity, toQuestion } from '@family-feud/types/entities';
import type { Question } from '@family-feud/types';
import { Repository } from 'typeorm';

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
}
