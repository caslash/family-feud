import { assertEvent, assign } from 'xstate';
import type { GameContext } from './game.context';
import type { GameEvent } from './game.events';
import type { Question, TeamId } from './game.types';

const gameAssign = assign<GameContext, GameEvent, undefined, GameEvent, never>;

const otherTeam = (teamId: TeamId): TeamId =>
  teamId === 'home' ? 'away' : 'home';

// A question always enters the machine with every answer unrevealed,
// regardless of what the caller supplied.
const normalizeQuestion = (question: Question): Question => ({
  prompt: question.prompt,
  answers: question.answers.map((answer) => ({ ...answer, revealed: false })),
});

const setPresence = gameAssign(({ context, event }) => {
  assertEvent(event, 'CLIENT_CONNECTED');
  if (event.role === 'host') {
    return { presence: { ...context.presence, host: true } };
  }
  if (event.role === 'board') {
    return { presence: { ...context.presence, board: true } };
  }
  if (event.teamId) {
    return {
      presence: {
        ...context.presence,
        players: { ...context.presence.players, [event.teamId]: true },
      },
    };
  }
  return {};
});

const clearPresence = gameAssign(({ context, event }) => {
  assertEvent(event, 'CLIENT_DISCONNECTED');
  if (event.role === 'host') {
    return { presence: { ...context.presence, host: false } };
  }
  if (event.role === 'board') {
    return { presence: { ...context.presence, board: false } };
  }
  if (event.teamId) {
    return {
      presence: {
        ...context.presence,
        players: { ...context.presence.players, [event.teamId]: false },
      },
    };
  }
  return {};
});

const setTeamName = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_SET_TEAM_NAME');
  return {
    teams: {
      ...context.teams,
      [event.teamId]: { ...context.teams[event.teamId], name: event.name },
    },
  };
});

const setTargetScore = gameAssign(({ event }) => {
  assertEvent(event, 'HOST_SET_TARGET_SCORE');
  return { targetScore: event.targetScore };
});

const loadQuestion = gameAssign(({ event }) => {
  assertEvent(event, 'HOST_START_GAME');
  return { currentQuestion: normalizeQuestion(event.question) };
});

const setAnsweringTeam = gameAssign(({ event }) => {
  assertEvent(event, 'BUZZ');
  return { answeringTeam: event.teamId };
});

const flipAnsweringTeam = gameAssign(({ context }) => {
  return {
    answeringTeam: context.answeringTeam
      ? otherTeam(context.answeringTeam)
      : null,
  };
});

// Used for both the face-off correct answer and in-play reveals — both
// events carry a `slotIndex` into currentQuestion.answers.
const revealSlotAndBank = gameAssign(({ context, event }) => {
  assertEvent(event, ['HOST_MARK_CORRECT', 'HOST_REVEAL_ANSWER']);
  if (!context.currentQuestion) return {};
  const answer = context.currentQuestion.answers[event.slotIndex];
  if (!answer || answer.revealed) return {};

  const answers = context.currentQuestion.answers.map((a, index) =>
    index === event.slotIndex ? { ...a, revealed: true } : a,
  );

  return {
    currentQuestion: { ...context.currentQuestion, answers },
    boardBank: context.boardBank + answer.points,
  };
});

const takeControl = gameAssign(({ context }) => {
  return { controllingTeam: context.answeringTeam };
});

const flipControl = gameAssign(({ context }) => {
  return {
    controllingTeam: context.controllingTeam
      ? otherTeam(context.controllingTeam)
      : null,
  };
});

const incrementStrike = gameAssign(({ context }) => {
  return { strikes: context.strikes + 1 };
});

const resetStrikes = gameAssign(() => {
  return { strikes: 0 };
});

const commitBankToController = gameAssign(({ context }) => {
  if (!context.controllingTeam) return { boardBank: 0 };
  const team = context.controllingTeam;
  return {
    teams: {
      ...context.teams,
      [team]: {
        ...context.teams[team],
        score: context.teams[team].score + context.boardBank,
      },
    },
    boardBank: 0,
  };
});

const commitBankToStealer = gameAssign(({ context }) => {
  if (!context.controllingTeam) return { boardBank: 0 };
  const stealer = otherTeam(context.controllingTeam);
  return {
    teams: {
      ...context.teams,
      [stealer]: {
        ...context.teams[stealer],
        score: context.teams[stealer].score + context.boardBank,
      },
    },
    boardBank: 0,
  };
});

const revealSlotOnly = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_REVEAL_ANSWER');
  if (!context.currentQuestion) return {};
  const answer = context.currentQuestion.answers[event.slotIndex];
  if (!answer || answer.revealed) return {};
  const answers = context.currentQuestion.answers.map((a, index) =>
    index === event.slotIndex ? { ...a, revealed: true } : a,
  );
  return { currentQuestion: { ...context.currentQuestion, answers } };
});

const startNextRound = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_NEXT_ROUND');
  return {
    strikes: 0,
    boardBank: 0,
    answeringTeam: null,
    controllingTeam: null,
    faceoffPoints: { home: null, away: null },
    pendingStealSlot: null,
    roundNumber: context.roundNumber + 1,
    currentQuestion: normalizeQuestion(event.question),
  };
});

const setWinner = gameAssign(({ context }) => {
  if (context.targetScore === null) return {};
  const winner: TeamId | null =
    context.teams.home.score >= context.targetScore
      ? 'home'
      : context.teams.away.score >= context.targetScore
        ? 'away'
        : null;
  return { winner };
});

export const actions = {
  setPresence,
  clearPresence,
  setTeamName,
  setTargetScore,
  loadQuestion,
  setAnsweringTeam,
  flipAnsweringTeam,
  revealSlotAndBank,
  takeControl,
  flipControl,
  incrementStrike,
  resetStrikes,
  commitBankToController,
  commitBankToStealer,
  revealSlotOnly,
  startNextRound,
  setWinner,
};
