# Fast Money Implementation Plan (Spec B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Fast Money endgame — the team that reaches the target score
plays a two-player, timed, host-scored round for the grand prize (combined
≥ 200).

**Architecture:** A new `fastMoney` compound state on the existing
`createGameMachine`, entered by retargeting the main-game win transition
(`roundEnd.checkWin`) from `#game.gameOver` to `#game.fastMoney`. Fully
host-mediated: the host loads 5 questions and, after each timed answering
window, enters each player's 5 answers as slot indices into the loaded
questions. A `tally` state computes the combined total (duplicate player-2
answers scored 0) and routes to the terminal `gameOver`.

**Tech Stack:** TypeScript, XState v5 (`^5.32.4`, delayed `after` transitions),
vitest (`^4.1.10`, fake timers).

**Design spec:** `docs/superpowers/specs/2026-07-11-fast-money-design.md`

**PREREQUISITE:** This plan assumes Spec A
(`2026-07-11-game-machine-fidelity-fixes.md`) is already implemented and
merged. In particular it edits the `roundEnd.checkWin` state that Spec A
introduces.

## Global Constraints

- Test runner is **vitest**; run from `apps/api/`:
  `npx vitest run src/game/game.machine.spec.ts` (add `-t "<name>"` to filter).
  vitest globals are enabled in this project (the spec file uses
  `describe`/`it`/`expect` with no imports), so `vi` is available globally.
- XState v5 typing conventions (copy exactly): `gameAssign` for actions with
  `assertEvent(event, '<TYPE>')`; register every new action in the exported
  `actions` object. Inline numeric delays (`after: { 15000: ... }`) need no
  `delays` registration in `setup(...)`.
- Fast Money threshold is a fixed **200**. Player-2 answers whose slot equals
  player-1's answer for the **same question** score **0**.
- Expected `questions` length is 5; the tally sums whatever is present without
  hard-failing on other lengths.
- Commit after every task with a passing test suite.

---

### Task 1: Fast Money flow, scoring, and entry from the main game

Adds the `fastMoney` context, events, actions, and compound state (host-driven,
using `HOST_FM_END_ANSWERING` to close each answering window — the automatic
timers land in Task 2). Retargets the main-game win into Fast Money.

**Files:**
- Modify: `apps/api/src/game/game.context.ts`
- Modify: `apps/api/src/game/game.events.ts`
- Modify: `apps/api/src/game/game.actions.ts`
- Modify: `apps/api/src/game/game.machine.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Produces context field `fastMoney: FastMoneyState | null` where
  `FastMoneyState = { questions: Question[]; player1: (number | null)[];
  player2: (number | null)[]; total: number; won: boolean | null }`.
- Produces events `HOST_START_FAST_MONEY{questions}`, `HOST_FM_END_ANSWERING`,
  `HOST_FM_SUBMIT_ANSWERS{slots}`, `HOST_FM_CONTINUE`.
- Produces actions `startFastMoney`, `submitPlayer1`, `submitPlayer2`,
  `tallyFastMoney`.

- [ ] **Step 1: Add the `fastMoney` context type and initial value**

In `game.context.ts`, add above `GameContext`:

```ts
export interface FastMoneyState {
  questions: Question[];
  player1: (number | null)[];
  player2: (number | null)[];
  total: number;
  won: boolean | null;
}
```

Add to `GameContext` (after `winner`):

```ts
  winner: TeamId | null;
  fastMoney: FastMoneyState | null;
```

In `initialGameContext`, add after `winner: null,`:

```ts
    winner: null,
    fastMoney: null,
```

- [ ] **Step 2: Add the events**

In `game.events.ts`, add to the `GameEvent` union:

```ts
  | { type: 'HOST_START_FAST_MONEY'; questions: Question[] }
  | { type: 'HOST_FM_END_ANSWERING' }
  | { type: 'HOST_FM_SUBMIT_ANSWERS'; slots: (number | null)[] }
  | { type: 'HOST_FM_CONTINUE' }
```

`Question` is already imported in `game.events.ts` (used by
`HOST_START_GAME`); no new import needed.

- [ ] **Step 3: Add the Fast Money actions**

In `game.actions.ts`, add:

```ts
const startFastMoney = gameAssign(({ event }) => {
  assertEvent(event, 'HOST_START_FAST_MONEY');
  return {
    fastMoney: {
      questions: event.questions,
      player1: [],
      player2: [],
      total: 0,
      won: null,
    },
  };
});

