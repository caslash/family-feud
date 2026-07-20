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
    kind: 'standard',
    answers,
  };
}

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

describe('QuestionService', () => {
  let findOne: ReturnType<typeof vi.fn>;
  let createQueryBuilder: ReturnType<typeof vi.fn>;
  let service: QuestionService;

  beforeEach(() => {
    findOne = vi.fn();
    createQueryBuilder = vi.fn();
    const repo = {
      findOne,
      createQueryBuilder,
    } as unknown as Repository<QuestionEntity>;
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
        getOne: vi.fn().mockResolvedValue({ id: 'q1' }),
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
      expect(picks[0]).toEqual({
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

    it('returns [] when the pool is empty', async () => {
      createQueryBuilder.mockReturnValue(makeQb([]));

      expect(await service.getRandomFastMoney(5, [])).toEqual([]);
      expect(findOne).not.toHaveBeenCalled();
    });
  });
});
