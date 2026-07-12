import { createActor, type Actor } from 'xstate';
import { createGameMachine } from './game.machine';
import type { Question } from './game.types';

function makeQuestion(prompt = 'Q1'): Question {
  return {
    prompt,
    answers: [
      { text: 'first', points: 30, revealed: false },
      { text: 'second', points: 20, revealed: false },
      { text: 'third', points: 10, revealed: false },
    ],
  };
}

function makeActor() {
  return createActor(createGameMachine('ROOM1')).start();
}

function connectEveryone(actor: Actor<ReturnType<typeof createGameMachine>>) {
  actor.send({ type: 'CLIENT_CONNECTED', role: 'host' });
  actor.send({ type: 'CLIENT_CONNECTED', role: 'board' });
  actor.send({ type: 'CLIENT_CONNECTED', role: 'player', teamId: 'home' });
  actor.send({ type: 'CLIENT_CONNECTED', role: 'player', teamId: 'away' });
}

function setUpTeams(actor: Actor<ReturnType<typeof createGameMachine>>) {
  actor.send({ type: 'HOST_SET_TEAM_NAME', teamId: 'home', name: 'Home Team' });
  actor.send({ type: 'HOST_SET_TEAM_NAME', teamId: 'away', name: 'Away Team' });
  actor.send({ type: 'HOST_SET_TARGET_SCORE', targetScore: 100 });
}

/** Drives the actor from a fresh lobby all the way to `roundActive.play.awaitingGuess`,
 * with `home` as the controlling team, via a face-off `home` wins outright. */
function startAndReachPlay(actor: Actor<ReturnType<typeof createGameMachine>>) {
  connectEveryone(actor);
  setUpTeams(actor);
  actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
  actor.send({ type: 'HOST_OPEN_BUZZER' });
  actor.send({ type: 'BUZZ', teamId: 'home' });
  actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 });
  actor.send({ type: 'PLAY', teamId: 'home' });
}

