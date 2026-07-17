import type { AnswerEntity, QuestionEntity } from '@family-feud/types/entities';
import type { Repository } from 'typeorm';
import { QuestionService } from './question.service';

/** Builds a QuestionEntity fixture (answers deliberately out of rank order). */
function buildEntity(): QuestionEntity {
  const answers = [
    { id: 'a2', text: 'Second', points: 20, rank: 1, questionId: 'q1' },
    { id: 'a1', text: 'First', points: 40, rank: 0, questionId: 'q1' },
  ] as AnswerEntity[];

  return {
    id: 'q1',
    prompt: 'Name a fruit',
    category: null,
    difficulty: null,
    answers,
  } as QuestionEntity;
}

describe('QuestionService', () => {
  let findOne: ReturnType<typeof vi.fn>;
  let createQueryBuilder: ReturnType<typeof vi.fn>;
  let service: QuestionService;

  beforeEach(() => {
    findOne = vi.fn();
    createQueryBuilder = vi.fn();
    const repo = { findOne, createQueryBuilder } as unknown as Repository<QuestionEntity>;
    service = new QuestionService(repo);
  });

  describe('getById', () => {
    it('maps the entity to a plain Question, ordered by rank and unrevealed', async () => {
      findOne.mockResolvedValue(buildEntity());

      const question = await service.getById('q1');

      expect(findOne).toHaveBeenCalledWith({
        where: { id: 'q1' },
        relations: { answers: true },
      });
      expect(question).toEqual({
        prompt: 'Name a fruit',
        answers: [
          { text: 'First', points: 40, revealed: false },
          { text: 'Second', points: 20, revealed: false },
        ],
      });
    });

    it('returns null when no question matches', async () => {
      findOne.mockResolvedValue(null);

      expect(await service.getById('missing')).toBeNull();
    });
  });

  describe('getRandom', () => {
    it('picks a random id then loads it with answers', async () => {
      const qb = {
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue({ id: 'q1' } as QuestionEntity),
      };
      createQueryBuilder.mockReturnValue(qb);
      findOne.mockResolvedValue(buildEntity());

      const question = await service.getRandom();

      expect(qb.orderBy).toHaveBeenCalledWith('RANDOM()');
      expect(findOne).toHaveBeenCalledWith({
        where: { id: 'q1' },
        relations: { answers: true },
      });
      expect(question?.answers).toHaveLength(2);
    });

    it('returns null when the store is empty', async () => {
      const qb = {
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      };
      createQueryBuilder.mockReturnValue(qb);

      expect(await service.getRandom()).toBeNull();
      expect(findOne).not.toHaveBeenCalled();
    });
  });
});
