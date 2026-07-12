import type { Question, Team, TeamId } from './game.types';

export interface GameContext {
  roomCode: string;
  targetScore: number | null;
  teams: Record<TeamId, Team>;
  presence: {
    host: boolean;
    board: boolean;
    players: Record<TeamId, boolean>;
  };
  currentQuestion: Question | null;
  answeringTeam: TeamId | null;
  controllingTeam: TeamId | null;
  strikes: number;
  boardBank: number;
  winner: TeamId | null;
}

export function initialGameContext(roomCode: string): GameContext {
  return {
    roomCode,
    targetScore: null,
    teams: {
      home: { name: '', score: 0 },
      away: { name: '', score: 0 },
    },
    presence: {
      host: false,
      board: false,
      players: { home: false, away: false },
    },
    currentQuestion: null,
    answeringTeam: null,
    controllingTeam: null,
    strikes: 0,
    boardBank: 0,
    winner: null,
  };
}
