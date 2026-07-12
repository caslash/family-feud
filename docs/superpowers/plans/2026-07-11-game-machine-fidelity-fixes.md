# Game Machine Fidelity Fixes Implementation Plan (Spec A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `createGameMachine` closer to real Family Feud — highest-rank
face-off control, a confirmed/guarded steal, host overrides, round-end
click-through reveal, and point multipliers.

**Architecture:** All changes are to the single XState v5 machine in
`apps/api/src/game/` and its co-located `context`/`events`/`guards`/`actions`
files, following the existing `setup(...).createMachine(...)` pattern. Behavior
is exercised through `createActor(...).start()` in `game.machine.spec.ts`
(vitest). No gateway/UI code exists yet, so the machine + its unit tests are
the whole surface.

**Tech Stack:** TypeScript, XState v5 (`^5.32.4`), vitest (`^4.1.10`).

**Design spec:** `docs/superpowers/specs/2026-07-11-game-machine-fidelity-fixes-design.md`

## Global Constraints

- Package manager is npm workspaces; run everything from the repo root or with
  the exact per-package command shown. Never `npm install` inside `apps/api`.
- Test runner is **vitest**. Run the game tests from `apps/api/`:
  `npx vitest run src/game/game.machine.spec.ts` (add `-t "<name>"` to filter).
- XState v5 typing conventions already established in this codebase (copy them
  exactly):
  - Actions use `const gameAssign = assign<GameContext, GameEvent, undefined, GameEvent, never>;`
    and narrow the event with `assertEvent(event, '<TYPE>')`.
  - Guards are typed `({ context, event }: GameGuardArgs)` where
    `type GameGuardArgs = GuardArgs<GameContext, GameEvent>;`.
  - Every action/guard must be added to the exported `actions` / `guards`
    object literal at the bottom of its file, or `setup(...)` will not see it.
- `otherTeam(teamId)` helper already exists in `game.actions.ts`:
  `teamId === 'home' ? 'away' : 'home'`. Reuse it; do not redefine in the same
  file.
- "Rank"/"higher answer" means a higher `points` value. The `#1` answer is the
  answer with the maximum `points` on the board.
- Commit after every task with a passing test suite.

---

### Task 1: Round-end click-through reveal + per-round context foundation

Adds the three new context fields, restructures `roundEnd` into a
click-through board reveal followed by a win check, and renames `resetRound` to
`startNextRound` (which now increments `roundNumber` and clears the new
fields). Introduces the shared `isUnrevealedSlot` guard and `revealSlotOnly`
action used here and by Task 3.

**Files:**
- Modify: `apps/api/src/game/game.context.ts`
- Modify: `apps/api/src/game/game.guards.ts`
- Modify: `apps/api/src/game/game.actions.ts`
- Modify: `apps/api/src/game/game.machine.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Produces context fields: `roundNumber: number`,
  `faceoffPoints: Record<TeamId, number | null>`,
  `pendingStealSlot: number | null`.
- Produces guard `isUnrevealedSlot` and actions `revealSlotOnly`,
  `startNextRound` (replaces `resetRound`).

- [ ] **Step 1: Add the new context fields**

In `game.context.ts`, add to the `GameContext` interface (after `boardBank`):

```ts
  boardBank: number;
  roundNumber: number;
  faceoffPoints: Record<TeamId, number | null>;
  pendingStealSlot: number | null;
  winner: TeamId | null;
```

And in `initialGameContext`, after `boardBank: 0,`:

```ts
    boardBank: 0,
    roundNumber: 1,
    faceoffPoints: { home: null, away: null },
    pendingStealSlot: null,
    winner: null,
