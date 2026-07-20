import type { Question } from './game.types';

/** A question plus its DB row id — the id is used only for no-repeat exclusion. */
export interface PickedQuestion {
  id: string;
  question: Question;
}

/**
 * The narrow, framework-agnostic slice of the question store the socket actor
 * needs. `QuestionService` implements this structurally; keeping it an interface
 * (not a Nest class) keeps `game/` free of DB/DI coupling.
 */
export interface QuestionProvider {
  getRandomStandard(excludeIds: string[]): Promise<PickedQuestion | null>;
  getRandomFastMoney(count: number, excludeIds: string[]): Promise<PickedQuestion[]>;
}
