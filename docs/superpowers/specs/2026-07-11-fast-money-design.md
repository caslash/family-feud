# Fast Money — Design (Spec B)

Date: 2026-07-11

## Purpose

Add the Fast Money endgame to `createGameMachine`. This is the second of two
specs; it builds directly on the game-machine fidelity fixes (Spec A,
`2026-07-11-game-machine-fidelity-fixes-design.md`) and should land after it.

In the real show, the team that reaches the target score sends two players to
Fast Money: player 1 answers 5 rapid questions in isolation, then player 2
answers the same 5 (without duplicating player 1), and a combined total of
**≥ 200** wins the grand prize. Following the rest of this game, Fast Money is
host-mediated — there is no fuzzy answer matching.

## Trigger & coupling to Spec A

Spec A's `roundEnd.checkWin` does
`targetReached → setWinner → #game.gameOver`. Spec B **redirects that single
transition** to `targetReached → setWinner → #game.fastMoney`. The winning
team then plays Fast Money, and the terminal `gameOver` reports both the
main-game winner (`winner`) and whether the grand prize was won
(`fastMoney.won`).

This one retargeted transition is the entire coupling between the two specs.

## Sub-machine

```
fastMoney
├─ setup            HOST_START_FAST_MONEY{questions} → startFastMoney → player1.answering
├─ player1
│  ├─ answering      after 15000  |  HOST_FM_END_ANSWERING  → entry
│  ├─ entry          HOST_FM_SUBMIT_ANSWERS{slots}          → reveal   (actions: submitPlayer1)
│  └─ reveal         HOST_FM_CONTINUE                       → #game.fastMoney.player2.answering
├─ player2
│  ├─ answering      after 20000  |  HOST_FM_END_ANSWERING  → entry
│  └─ entry          HOST_FM_SUBMIT_ANSWERS{slots}          → #game.fastMoney.tally  (actions: submitPlayer2)
└─ tally            entry: tallyFastMoney ; always → #game.gameOver
```

- `setup` — Fast Money is entered automatically on the main-game win. The host
  then supplies the 5 Fast Money questions via `HOST_START_FAST_MONEY` to
  begin.
- `answering` — a timed window (15s for player 1, 20s for player 2) during
  which the player speaks their answers aloud; nothing is recorded yet. The
  machine's delayed transition closes the window automatically, or the host
  can close it early with `HOST_FM_END_ANSWERING` (e.g. the player finished).
- `entry` — untimed. The host enters that player's 5 answers (see below) and
  submits them.
- `player1.reveal` — a host-paced pause so player 1's answers can be revealed
  before player 2 returns. Advanced with `HOST_FM_CONTINUE`.
- `tally` — computes the combined total and win result on entry, then
  transitions to the terminal `gameOver`.

## How answers are entered & scored

After each `answering` window closes, the host enters the player's 5 answers.
For each of the 5 questions the host either **matches the spoken answer to one
of that question's board answers** — which supplies its point value — or
**marks "no points"** (`null`). A submission is therefore:

```ts
HOST_FM_SUBMIT_ANSWERS { slots: (number | null)[] }   // length 5
```

where each element is a slot index into `fastMoney.questions[i].answers`, or
`null` for no match. Points are derived from
`fastMoney.questions[i].answers[slot].points`. (Host typing is just the UI
affordance for finding the matching board answer; the machine stores the slot
index.)

## Duplicate rule

A player-2 answer that matches player-1's answer for the **same question**
(identical, non-null slot index) scores **0** in the tally — computed
automatically, with no rejection and no dedicated guard. This mirrors the
show's "you already said that" without the machine having to police live
re-entry; the live "try again" already happened before the host types.

## Win condition

```
total = Σ over both players of (slot === null ? 0 : questions[i].answers[slot].points)
        with any player-2 slot equal to player-1's same-question slot counted as 0
won   = total >= 200
```

`won` is fixed at a 200-point threshold. It is recorded on `fastMoney.won`
and broadcast by `gameOver`.

## Additions at a glance

- **Context** (`game.context.ts`) — one nested field, `null` until Fast Money
  starts:
  ```ts
  fastMoney: {
    questions: Question[];
    player1: (number | null)[];
    player2: (number | null)[];
    total: number;
    won: boolean | null;
  } | null
  ```
  Initialized to `null` in `initialGameContext`.
- **Events** (`game.events.ts`):
  - `{ type: 'HOST_START_FAST_MONEY'; questions: Question[] }`
  - `{ type: 'HOST_FM_END_ANSWERING' }`
  - `{ type: 'HOST_FM_SUBMIT_ANSWERS'; slots: (number | null)[] }`
  - `{ type: 'HOST_FM_CONTINUE' }`
- **Actions** (`game.actions.ts`):
  - `startFastMoney` — set `fastMoney` from `event.questions` with empty
    player arrays, `total: 0`, `won: null`.
  - `submitPlayer1` — set `fastMoney.player1 = event.slots`.
  - `submitPlayer2` — set `fastMoney.player2 = event.slots`.
  - `tallyFastMoney` — compute `total` (with player-2 duplicate slots zeroed)
    and set `won = total >= 200`.
- **Delayed transitions:** `after: { 15000: ... }` in `player1.answering`,
  `after: { 20000: ... }` in `player2.answering`.
- **Guards:** none new.
- **State machine (`game.machine.ts`):** add the `fastMoney` compound state;
  retarget `roundEnd.checkWin`'s win branch from `#game.gameOver` to
  `#game.fastMoney`.

## Machine-level notes

- `HOST_FM_SUBMIT_ANSWERS` is handled in both `player1.entry` and
  `player2.entry` with different actions (`submitPlayer1` vs `submitPlayer2`);
  the current state disambiguates, as with `HOST_REVEAL_ANSWER` in Spec A.
- The global host-disconnect teardown (`CLIENT_DISCONNECTED` + `isHostRole` →
  `closed`) continues to apply throughout Fast Money.
- Expected `questions` length is 5; the machine does not hard-fail on other
  lengths — the tally sums whatever is present — but the host UI supplies 5.

## Testing

- `setup → player1` starts on `HOST_START_FAST_MONEY` and loads the questions.
- Timer auto-closes `answering` at 15s / 20s (fake timers); `HOST_FM_END_ANSWERING`
  closes it early.
- `submitPlayer1` / `submitPlayer2` record slot arrays; points derive from the
  loaded questions.
- Duplicate player-2 slot scores 0; distinct answers sum normally.
- `total ≥ 200 → won`, `< 200 → lost`; both terminate at `gameOver` with
  `winner` and `fastMoney.won` set.
- Reaching the main-game target routes into `fastMoney`, not straight to
  `gameOver`.
