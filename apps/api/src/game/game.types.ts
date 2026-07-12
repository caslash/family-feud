export type TeamId = 'home' | 'away';

export type ClientRole = 'host' | 'board' | 'player';

export interface Answer {
  text: string;
  points: number;
  revealed: boolean;
}

export interface Question {
  prompt: string;
  answers: Answer[];
}

export interface Team {
  name: string;
  score: number;
}
