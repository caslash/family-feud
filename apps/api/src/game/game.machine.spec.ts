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
        roundActive: { faceoff: 'firstAnswer' },
      });

      actor.send({ type: 'BUZZ', teamId: 'home' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
    });

    it('the #1 answer wins control automatically for the buzz-winner', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'away' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 }); // 30 = top answer

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
      expect(snapshot.context.controllingTeam).toBe('away');
      expect(snapshot.context.boardBank).toBe(30);
    });

    it('both teams strike then bounce back until someone is correct', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });

      actor.send({ type: 'HOST_MARK_WRONG' }); // home strikes -> away's turn
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'secondAnswer' },
      });

      actor.send({ type: 'HOST_MARK_WRONG' }); // away strikes too -> bounceBack
      expect(actor.getSnapshot().context.answeringTeam).toBe('home');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'bounceBack' },
      });

      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 2 });
      expect(actor.getSnapshot().context.controllingTeam).toBe('home');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
    });

    it('a lower first answer is beaten by a higher second answer', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 2 }); // home: 10, not #1

      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'secondAnswer' },
      });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');

      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 1 }); // away: 20 > 10
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
      expect(snapshot.context.controllingTeam).toBe('away');
      expect(snapshot.context.boardBank).toBe(30); // both face-off answers banked
    });

    it('a lower second answer leaves control with the first team', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 1 }); // home: 20, not #1
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 2 }); // away: 10 < 20

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
      expect(snapshot.context.controllingTeam).toBe('home');
    });

    it('if the buzz-winner strikes, a correct second answer takes control', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_WRONG' }); // home strikes
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 1 }); // away answers

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { faceoff: 'controlDecision' },
      });
      expect(snapshot.context.controllingTeam).toBe('away');
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
      expect(snapshot.value).toEqual({ roundEnd: 'awaitingNextRound' });
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
        roundActive: { play: { steal: 'awaitingStealGuess' } },
      });
      expect(actor.getSnapshot().context.strikes).toBe(3);
    });

    it('a successful steal banks on confirm and awards the whole bank', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // home controls, boardBank=30 from the face-off

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: { steal: 'awaitingStealGuess' } },
      });

      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 }); // stage away's steal
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: { steal: 'confirmingSteal' } },
      });
      expect(actor.getSnapshot().context.teams.away.score).toBe(0); // not yet banked

      actor.send({ type: 'HOST_CONFIRM_STEAL' });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ roundEnd: 'revealingBoard' });
      expect(snapshot.context.teams.away.score).toBe(50); // (30 + 20) * 1
      expect(snapshot.context.teams.home.score).toBe(0);
      expect(snapshot.context.boardBank).toBe(0);
    });

    it('cancelling a staged steal rolls back the reveal and keeps the bank', () => {
      const actor = makeActor();
      startAndReachPlay(actor);

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 });
      actor.send({ type: 'HOST_CANCEL_STEAL' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { play: { steal: 'awaitingStealGuess' } },
      });
      expect(snapshot.context.currentQuestion?.answers[1].revealed).toBe(false);
      expect(snapshot.context.teams.away.score).toBe(0);
    });

    it('clicking an already-revealed slot during the steal does nothing', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // slot 0 already revealed from the face-off

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });

      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 0 }); // already revealed
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({
        roundActive: { play: { steal: 'awaitingStealGuess' } },
      });
      expect(snapshot.context.teams.away.score).toBe(0);
    });

    it('a failed steal leaves the bank with the controlling team', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // home controls, boardBank=30

      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' }); // steal attempt misses

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ roundEnd: 'revealingBoard' });
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
      expect(snapshot.context.roundNumber).toBe(2);
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

    it('requires the host to click through remaining slots before advancing', () => {
      const actor = makeActor();
      startAndReachPlay(actor); // home controls, slot 0 (30) revealed, boardBank=30

      // Strike out so the round ends with the board incomplete.
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' });
      actor.send({ type: 'HOST_STRIKE' }); // -> steal
      actor.send({ type: 'HOST_STRIKE' }); // steal misses -> roundEnd

      expect(actor.getSnapshot().value).toEqual({ roundEnd: 'revealingBoard' });

      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 });
      expect(actor.getSnapshot().value).toEqual({ roundEnd: 'revealingBoard' });
      expect(actor.getSnapshot().context.currentQuestion?.answers[1].revealed).toBe(
        true,
      );

      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 2 }); // board now complete
      expect(actor.getSnapshot().value).toEqual({ roundEnd: 'awaitingNextRound' });
    });
  });

  describe('point multipliers', () => {
    function clearBoardAsHome(actor: Actor<ReturnType<typeof createGameMachine>>) {
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 }); // #1 answer -> control
      actor.send({ type: 'PLAY', teamId: 'home' });
      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 });
      actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 2 }); // board complete
    }

    it('doubles in round 3 and triples in round 4', () => {
      const actor = makeActor();
      connectEveryone(actor);
      actor.send({ type: 'HOST_SET_TEAM_NAME', teamId: 'home', name: 'Home' });
      actor.send({ type: 'HOST_SET_TEAM_NAME', teamId: 'away', name: 'Away' });
      actor.send({ type: 'HOST_SET_TARGET_SCORE', targetScore: 100000 });
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });

      clearBoardAsHome(actor); // round 1: 60 * 1
      expect(actor.getSnapshot().context.teams.home.score).toBe(60);

      actor.send({ type: 'HOST_NEXT_ROUND', question: makeQuestion() });
      clearBoardAsHome(actor); // round 2: +60 * 1 => 120
      expect(actor.getSnapshot().context.teams.home.score).toBe(120);

      actor.send({ type: 'HOST_NEXT_ROUND', question: makeQuestion() });
      clearBoardAsHome(actor); // round 3: +60 * 2 => 240
      expect(actor.getSnapshot().context.teams.home.score).toBe(240);

      actor.send({ type: 'HOST_NEXT_ROUND', question: makeQuestion() });
      clearBoardAsHome(actor); // round 4: +60 * 3 => 420
      expect(actor.getSnapshot().context.teams.home.score).toBe(420);
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

  describe('host overrides', () => {
    it('HOST_AWARD_BUZZ assigns the buzz when no player buzzes', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });

      actor.send({ type: 'HOST_AWARD_BUZZ', teamId: 'away' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'firstAnswer' },
      });
    });

    it('HOST_PLAY drives play without a player client', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 });

      actor.send({ type: 'HOST_PLAY' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'awaitingGuess' },
      });
      expect(actor.getSnapshot().context.controllingTeam).toBe('home');
    });

    it('HOST_PASS flips control without a player client', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor);
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });
      actor.send({ type: 'HOST_OPEN_BUZZER' });
      actor.send({ type: 'BUZZ', teamId: 'home' });
      actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 });

      actor.send({ type: 'HOST_PASS' });
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { play: 'awaitingGuess' },
      });
      expect(actor.getSnapshot().context.controllingTeam).toBe('away');
    });
  });
});