```

- [ ] **Step 2: Add the `isUnrevealedSlot` guard**

In `game.guards.ts`, add before the `guards` export:

```ts
const isUnrevealedSlot = ({ context, event }: GameGuardArgs): boolean => {
  assertEvent(event, 'HOST_REVEAL_ANSWER');
  const answer = context.currentQuestion?.answers[event.slotIndex];
  return !!answer && !answer.revealed;
};
```

Add `isUnrevealedSlot,` to the `guards` object.

- [ ] **Step 3: Add `revealSlotOnly` and replace `resetRound` with `startNextRound`**

In `game.actions.ts`, add `revealSlotOnly`:

```ts
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
```

Replace the existing `resetRound` with `startNextRound`:

```ts
const startNextRound = gameAssign(({ event }) => {
  assertEvent(event, 'HOST_NEXT_ROUND');
  return {
    strikes: 0,
    boardBank: 0,
    answeringTeam: null,
    controllingTeam: null,
    faceoffPoints: { home: null, away: null },
    pendingStealSlot: null,
    currentQuestion: normalizeQuestion(event.question),
  };
});
```

In the `actions` export object, remove `resetRound,` and add `revealSlotOnly,`
and `startNextRound,`.

Note: `startNextRound` does **not** set `roundNumber` here — that is added in
Step 4 so the increment and its test land together.

- [ ] **Step 4: Increment `roundNumber` in `startNextRound`**

In `game.actions.ts`, update `startNextRound` to add the increment. It needs
`context`, so change its signature:

```ts
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
```

- [ ] **Step 5: Restructure the `roundEnd` state**

In `game.machine.ts`, replace the entire `roundEnd` state block with:

```ts
      roundEnd: {
        initial: 'revealingBoard',
        states: {
          revealingBoard: {
            always: { guard: 'isBoardComplete', target: 'checkWin' },
            on: {
              HOST_REVEAL_ANSWER: {
                guard: 'isUnrevealedSlot',
                actions: 'revealSlotOnly',
              },
            },
          },
          checkWin: {
            always: [
              {
                guard: 'targetReached',
                actions: 'setWinner',
                target: '#game.gameOver',
              },
              { target: 'awaitingNextRound' },
            ],
          },
          awaitingNextRound: {
            on: {
              HOST_NEXT_ROUND: {
                actions: 'startNextRound',
                target: '#game.roundActive',
              },
            },
          },
        },
      },
```

- [ ] **Step 6: Update existing round-end tests for the new nested state values**

In `game.machine.spec.ts`, three existing tests assert `value` is the string
`'roundEnd'`; the round now resolves to a nested value. Update them:

In `play` → "clearing the board commits the bank to the controlling team, no
steal", change:

```ts
      expect(snapshot.value).toBe('roundEnd');
```

to:

```ts
      expect(snapshot.value).toEqual({ roundEnd: 'awaitingNextRound' });
```

In `play` → "a successful steal awards the whole bank to the stealing team"
and "a failed steal leaves the bank with the controlling team": these are
rewritten wholesale in Task 3 — leave them for now (they will still say
`toBe('roundEnd')` and fail after Task 3, not this task). To keep this task's
suite green, temporarily update both of their `expect(snapshot.value).toBe('roundEnd')`
lines to `expect(snapshot.value).toEqual({ roundEnd: 'revealingBoard' })`
(the board is incomplete after a steal, so the round parks in
`revealingBoard`).

In "round end and game over" → "HOST_NEXT_ROUND resets round state...": no
`value` assertion on `roundEnd` exists there (it asserts the post-next-round
value), so it is unaffected except that `HOST_NEXT_ROUND` is now only accepted
from `awaitingNextRound` — which is the state reached after a board-clear, so
it still works. Add one assertion after the existing ones:

```ts
      expect(snapshot.context.roundNumber).toBe(2);
```

- [ ] **Step 7: Add the click-through reveal test**

In the "round end and game over" describe block, add:

```ts
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
```

- [ ] **Step 8: Run the tests**

From `apps/api/`:

```bash
npx vitest run src/game/game.machine.spec.ts
```

Expected: PASS (all existing tests plus the new click-through test).

- [ ] **Step 9: Typecheck**

```bash
npx tsc -p tsconfig.build.json --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): round-end click-through reveal and per-round context"
```

---

### Task 2: Point multipliers

Adds the `roundMultiplier` helper and applies it to the controlling-team bank
commit. Rounds 1–2 ×1, round 3 ×2, round 4+ ×3.

**Files:**
- Modify: `apps/api/src/game/game.actions.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Produces `roundMultiplier(roundNumber: number): number` (module-local helper
  in `game.actions.ts`) applied inside `commitBankToController`.

- [ ] **Step 1: Write the failing multiplier test**

In `game.machine.spec.ts`, add a new describe block after "round end and game
over". It drives the game to round 3 and clears a board to check doubling.

