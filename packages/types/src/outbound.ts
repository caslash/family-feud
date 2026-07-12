import type { Presence, Team, TeamId } from './entities.js';

export type NotifyPresenceChanged = { type: 'NOTIFY_PRESENCE_CHANGED'; presence: Presence };
export type NotifyTeamNameSet = { type: 'NOTIFY_TEAM_NAME_SET'; teamId: TeamId; name: string };
export type NotifyTargetScoreSet = { type: 'NOTIFY_TARGET_SCORE_SET'; targetScore: number };
export type NotifyRoundStarted = { type: 'NOTIFY_ROUND_STARTED'; roundNumber: number; prompt: string; answerCount: number };
export type NotifyBuzzerOpened = { type: 'NOTIFY_BUZZER_OPENED' };
export type NotifyBuzzed = { type: 'NOTIFY_BUZZED'; teamId: TeamId };
export type NotifyAnswerRevealed = { type: 'NOTIFY_ANSWER_REVEALED'; slotIndex: number; text: string; points: number };
export type NotifyAnswerWrong = { type: 'NOTIFY_ANSWER_WRONG'; answeringTeam: TeamId | null };
export type NotifyControlDecision = { type: 'NOTIFY_CONTROL_DECISION'; controllingTeam: TeamId | null };
export type NotifyPlayBegan = { type: 'NOTIFY_PLAY_BEGAN'; controllingTeam: TeamId | null };
export type NotifyStrike = { type: 'NOTIFY_STRIKE'; strikes: number };
export type NotifyStealStarted = { type: 'NOTIFY_STEAL_STARTED' };
export type NotifyStealResolved = { type: 'NOTIFY_STEAL_RESOLVED'; stole: boolean; teams: Record<TeamId, Team> };
export type NotifyRoundEnded = { type: 'NOTIFY_ROUND_ENDED'; teams: Record<TeamId, Team> };
export type NotifyFastMoneyReached = { type: 'NOTIFY_FAST_MONEY_REACHED'; winner: TeamId | null };
export type NotifyFastMoneyStarted = { type: 'NOTIFY_FAST_MONEY_STARTED' };
export type NotifyFmAnsweringStarted = { type: 'NOTIFY_FM_ANSWERING_STARTED'; player: 1 | 2; durationMs: number };
export type NotifyFmPlayerSubmitted = { type: 'NOTIFY_FM_PLAYER_SUBMITTED'; player: 1 | 2; slots: (number | null)[] };
export type NotifyFmResult = { type: 'NOTIFY_FM_RESULT'; total: number; won: boolean | null };
export type NotifyGameOver = { type: 'NOTIFY_GAME_OVER'; winner: TeamId | null };

export type GameSocketActorEvent =
  | NotifyPresenceChanged
  | NotifyTeamNameSet
  | NotifyTargetScoreSet
  | NotifyRoundStarted
  | NotifyBuzzerOpened
  | NotifyBuzzed
  | NotifyAnswerRevealed
  | NotifyAnswerWrong
  | NotifyControlDecision
  | NotifyPlayBegan
  | NotifyStrike
  | NotifyStealStarted
  | NotifyStealResolved
  | NotifyRoundEnded
  | NotifyFastMoneyReached
  | NotifyFastMoneyStarted
  | NotifyFmAnsweringStarted
  | NotifyFmPlayerSubmitted
  | NotifyFmResult
  | NotifyGameOver;