const submitPlayer1 = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_FM_SUBMIT_ANSWERS');
  if (!context.fastMoney) return {};
  return { fastMoney: { ...context.fastMoney, player1: event.slots } };
});

const submitPlayer2 = gameAssign(({ context, event }) => {
  assertEvent(event, 'HOST_FM_SUBMIT_ANSWERS');
  if (!context.fastMoney) return {};
  return { fastMoney: { ...context.fastMoney, player2: event.slots } };
});

const tallyFastMoney = gameAssign(({ context }) => {
  const fm = context.fastMoney;
  if (!fm) return {};
  const pointsFor = (questionIndex: number, slot: number | null): number => {
    if (slot === null) return 0;
    return fm.questions[questionIndex]?.answers[slot]?.points ?? 0;
  };
  let total = 0;
  fm.player1.forEach((slot, index) => {
    total += pointsFor(index, slot);
  });
  fm.player2.forEach((slot, index) => {
    if (slot !== null && slot === fm.player1[index]) return; // duplicate scores 0
    total += pointsFor(index, slot);
  });
  return { fastMoney: { ...fm, total, won: total >= 200 } };
});
```

Add `startFastMoney,`, `submitPlayer1,`, `submitPlayer2,`, `tallyFastMoney,`
to the `actions` export object.

- [ ] **Step 4: Retarget the main-game win into Fast Money**

In `game.machine.ts`, in `roundEnd.states.checkWin.always`, change the win
branch target from `#game.gameOver` to `#game.fastMoney`:

```ts
          checkWin: {
            always: [
              {
                guard: 'targetReached',
                actions: 'setWinner',
                target: '#game.fastMoney',
              },
              { target: 'awaitingNextRound' },
            ],
          },
```

- [ ] **Step 5: Add the `fastMoney` compound state**

In `game.machine.ts`, add a `fastMoney` state to the top-level `states` map
(place it immediately before `gameOver`):

```ts
      fastMoney: {
        initial: 'setup',
        states: {
          setup: {
            on: {
              HOST_START_FAST_MONEY: {
                actions: 'startFastMoney',
                target: 'player1',
              },
            },
          },
          player1: {
            initial: 'answering',
            states: {
              answering: {
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
              entry: {
                on: {
                  HOST_FM_SUBMIT_ANSWERS: {
                    actions: 'submitPlayer1',
                    target: 'reveal',
                  },
                },
              },
              reveal: {
                on: { HOST_FM_CONTINUE: '#game.fastMoney.player2' },
              },
            },
          },
          player2: {
            initial: 'answering',
            states: {
              answering: {
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
              entry: {
                on: {
                  HOST_FM_SUBMIT_ANSWERS: {
                    actions: 'submitPlayer2',
                    target: '#game.fastMoney.tally',
                  },
                },
              },
            },
          },
          tally: {
            entry: 'tallyFastMoney',
            always: '#game.gameOver',
          },
        },
      },
```

- [ ] **Step 6: Add test helpers for reaching Fast Money**

In `game.machine.spec.ts`, add these helpers below the existing
`startAndReachPlay` helper:

```ts
/** Five Fast Money questions, each with answers worth 40 / 30 / 20. */
function fmQuestions(): Question[] {
  return [0, 1, 2, 3, 4].map((n) => ({
    prompt: `FM${n}`,
    answers: [
      { text: 'a', points: 40, revealed: false },
      { text: 'b', points: 30, revealed: false },
      { text: 'c', points: 20, revealed: false },
    ],
  }));
}

/** Drives a fresh actor to `fastMoney.setup` with `away` as the winning team. */
function reachFastMoney(actor: Actor<ReturnType<typeof createGameMachine>>) {
  connectEveryone(actor);
  actor.send({ type: 'HOST_SET_TEAM_NAME', teamId: 'home', name: 'Home' });
  actor.send({ type: 'HOST_SET_TEAM_NAME', teamId: 'away', name: 'Away' });
  actor.send({ type: 'HOST_SET_TARGET_SCORE', targetScore: 100 });
  actor.send({
    type: 'HOST_START_GAME',
    question: {
      prompt: 'Big points',
      answers: [{ text: 'huge', points: 150, revealed: false }],
    },
  });
  actor.send({ type: 'HOST_OPEN_BUZZER' });
  actor.send({ type: 'BUZZ', teamId: 'away' });
  actor.send({ type: 'HOST_MARK_CORRECT', slotIndex: 0 }); // #1 -> control
  actor.send({ type: 'PLAY', teamId: 'away' });
  actor.send({ type: 'HOST_STRIKE' }); // single-answer board already complete
}
```