```ts
  describe('point multipliers', () => {
    it('doubles the awarded bank in round 3', () => {
      const actor = makeActor();
      connectEveryone(actor);
      setUpTeams(actor); // targetScore = 100
      actor.send({ type: 'HOST_START_GAME', question: makeQuestion() });

      // Helper: win a round for `home` by clearing the board (slots 0,1,2).
      const clearBoardAsHome = () => {
        actor.send({ type: 'HOST_OPEN_BUZZER' });
        actor.send({ type: 'BUZZ', teamId: 'home' });
        actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 }); // #1 -> control
        actor.send({ type: 'PLAY', teamId: 'home' });
        actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 1 });
        actor.send({ type: 'HOST_REVEAL_ANSWER', slotIndex: 2 }); // board complete
      };

      clearBoardAsHome(); // round 1: 60 * 1 = 60
      expect(actor.getSnapshot().context.teams.home.score).toBe(60);
      actor.send({ type: 'HOST_NEXT_ROUND', question: makeQuestion() });

      clearBoardAsHome(); // round 2: +60 * 1 => but home already >= target after r1?
      // targetScore is 100; home hit 60 in r1, so r2 clear pushes to 120 and the
      // game would end. Use a fresh actor with a higher target instead:
      expect(actor.getSnapshot().context.roundNumber).toBeGreaterThan(0);
    });
  });
```

STOP — the naive approach above collides with `targetScore`. Replace the whole
block with this correct version that sets a high target so the game survives to
round 3:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

From `apps/api/`:

```bash
npx vitest run src/game/game.machine.spec.ts -t "doubles in round 3"
```

Expected: FAIL — score is 180 (all ×1) in round 3, not 240.

- [ ] **Step 3: Add the multiplier and apply it to the controller commit**

In `game.actions.ts`, add near the top (after `otherTeam`):

```ts
const roundMultiplier = (roundNumber: number): number =>
  roundNumber <= 2 ? 1 : roundNumber === 3 ? 2 : 3;
```

Replace `commitBankToController` with:

```ts
const commitBankToController = gameAssign(({ context }) => {
  if (!context.controllingTeam) return { boardBank: 0 };
  const team = context.controllingTeam;
  const award = context.boardBank * roundMultiplier(context.roundNumber);
  return {
    teams: {
      ...context.teams,
      [team]: {
        ...context.teams[team],
        score: context.teams[team].score + award,
      },
    },
    boardBank: 0,
  };
});
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/game/game.machine.spec.ts -t "doubles in round 3"
```

Expected: PASS.

- [ ] **Step 5: Run the full file + typecheck**

```bash
npx vitest run src/game/game.machine.spec.ts
npx tsc -p tsconfig.build.json --noEmit
```

Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): apply round point multipliers at bank commit"
```

---

### Task 3: Steal confirmation + unrevealed guard

Splits `steal` into `awaitingStealGuess` + `confirmingSteal`, defers banking to
an explicit `HOST_CONFIRM_STEAL`, guards the reveal so an already-revealed slot
can't win the steal, and applies the round multiplier to the stolen total.
Removes the now-unused `commitBankToStealer`.

**Files:**
- Modify: `apps/api/src/game/game.events.ts`
- Modify: `apps/api/src/game/game.actions.ts`
- Modify: `apps/api/src/game/game.machine.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Consumes: `pendingStealSlot` (Task 1), `roundMultiplier` (Task 2),
  `isUnrevealedSlot` (Task 1), `otherTeam` (existing).
- Produces: events `HOST_CONFIRM_STEAL`, `HOST_CANCEL_STEAL`; actions
  `stageStealReveal`, `commitSteal`, `cancelStealReveal`.

- [ ] **Step 1: Add the new events**

In `game.events.ts`, add to the `GameEvent` union:

```ts
  | { type: 'HOST_CONFIRM_STEAL' }
  | { type: 'HOST_CANCEL_STEAL' }
```

- [ ] **Step 2: Add the steal actions and remove `commitBankToStealer`**

In `game.actions.ts`, add:

