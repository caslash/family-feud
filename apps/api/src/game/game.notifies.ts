import { type ActorRefFrom, sendTo } from 'xstate';
import type { GameContext } from './game.context';
import type { GameEvent } from './game.events';
import { socketActor } from './game.socket.actor';

type SocketRef = ActorRefFrom<typeof socketActor>;

// The 5th generic (TEvent) types the *raising* machine's own event union
// (GameEvent) for consistency with setup()'s action map — it is NOT the
// sent-event type. The event actually sent to 'socket' is already
// type-checked against EventFrom<SocketRef> via the 4th generic (SocketRef),
// which resolves to GameSocketActorEvent because socketActor is
// fromCallback<GameSocketActorEvent, ...>. See the nestjs-xstate skill.
const sendToSocket = sendTo<
  GameContext,
  GameEvent,
  undefined,
  SocketRef,
  GameEvent
>;

const notifyPresenceChanged = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_PRESENCE_CHANGED',
  presence: context.presence,
}));

const notifyTeamNameSet = sendToSocket('socket', ({ event }) => {
  const e = event as Extract<GameEvent, { type: 'HOST_SET_TEAM_NAME' }>;
  return {
    type: 'NOTIFY_TEAM_NAME_SET' as const,
    teamId: e.teamId,
    name: e.name,
  };
});

const notifyTargetScoreSet = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_TARGET_SCORE_SET',
  targetScore: context.targetScore ?? 0,
}));

const notifyRoundStarted = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_ROUND_STARTED',
  roundNumber: context.roundNumber,
  prompt: context.currentQuestion?.prompt ?? '',
  answerCount: context.currentQuestion?.answers.length ?? 0,
}));

const notifyBuzzerOpened = sendToSocket('socket', () => ({
  type: 'NOTIFY_BUZZER_OPENED',
}));

const notifyBuzzed = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_BUZZED',
  teamId: context.answeringTeam as Exclude<GameContext['answeringTeam'], null>,
}));

const notifyAnswerRevealed = sendToSocket('socket', ({ context, event }) => {
  const e = event as Extract<
    GameEvent,
    { type: 'HOST_MARK_CORRECT' | 'HOST_REVEAL_ANSWER' }
  >;
  const answer = context.currentQuestion?.answers[e.slotIndex];
  return {
    type: 'NOTIFY_ANSWER_REVEALED' as const,
    slotIndex: e.slotIndex,
    text: answer?.text ?? '',
    points: answer?.points ?? 0,
  };
});

const notifyAnswerWrong = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_ANSWER_WRONG',
  answeringTeam: context.answeringTeam,
}));

const notifyControlDecision = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_CONTROL_DECISION',
  controllingTeam: context.controllingTeam,
}));

const notifyPlayBegan = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_PLAY_BEGAN',
  controllingTeam: context.controllingTeam,
}));

const notifyStrike = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_STRIKE',
  strikes: context.strikes,
}));

const notifyStealStarted = sendToSocket('socket', () => ({
  type: 'NOTIFY_STEAL_STARTED',
}));

const notifyStealSucceeded = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_STEAL_RESOLVED',
  stole: true,
  teams: context.teams,
}));

const notifyStealCancelled = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_STEAL_RESOLVED',
  stole: false,
  teams: context.teams,
}));

const notifyRoundEnded = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_ROUND_ENDED',
  teams: context.teams,
}));

const notifyFastMoneyReached = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_FAST_MONEY_REACHED',
  winner: context.winner,
}));

const notifyFastMoneyStarted = sendToSocket('socket', () => ({
  type: 'NOTIFY_FAST_MONEY_STARTED',
}));

const notifyFm1AnsweringStarted = sendToSocket('socket', () => ({
  type: 'NOTIFY_FM_ANSWERING_STARTED',
  player: 1,
  durationMs: 15000,
}));

const notifyFm2AnsweringStarted = sendToSocket('socket', () => ({
  type: 'NOTIFY_FM_ANSWERING_STARTED',
  player: 2,
  durationMs: 20000,
}));

const notifyFmPlayer1Submitted = sendToSocket('socket', ({ event }) => {
  const e = event as Extract<GameEvent, { type: 'HOST_FM_SUBMIT_ANSWERS' }>;
  return {
    type: 'NOTIFY_FM_PLAYER_SUBMITTED' as const,
    player: 1,
    slots: e.slots,
  };
});

const notifyFmPlayer2Submitted = sendToSocket('socket', ({ event }) => {
  const e = event as Extract<GameEvent, { type: 'HOST_FM_SUBMIT_ANSWERS' }>;
  return {
    type: 'NOTIFY_FM_PLAYER_SUBMITTED' as const,
    player: 2,
    slots: e.slots,
  };
});

const notifyFmResult = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_FM_RESULT',
  total: context.fastMoney?.total ?? 0,
  won: context.fastMoney?.won ?? null,
}));

const notifyGameOver = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_GAME_OVER',
  winner: context.winner,
}));

export const notifyActions = {
  notifyPresenceChanged,
  notifyTeamNameSet,
  notifyTargetScoreSet,
  notifyRoundStarted,
  notifyBuzzerOpened,
  notifyBuzzed,
  notifyAnswerRevealed,
  notifyAnswerWrong,
  notifyControlDecision,
  notifyPlayBegan,
  notifyStrike,
  notifyStealStarted,
  notifyStealSucceeded,
  notifyStealCancelled,
  notifyRoundEnded,
  notifyFastMoneyReached,
  notifyFastMoneyStarted,
  notifyFm1AnsweringStarted,
  notifyFm2AnsweringStarted,
  notifyFmPlayer1Submitted,
  notifyFmPlayer2Submitted,
  notifyFmResult,
  notifyGameOver,
};
