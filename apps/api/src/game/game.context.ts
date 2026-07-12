import type { Question, Team, TeamId } from './game.types';

export interface FastMoneyState {
  questions: Question[];
  player1: (number | null)[];
  player2: (number | null)[];
  total: number;
  won: boolean | null;
}

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
  roundNumber: number;
  faceoffPoints: Record<TeamId, number | null>;
  pendingStealSlot: number | null;
  winner: TeamId | null;
  fastMoney: FastMoneyState | null;
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
    roundNumber: 1,
    faceoffPoints: { home: null, away: null },
    pendingStealSlot: null,
    winner: null,
    fastMoney: null,
  };
}