```ts
const stageStealReveal = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_REVEAL_ANSWER');
  if (!context.currentQuestion) return {};
  const answer = context.currentQuestion.answers[event.slotIndex];
  if (!answer || answer.revealed) return {};
  const answers = context.currentQuestion.answers.map((a, index) =>
    index === event.slotIndex ? { ...a, revealed: true } : a,
  );
  return {
    currentQuestion: { ...context.currentQuestion, answers },
    pendingStealSlot: event.slotIndex,
  };
});

const commitSteal = gameAssign(({ context }) => {
  if (context.controllingTeam === null || context.pendingStealSlot === null) {
    return { boardBank: 0, pendingStealSlot: null };
  }
  const stealer = otherTeam(context.controllingTeam);
  const stolen = context.currentQuestion?.answers[context.pendingStealSlot];
  const stolenPoints = stolen ? stolen.points : 0;
  const award =
    (context.boardBank + stolenPoints) * roundMultiplier(context.roundNumber);
  return {
    teams: {
      ...context.teams,
      [stealer]: {
        ...context.teams[stealer],
        score: context.teams[stealer].score + award,
      },
    },
    boardBank: 0,
    pendingStealSlot: null,
  };
});

const cancelStealReveal = gameAssign(({ context }) => {
  if (!context.currentQuestion || context.pendingStealSlot === null) {
    return { pendingStealSlot: null };
  }
  const answers = context.currentQuestion.answers.map((a, index) =>
    index === context.pendingStealSlot ? { ...a, revealed: false } : a,
  );
  return {
    currentQuestion: { ...context.currentQuestion, answers },
    pendingStealSlot: null,
  };
});
```

Note: `stageStealReveal` banks nothing; `commitSteal` adds the stolen slot's
points to the bank at commit time, so cancel is a clean rollback.

Remove the `commitBankToStealer` function and its entry in the `actions`
export. Add `stageStealReveal,`, `commitSteal,`, `cancelStealReveal,` to the
`actions` export.

- [ ] **Step 3: Restructure the `steal` state**

In `game.machine.ts`, replace the `steal` state (a leaf under
`roundActive.play.states`) with a compound state:

```ts
              steal: {
                initial: 'awaitingStealGuess',
                states: {
                  awaitingStealGuess: {
                    on: {
                      HOST_REVEAL_ANSWER: {
                        guard: 'isUnrevealedSlot',
                        actions: 'stageStealReveal',
                        target: 'confirmingSteal',
                      },
                      HOST_STRIKE: {
                        actions: 'commitBankToController',
                        target: '#game.roundEnd',
                      },
                    },
                  },
                  confirmingSteal: {
                    on: {
                      HOST_CONFIRM_STEAL: {
                        actions: 'commitSteal',
                        target: '#game.roundEnd',
                      },
                      HOST_CANCEL_STEAL: {
                        actions: 'cancelStealReveal',
                        target: 'awaitingStealGuess',
                      },
                    },
                  },
                },
              },
```

(The `checkingProgress.always` transition `{ guard: 'reachedMaxStrikes',
target: 'steal' }` is unchanged — it now enters `steal.awaitingStealGuess`.)

- [ ] **Step 4: Rewrite the steal tests**

In `game.machine.spec.ts`, replace the two existing steal tests ("a successful
steal awards the whole bank to the stealing team" and "a failed steal leaves
the bank with the controlling team") with:

```ts
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
```

Also, in the Task 1 change you temporarily set both steal tests' value
expectations to `{ roundEnd: 'revealingBoard' }` — this rewrite supersedes
them, so just ensure the two old tests are gone.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/game/game.machine.spec.ts
npx tsc -p tsconfig.build.json --noEmit
```

Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): confirmed, guarded steal with multiplier"
```

---

### Task 4: Face-off decided by the highest-ranked answer

Replaces `answerPending` (first-correct-wins) with the head-to-head:
`firstAnswer` → `secondAnswer` → (`controlDecision` | `bounceBack`). Adds the
`HOST_AWARD_BUZZ` host override on the buzzer. This is the largest task.

**Files:**
- Modify: `apps/api/src/game/game.events.ts`
- Modify: `apps/api/src/game/game.guards.ts`
- Modify: `apps/api/src/game/game.actions.ts`
- Modify: `apps/api/src/game/game.machine.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Consumes: `faceoffPoints` (Task 1), `otherTeam`, `revealSlotAndBank`,
  `takeControl`, `flipAnsweringTeam`, `setAnsweringTeam` (existing).
- Produces: event `HOST_AWARD_BUZZ`; guards `isTopAnswer`, `secondBeatsFirst`,
  `firstTeamHasAnswer`; actions `recordFaceoffAnswer`, `giveControlToOther`,
  `awardBuzz`.

- [ ] **Step 1: Add the `HOST_AWARD_BUZZ` event**

In `game.events.ts`, add to the union:

```ts
  | { type: 'HOST_AWARD_BUZZ'; teamId: TeamId }
```

- [ ] **Step 2: Add the face-off guards**

In `game.guards.ts`, add before the `guards` export:

```ts
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
```

Add `isTopAnswer,`, `secondBeatsFirst,`, `firstTeamHasAnswer,` to `guards`.

Note: in `secondAnswer`, `answeringTeam` has been flipped to the **second**
team, so `firstTeam = otherTeam(answeringTeam)`.

- [ ] **Step 3: Add the face-off actions**

In `game.actions.ts`, add:

```ts
const recordFaceoffAnswer = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_MARK_CORRECT');
  if (context.answeringTeam === null || !context.currentQuestion) return {};
  const answer = context.currentQuestion.answers[event.slotIndex];
  if (!answer) return {};
  return {
    faceoffPoints: {
      ...context.faceoffPoints,
      [context.answeringTeam]: answer.points,
    },
  };
});

