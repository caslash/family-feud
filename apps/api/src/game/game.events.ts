import type { ClientRole, Question, TeamId } from './game.types';

export type GameEvent =
  | { type: 'CLIENT_CONNECTED'; role: ClientRole; teamId?: TeamId }
  | { type: 'CLIENT_DISCONNECTED'; role: ClientRole; teamId?: TeamId }
  | { type: 'HOST_SET_TEAM_NAME'; teamId: TeamId; name: string }
  | { type: 'HOST_SET_TARGET_SCORE'; targetScore: number }
  | { type: 'HOST_START_GAME'; question: Question }
  | { type: 'HOST_OPEN_BUZZER' }
  | { type: 'HOST_MARK_CORRECT'; slotIndex: number }
  | { type: 'HOST_MARK_WRONG' }
  | { type: 'HOST_REVEAL_ANSWER'; slotIndex: number }
  | { type: 'HOST_STRIKE' }
  | { type: 'HOST_CONFIRM_STEAL' }
  | { type: 'HOST_CANCEL_STEAL' }
  | { type: 'HOST_NEXT_ROUND'; question: Question }
  | { type: 'BUZZ'; teamId: TeamId }
  | { type: 'PLAY'; teamId: TeamId }
  | { type: 'PASS'; teamId: TeamId };