describe('game machine', () => {
  describe('lobby', () => {
    it('rejects HOST_START_GAME until everyone is connected, teams named, and target set', () => {
      const actor = makeActor();

      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      expect(actor.getSnapshot().value).toBe('lobby');

      connectEveryone(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      expect(actor.getSnapshot().value).toBe('lobby');

      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      expect(actor.getSnapshot().value).not.toBe('lobby');
    });

    it('starts the game and loads the question once all conditions are met', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({
        type: 'HOST_START_GAME',
        question: makeQuestion('Face-off question'),
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ roundActive: { faceoff: 'ready' } });
      expect(snapshot.context.currentQuestion?.prompt).toBe(
        'Face-off question',
      );
    });
  });

  describe('face-off', () => {
    it('keeps the buzzer locked until the host opens it', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });

      actor.send({ type: 'BUZZ', teamId: 'home' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'ready' },
      });

      actor.send({ type: 'HOST_OPEN_BUZZER' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'buzzerOpen' },
      });
    });

    it('the first BUZZ wins; a later BUZZ is a no-op', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });

      actor.send({ type: 'BUZZ', teamId: 'away' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'answerPending' },
      });

      actor.send({ type: 'BUZZ', teamId: 'home' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
    });

    it('HOST_MARK_CORRECT reveals the slot, banks points, and hands control to the answering team', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'away' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 1 });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
      expect(snapshot.context.controllingTeam).toBe('away');
      expect(snapshot.context.boardBank).toBe(20);
      expect(snapshot.context.currentQuestion?.answers[1].revealed).toBe(true);
    });

    it('HOST_MARK_WRONG bounces the answer back and forth until someone is correct', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });

      actor.send({ type: 'HOST_MARK_WRONG' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'answerPending' },
      });

      actor.send({ type: 'HOST_MARK_WRONG' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('home');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'answerPending' },
      });

      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 2 });
      expect(actor.getSnapshot().context.controllingTeam).toBe('home');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
    });

    it('controlDecision: only the deciding team may PLAY or PASS', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 });

      actor.send({ type: 'PLAY', teamId: 'away' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });

      actor.send({ type: 'PLAY', teamId: 'home' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'awaitingGuess' },
      });
      expect(actor.getSnapshot().context.controllingTeam).toBe('home');
    });

    it('PASS flips control to the other team', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 });
      actor.send({ type: 'PASS', teamId: 'home' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { play: 'awaitingGuess' },
      });
      expect(snapshot.context.controllingTeam).toBe('away');
    });
  });

  describe('play', () => {
    it('clearing the board commits the bank to the controlling team, no steal', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // home controls, slot 0 (30) already revealed, boardBank=30

      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 }); // +20 => 50
      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 2 }); // +10 => 60, board complete

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('roundEnd');
      expect(snapshot.context.teams.home.score).toBe(60);
      expect(snapshot.context.teams.away.score).toBe(0);
      expect(snapshot.context.boardBank).toBe(0);
    });

    it('three strikes moves to steal', () => {
      const actor = makeActor();
      startAndReachPlay(actor);

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'awaitingGuess' },
      });

      actor.send({ type: 'HOST_STRIKE' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'steal' },
      });
      expect(actor.getSnapshot().context.strikes).toBe(3);
    });

    it('a successful steal awards the whole bank to the stealing team', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // home controls, boardBank=30 from the face-off answer

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'steal' },
      });

      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 }); // away steals: +20 => bank 50

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('roundEnd');
      expect(snapshot.context.teams.away.score).toBe(50);
      expect(snapshot.context.teams.home.score).toBe(0);
      expect(snapshot.context.boardBank).toBe(0);
    });

    it('a failed steal leaves the bank with the controlling team', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // home controls, boardBank=30

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' }); // away's steal attempt misses

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('roundEnd');
      expect(snapshot.context.teams.home.score).toBe(30);
      expect(snapshot.context.teams.away.score).toBe(0);
    });
  });

  describe('round end and game over', () => {
    it('HOST_NEXT_ROUND resets round state and returns to faceoff.ready, keeping scores', () => {
      const actor = makeActor();
      startAndReachPlay(actor);
      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 });
      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 2 }); // board complete, home=60

      actor.send({
        type: 'HOST_NEXT_ROUND',
        question: makeQuestion('Round 2'),
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ roundActive: { faceoff: 'ready' } });
      expect(snapshot.context.strikes).toBe(0);
      expect(snapshot.context.boardBank).toBe(0);
      expect(snapshot.context.controllingTeam).toBeNull();
      expect(snapshot.context.answeringTeam).toBeNull();
      expect(snapshot.context.currentQuestion?.prompt).toBe('Round 2');
      expect(snapshot.context.teams.home.score).toBe(60);
    });

    it('reaching the target score ends the game with the correct winner', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor); // targetScore = 100
      actor.send({
        type: 'HOST_START_GAME',
        question: {
          prompt: 'Big points',
          answers: [{ text: 'huge', points: 150, revealed: false }],
        },
      });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'away' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 });
      actor.send({ type: 'PLAY', teamId: 'away' });
      actor.send({ type: 'HOST_STRIKE' }); // board is already fully revealed (1 answer)

      // With a single-answer board, the face-off reveal already clears it —
      // control should have gone straight to roundEnd. Confirm winner + game over.
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('gameOver');
      expect(snapshot.context.winner).toBe('away');
      expect(snapshot.context.teams.away.score).toBe(150);
    });
  });

  describe('host disconnect', () => {
    it('tears the room down from any state', () => {
      const actor = makeActor();
      startAndReachPlay(actor);

      actor.send({ type: 'CLIENT_DISCONNECTED', role: 'host' });

      expect(actor.getSnapshot().value).toBe('closed');
      expect(actor.getSnapshot().status).toBe('done');
    });

    it('a board or player disconnect does not tear the room down', () => {
      const actor = makeActor();
      startAndReachPlay(actor);

      actor.send({ type: 'CLIENT_DISCONNECTED', role: 'board' });
      actor.send({
        type: 'CLIENT_DISCONNECTED',
        role: 'player',
        teamId: 'away',
      });

      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'awaitingGuess' },
      });
      expect(actor.getSnapshot().context.presence.board).toBe(false);
      expect(actor.getSnapshot().context.presence.players.away).toBe(false);
    });
  });
});