const giveControlToOther = gameAssign(({ context }) => {
  return {
    controllingTeam: context.answeringTeam
      ? otherTeam(context.answeringTeam)
      : null,
  };
});

const awardBuzz = gameAssign(({ event }) => {
  assertEvent(event, 'HOST_AWARD_BUZZ');
  return { answeringTeam: event.teamId };
});
```

Add `recordFaceoffAnswer,`, `giveControlToOther,`, `awardBuzz,` to `actions`.

- [ ] **Step 4: Rebuild the `faceoff` state**

In `game.machine.ts`, replace the entire `faceoff` state block with:

```ts
          faceoff: {
            initial: 'ready',
            states: {
              ready: {
                on: { HOST_OPEN_BUZZER: 'buzzerOpen' },
              },
              buzzerOpen: {
                on: {
                  BUZZ: { actions: 'setAnsweringTeam', target: 'firstAnswer' },
                  HOST_AWARD_BUZZ: {
                    actions: 'awardBuzz',
                    target: 'firstAnswer',
                  },
                },
              },
              firstAnswer: {
                on: {
                  HOST_MARK_CORRECT: [
                    {
                      guard: 'isTopAnswer',
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'takeControl',
                      ],
                      target: 'controlDecision',
                    },
                    {
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'flipAnsweringTeam',
                      ],
                      target: 'secondAnswer',
                    },
                  ],
                  HOST_MARK_WRONG: {
                    actions: 'flipAnsweringTeam',
                    target: 'secondAnswer',
                  },
                },
              },
              secondAnswer: {
                on: {
                  HOST_MARK_CORRECT: [
                    {
                      guard: 'secondBeatsFirst',
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'takeControl',
                      ],
                      target: 'controlDecision',
                    },
                    {
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'giveControlToOther',
                      ],
                      target: 'controlDecision',
                    },
                  ],
                  HOST_MARK_WRONG: [
                    {
                      guard: 'firstTeamHasAnswer',
                      actions: 'giveControlToOther',
                      target: 'controlDecision',
                    },
                    {
                      actions: 'flipAnsweringTeam',
                      target: 'bounceBack',
                    },
                  ],
                },
              },
              bounceBack: {
                on: {
                  HOST_MARK_CORRECT: {
                    actions: ['revealSlotAndBank', 'takeControl'],
                    target: 'controlDecision',
                  },
                  HOST_MARK_WRONG: { actions: 'flipAnsweringTeam' },
                },
              },
              controlDecision: {
                on: {
                  PLAY: {
                    guard: 'isDecidingTeam',
                    target: '#game.roundActive.play',
                  },
                  PASS: {
                    guard: 'isDecidingTeam',
                    actions: 'flipControl',
                    target: '#game.roundActive.play',
                  },
                },
              },
            },
          },
```

(`HOST_PLAY` / `HOST_PASS` are added to `controlDecision` in Task 5.)

- [ ] **Step 5: Update the existing face-off tests**

In `game.machine.spec.ts`, the `face-off` describe block references the old
`answerPending` state and first-correct-wins semantics. Make these edits:

"the first BUZZ wins; a later BUZZ is a no-op": change both
`{ roundActive: { faceoff: 'answerPending' } }` — but this test only asserts
`answeringTeam` after the second BUZZ and one value. Update the value
assertion:

```ts
      actor.send({ type: 'BUZZ', teamId: 'away' });
      expect(actor.getSnapshot().context.answeringTeam).toBe('away');
      expect(actor.getSnapshot().value).toEqual({
        roundActive: { faceoff: 'firstAnswer' },
      });