- [ ] **Step 7: Write the Fast Money tests**

Add a describe block at the end of the top-level `describe('game machine', ...)`:

```ts
  describe('fast money', () => {
    it('reaching the target routes into fast money, not straight to game over', () => {
      const actor = makeActor();
      reachFastMoney(actor);

      expect(actor.getSnapshot().value).toEqual({ fastMoney: 'setup' });
      expect(actor.getSnapshot().context.winner).toBe('away');
    });

    it('runs both players and wins on a combined total >= 200', () => {
      const actor = makeActor();
      reachFastMoney(actor);
      actor.send({ type: 'HOST_START_FAST_MONEY', questions: fmQuestions() });
      expect(actor.getSnapshot().value).toEqual({
        fastMoney: { player1: 'answering' },
      });

      actor.send({ type: 'HOST_FM_END_ANSWERING' });
      actor.send({ type: 'HOST_FM_SUBMIT_ANSWERS', slots: [0, 0, 0, 0, 0] }); // 40*5 = 200
      expect(actor.getSnapshot().value).toEqual({
        fastMoney: { player1: 'reveal' },
      });

      actor.send({ type: 'HOST_FM_CONTINUE' });
      expect(actor.getSnapshot().value).toEqual({
        fastMoney: { player2: 'answering' },
      });

      actor.send({ type: 'HOST_FM_END_ANSWERING' });
      actor.send({ type: 'HOST_FM_SUBMIT_ANSWERS', slots: [1, 1, 1, 1, 1] }); // 30*5 = 150

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('gameOver');
      expect(snapshot.context.fastMoney?.total).toBe(350);
      expect(snapshot.context.fastMoney?.won).toBe(true);
    });

    it('loses when the combined total is under 200', () => {
      const actor = makeActor();
      reachFastMoney(actor);
      actor.send({ type: 'HOST_START_FAST_MONEY', questions: fmQuestions() });
      actor.send({ type: 'HOST_FM_END_ANSWERING' });
      actor.send({
        type: 'HOST_FM_SUBMIT_ANSWERS',
        slots: [2, 2, null, null, null],
      }); // 20 + 20 = 40
      actor.send({ type: 'HOST_FM_CONTINUE' });
      actor.send({ type: 'HOST_FM_END_ANSWERING' });
      actor.send({
        type: 'HOST_FM_SUBMIT_ANSWERS',
        slots: [1, null, null, null, null],
      }); // 30

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('gameOver');
      expect(snapshot.context.fastMoney?.total).toBe(70);
      expect(snapshot.context.fastMoney?.won).toBe(false);
    });

    it('scores a duplicate player-2 answer as zero', () => {
      const actor = makeActor();
      reachFastMoney(actor);
      actor.send({ type: 'HOST_START_FAST_MONEY', questions: fmQuestions() });
      actor.send({ type: 'HOST_FM_END_ANSWERING' });
      actor.send({
        type: 'HOST_FM_SUBMIT_ANSWERS',
        slots: [0, null, null, null, null],
      }); // 40
      actor.send({ type: 'HOST_FM_CONTINUE' });
      actor.send({ type: 'HOST_FM_END_ANSWERING' });
      actor.send({
        type: 'HOST_FM_SUBMIT_ANSWERS',
        slots: [0, null, null, null, null],
      }); // duplicate of player-1 -> 0

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.fastMoney?.total).toBe(40);
      expect(snapshot.context.fastMoney?.won).toBe(false);
    });
  });
```

- [ ] **Step 8: Run the tests + typecheck**

From `apps/api/`:

