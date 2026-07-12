import type { GuardArgs } from 'xstate';
import { assertEvent } from 'xstate';
import type { GameContext } from './game.context';
import type { GameEvent } from './game.events';

type GameGuardArgs = GuardArgs<GameContext, GameEvent>;

const canStartGame = ({ context }: GameGuardArgs): boolean => {
  return (
    context.presence.host &&
    context.presence.board &&
    context.presence.players.home &&
    context.presence.players.away &&
    context.teams.home.name.trim().length > 0 &&
    context.teams.away.name.trim().length > 0 &&
    context.targetScore !== null &&
    context.targetScore > 0
  );
};

const isDecidingTeam = ({ context, event }: GameGuardArgs): boolean => {
  assertEvent(event, ['PLAY', 'PASS']);
  return event.teamId === context.controllingTeam;
};

const isHostRole = ({ event }: GameGuardArgs): boolean => {
  assertEvent(event, 'CLIENT_DISCONNECTED');
  return event.role === 'host';
};

const isBoardComplete = ({ context }: GameGuardArgs): boolean => {
  return (
    context.currentQuestion?.answers.every((answer) => answer.revealed) ?? false
  );
};

const reachedMaxStrikes = ({ context }: GameGuardArgs): boolean => {
  return context.strikes >= 3;
};

const targetReached = ({ context }: GameGuardArgs): boolean => {
  if (context.targetScore === null) return false;
  return (
    context.teams.home.score >= context.targetScore ||
    context.teams.away.score >= context.targetScore
  );
};

const isUnrevealedSlot = ({ context, event }: GameGuardArgs): boolean => {
  assertEvent(event, 'HOST_REVEAL_ANSWER');
  const answer = context.currentQuestion?.answers[event.slotIndex];
  return !!answer && !answer.revealed;
};

const isTopAnswer = ({ context, event }: GameGuardArgs): boolean => {
  assertEvent(event, 'HOST_MARK_CORRECT');
  const question = context.currentQuestion;
  if (!question) return false;
  const answer = question.answers[event.slotIndex];
  if (!answer) return false;
  const maxPoints = Math.max(...question.answers.map((a) => a.points));
  return answer.points === maxPoints;
};

const secondBeatsFirst = ({ context, event }: GameGuardArgs): boolean => {
  assertEvent(event, 'HOST_MARK_CORRECT');
  const question = context.currentQuestion;
  if (!question || context.answeringTeam === null) return false;
  const secondPoints = question.answers[event.slotIndex]?.points ?? 0;
  const firstTeam = context.answeringTeam === 'home' ? 'away' : 'home';
  const firstPoints = context.faceoffPoints[firstTeam];
  return firstPoints === null || secondPoints > firstPoints;
};

const firstTeamHasAnswer = ({ context }: GameGuardArgs): boolean => {
  if (context.answeringTeam === null) return false;
  const firstTeam = context.answeringTeam === 'home' ? 'away' : 'home';
  return context.faceoffPoints[firstTeam] !== null;
};

export const guards = {
  canStartGame,
  isDecidingTeam,
  isHostRole,
  isBoardComplete,
  reachedMaxStrikes,
  targetReached,
  isUnrevealedSlot,
  isTopAnswer,
  secondBeatsFirst,
  firstTeamHasAnswer,
};