```

"HOST_MARK_CORRECT reveals the slot, banks points, and hands control to the
answering team": this used slot 1 (not #1) and expected immediate control.
Replace it entirely with a test of the #1-answer automatic path:

```ts
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
```

"HOST_MARK_WRONG bounces the answer back and forth until someone is correct":
the intermediate state names changed. Replace with:

```ts
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
```

The "controlDecision: only the deciding team may PLAY or PASS" and "PASS flips
control to the other team" tests both use `HOST_MARK_CORRECT` slot 0 (the #1
answer), so they still reach `controlDecision` and require no change.

- [ ] **Step 6: Add head-to-head comparison tests**

Add these to the `face-off` describe block:

```ts
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
```

- [ ] **Step 7: Run the tests**

```bash
npx vitest run src/game/game.machine.spec.ts
npx tsc -p tsconfig.build.json --noEmit
```

Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): face-off decided by highest-ranked answer"
```

---

### Task 5: Host overrides for play/pass

Adds `HOST_PLAY` / `HOST_PASS` on `controlDecision` (the `HOST_AWARD_BUZZ`
override was added in Task 4), removing the disconnect deadlock.

**Files:**
- Modify: `apps/api/src/game/game.events.ts`
- Modify: `apps/api/src/game/game.machine.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Consumes: `flipControl` (existing), `controllingTeam`.
- Produces: events `HOST_PLAY`, `HOST_PASS`.

- [ ] **Step 1: Write the failing host-override tests**

In `game.machine.spec.ts`, add a describe block:

```ts
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/game/game.machine.spec.ts -t "host overrides"
```

Expected: FAIL — `HOST_PLAY` / `HOST_PASS` are unknown events (no transition).
(`HOST_AWARD_BUZZ` already passes from Task 4.)

- [ ] **Step 3: Add the events**

In `game.events.ts`, add to the union:

```ts
  | { type: 'HOST_PLAY' }
  | { type: 'HOST_PASS' }
```

- [ ] **Step 4: Wire the overrides into `controlDecision`**

In `game.machine.ts`, in the `controlDecision` state's `on`, add after `PASS`:

```ts
                  HOST_PLAY: { target: '#game.roundActive.play' },
                  HOST_PASS: {
                    actions: 'flipControl',
                    target: '#game.roundActive.play',
                  },
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/game/game.machine.spec.ts
npx tsc -p tsconfig.build.json --noEmit
```

Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): host overrides for buzz and play/pass"
```

---

## Self-Review

**Spec coverage:**
- Face-off highest-rank (spec §1) → Task 4. #1 auto-control, higher-wins,
  strike, double-strike bounce-back all tested.
- Steal confirmation + `isUnrevealedSlot` (spec §2) → Task 3 (guard defined in
  Task 1). Confirm/cancel/already-revealed all tested.
- Host overrides (spec §3) → `HOST_AWARD_BUZZ` in Task 4, `HOST_PLAY`/`HOST_PASS`
  in Task 5.
- Round-end click-through (spec §4) → Task 1.
- Point multipliers (spec §5a) → Task 2, plus `commitSteal` multiplier in
  Task 3.
- Context/events/guards/actions additions → distributed across the tasks that
  first use them; all appear in an exported `actions`/`guards` object or the
  `GameEvent` union.

**Type consistency:** `startNextRound` (not `resetRound`) is used in Task 1's
machine wiring and defined in Task 1. `commitBankToStealer` is removed in Task
3 and no longer referenced. `roundMultiplier` defined in Task 2 is consumed by
`commitSteal` in Task 3 (Task 3 depends on Task 2 — keep this order). All guard
names (`isTopAnswer`, `secondBeatsFirst`, `firstTeamHasAnswer`,
`isUnrevealedSlot`) match between definition and machine wiring.

**Ordering dependency:** Tasks must run 1 → 2 → 3 → 4 → 5. Task 3's
`commitSteal` uses Task 2's `roundMultiplier`; Task 1's `startNextRound` resets
fields consumed by Tasks 3 and 4.

**Note for the implementer:** `game.machine.ts` currently still has
`gameOver: {}` and `closed: { type: 'final' }` at the top level — leave both
unchanged. Spec B retargets the `checkWin` win branch into a new `fastMoney`
state; that is a separate plan.