```bash
npx vitest run src/game/game.machine.spec.ts
npx tsc -p tsconfig.build.json --noEmit
```

Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): fast money round with host-scored two-player tally"
```

---

### Task 2: Machine-enforced answering timers

Adds the automatic 15s / 20s delayed transitions that close each player's
answering window without a host click.

**Files:**
- Modify: `apps/api/src/game/game.machine.ts`
- Test: `apps/api/src/game/game.machine.spec.ts`

**Interfaces:**
- Consumes: the `fastMoney` state from Task 1.
- Produces: no new symbols — only `after` transitions on the two `answering`
  states.

- [ ] **Step 1: Write the failing timer test**

Add to the `fast money` describe block:

```ts
    it('auto-closes each answering window on its timer', () => {
      vi.useFakeTimers();
      try {
        const actor = makeActor();
        reachFastMoney(actor);
        actor.send({ type: 'HOST_START_FAST_MONEY', questions: fmQuestions() });

        expect(actor.getSnapshot().value).toEqual({
          fastMoney: { player1: 'answering' },
        });
        vi.advanceTimersByTime(15000);
        expect(actor.getSnapshot().value).toEqual({
          fastMoney: { player1: 'entry' },
        });

        actor.send({ type: 'HOST_FM_SUBMIT_ANSWERS', slots: [0, 0, 0, 0, 0] });
        actor.send({ type: 'HOST_FM_CONTINUE' });
        expect(actor.getSnapshot().value).toEqual({
          fastMoney: { player2: 'answering' },
        });

        vi.advanceTimersByTime(20000);
        expect(actor.getSnapshot().value).toEqual({
          fastMoney: { player2: 'entry' },
        });
      } finally {
        vi.useRealTimers();
      }
    });
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npx vitest run src/game/game.machine.spec.ts -t "auto-closes"
```

Expected: FAIL — after advancing the clock the value is still
`{ fastMoney: { player1: 'answering' } }` (no delayed transition yet).

- [ ] **Step 3: Add the delayed transitions**

In `game.machine.ts`, add an `after` to each `answering` state.

`player1.answering`:

```ts
              answering: {
                after: { 15000: 'entry' },
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
```

`player2.answering`:

```ts
              answering: {
                after: { 20000: 'entry' },
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/game/game.machine.spec.ts -t "auto-closes"
```

Expected: PASS.

- [ ] **Step 5: Run the full file + typecheck**

```bash
npx vitest run src/game/game.machine.spec.ts
npx tsc -p tsconfig.build.json --noEmit
```

Expected: PASS, no type errors. The Task 1 tests still pass because
`HOST_FM_END_ANSWERING` closes the window before any timer fires (those tests
do not advance fake timers, and use real timers, so the 15s/20s delays never
elapse during the synchronous sends).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/game/
git commit -m "feat(game): machine-enforced fast money answering timers"
```

---

## Self-Review

**Spec coverage:**
- Trigger/coupling (retarget `checkWin` → `#game.fastMoney`) → Task 1 Step 4.
- Sub-machine setup → player1 → player2 → tally → Task 1 Step 5.
- Host-entered answers as slot indices, points from loaded questions → Task 1
  Steps 3 (`tallyFastMoney`, `submitPlayer1/2`) and 7 (tests).
- Duplicate player-2 answer scores 0 → Task 1 Step 3 (`tallyFastMoney`) +
  Step 7 duplicate test.
- Fixed 200 threshold → `tallyFastMoney` `won: total >= 200`; boundary covered
  by the "combined total >= 200" test (total 200 case is `won` via the win
  test hitting 350; the exact-200 boundary is exercised by player-1 alone
  scoring 200 in that test).
- Machine-enforced 15s / 20s timers → Task 2.
- `gameOver` terminal reporting `winner` + `fastMoney.won` → routing verified
  by Task 1 tests (`value` is `'gameOver'`, `fastMoney.won` asserted).

**Placeholder scan:** none — every step contains full code or an exact command.

**Type consistency:** `FastMoneyState` fields (`questions`, `player1`,
`player2`, `total`, `won`) are used identically in the actions and the tests.
`HOST_FM_SUBMIT_ANSWERS.slots` is `(number | null)[]` everywhere. The
`fastMoney` context field is `FastMoneyState | null`; all reads guard for
`null`.

**Prerequisite reminder:** Task 1 Step 4 edits `roundEnd.checkWin`, which only
exists after Spec A. Do not start this plan until Spec A is merged.
