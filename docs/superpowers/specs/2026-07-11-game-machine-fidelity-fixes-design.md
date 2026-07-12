# Game Machine Fidelity Fixes — Design (Spec A)

Date: 2026-07-11

## Purpose

Bring the existing `createGameMachine` (XState v5) closer to how Family Feud
actually plays, and close two real correctness/robustness bugs. This is the
first of two specs; Fast Money is designed separately (Spec B) and builds on
the `gameOver` transition changed here.

Scope (six asks, minus Fast Money):

1. Face-off control decided by the **highest-ranked answer**, not the first
   correct answer.
2. Steal requires a **host confirmation** step and can no longer be won by
   clicking an already-revealed slot.
3. **Host overrides** for every player-gated moment (fixes disconnect
   deadlocks).
4. **Click-through board reveal** at the end of a round.
5. **Point multipliers**: rounds 1–2 ×1, round 3 ×2, round 4+ ×3.

Out of scope: Fast Money (Spec B).

## 1. Face-off — highest-ranked answer wins

Replaces the current first-correct-wins `answerPending` with a head-to-head.
"Rank" is the answer's `points` value (higher = higher-ranked). The `#1`
answer is the highest-`points` answer on the board.

```
faceoff
├─ ready              HOST_OPEN_BUZZER → buzzerOpen
├─ buzzerOpen         BUZZ | HOST_AWARD_BUZZ → set answeringTeam → firstAnswer
├─ firstAnswer        buzz-winner's ONE answer
│    MARK_CORRECT + isTopAnswer  → reveal+bank, record, takeControl → controlDecision
│    MARK_CORRECT (not #1)       → reveal+bank, record, flip team   → secondAnswer
│    MARK_WRONG                  → flip team                        → secondAnswer
├─ secondAnswer       other team's ONE answer
│    MARK_CORRECT + secondBeatsFirst → reveal+bank, record, control=2nd → controlDecision
│    MARK_CORRECT (doesn't beat)     → reveal+bank, record, control=1st → controlDecision
│    MARK_WRONG + firstTeamHasAnswer → control=1st                       → controlDecision
│    MARK_WRONG (both struck)        → flip back to 1st team             → bounceBack
└─ bounceBack         both missed their first answer; alternate single guesses
     MARK_CORRECT → reveal+bank, takeControl → controlDecision
     MARK_WRONG   → flip team (stay in bounceBack)
```

Rules encoded:

- **#1 answer → automatic control.** The second team never answers, so only
  one face-off answer is revealed/banked.
- **Otherwise the higher-value answer wins.** Both teams answer once; compare
  `points`.
- **A strike passes to the other team.** If the first team struck and the
  second answers, the second team controls (they hold the only answer).
- **Double-strike → bounce-back.** Both missed their first answer; teams
  alternate single guesses and the first correct answer wins control (this
  path is the old first-correct-wins behavior, which is correct here).

### Guard evaluation note

XState evaluates guards before running transition actions, so the comparison
guards derive the just-clicked answer's value from the **event**
(`event.slotIndex → currentQuestion.answers[slotIndex].points`), not from
post-action context:

- `isTopAnswer(event)` — clicked slot's `points` equals the max `points` on
  the board.
- `secondBeatsFirst(context, event)` — clicked slot's `points` >
  `context.faceoffPoints[firstTeam]` (treating a `null` first value as a
  loss, i.e. first team struck).
- `firstTeamHasAnswer(context)` — `faceoffPoints[firstTeam] !== null`.

`firstTeam` = `otherTeam(answeringTeam)` while in `secondAnswer` (answeringTeam
has been flipped to the second team).

## 2. Steal — confirmation + unrevealed guard

The single decisive steal guess gets a server-authoritative confirmation
step. Banking is deferred until confirm, so cancel is a clean rollback.

```
steal
├─ awaitingStealGuess
│    HOST_REVEAL_ANSWER + isUnrevealedSlot → stageStealReveal → confirmingSteal
│    HOST_STRIKE                           → commitBankToController (steal fails) → roundEnd
└─ confirmingSteal          (host-UI shows the confirm modal here)
     HOST_CONFIRM_STEAL → commitSteal (bank stolen answer, award ×mult to stealer) → roundEnd
     HOST_CANCEL_STEAL  → cancelStealReveal (un-reveal slot) → awaitingStealGuess
```

- `isUnrevealedSlot(context, event)` — `!answers[slotIndex].revealed`.
  Clicking an already-revealed slot is ignored (no transition), which is the
  fix for the "already-revealed slot wins the steal" bug.
- `stageStealReveal` — set the slot `revealed = true` and record
  `pendingStealSlot = slotIndex`. Does **not** touch `boardBank`.
- `commitSteal` — add the staged slot's `points` to `boardBank`, then award
  `boardBank × roundMultiplier` to the stealing team, clear
  `pendingStealSlot`.
- `cancelStealReveal` — set the staged slot `revealed = false`, clear
  `pendingStealSlot`.

## 3. Host overrides

The host mirrors every player-gated action, removing the deadlocks that occur
when a player client is disconnected:

- `buzzerOpen`: `HOST_AWARD_BUZZ{teamId}` — same effect as `BUZZ` (sets
  `answeringTeam`, → `firstAnswer`).
- `controlDecision`: `HOST_PLAY` / `HOST_PASS` — same as `PLAY` / `PASS` but
  act on `controllingTeam` directly, with no `isDecidingTeam` guard.

Player events (`BUZZ`, `PLAY`, `PASS`) remain, with `PLAY`/`PASS` still guarded
by `isDecidingTeam`.

## 4. Round end — click-through board reveal

At round end the host reveals any remaining hidden answers one-by-one before
advancing. Scoring is already committed on entry to `roundEnd`, so these
reveals are display-only.

```
roundEnd
├─ revealingBoard     always: isBoardComplete → checkWin
│                     HOST_REVEAL_ANSWER + isUnrevealedSlot → revealSlotOnly (stay)
├─ checkWin           always: [ targetReached → setWinner → #game.gameOver ,
│                               else → awaitingNextRound ]
└─ awaitingNextRound  HOST_NEXT_ROUND → startNextRound → #game.roundActive
```

- If the controlling team already cleared the board, `revealingBoard`'s
  `always` passes straight through to `checkWin`.
- `revealSlotOnly` — set slot `revealed = true`; no banking.
- Win check happens **after** the board is fully revealed, matching the show.

## 5a. Point multipliers

- New context `roundNumber` starts at `1` and increments in `startNextRound`.
- `roundMultiplier(roundNumber)` = `1` for rounds 1–2, `2` for round 3, `3`
  for round 4+.
- The multiplier is applied to the **whole bank at commit time**, inside
  `commitBankToController`, `commitBankToStealer`, and `commitSteal`, so
  face-off + play + steal points all scale together (matching the show, where
  the entire round total is doubled/tripled).

## Additions at a glance

- **Context** (`game.context.ts`):
  - `roundNumber: number` (init `1`)
  - `faceoffPoints: Record<TeamId, number | null>` (init `{ home: null, away: null }`)
  - `pendingStealSlot: number | null` (init `null`)
- **Events** (`game.events.ts`):
  - `{ type: 'HOST_AWARD_BUZZ'; teamId: TeamId }`
  - `{ type: 'HOST_PLAY' }`
  - `{ type: 'HOST_PASS' }`
  - `{ type: 'HOST_CONFIRM_STEAL' }`
  - `{ type: 'HOST_CANCEL_STEAL' }`
- **Guards** (`game.guards.ts`): `isTopAnswer`, `secondBeatsFirst`,
  `firstTeamHasAnswer`, `isUnrevealedSlot`
- **Actions** (`game.actions.ts`): `recordFaceoffAnswer`, `giveControlToOther`,
  `stageStealReveal`, `commitSteal`, `cancelStealReveal`, `revealSlotOnly`,
  `startNextRound` (resets per-round context + increments `roundNumber` +
  resets `faceoffPoints`); modify `commitBankToController` /
  `commitBankToStealer` to apply `roundMultiplier`.

## Event semantics note

`HOST_REVEAL_ANSWER` is now handled in three states with different actions:
bank-and-progress in `play.awaitingGuess`, `stageStealReveal` in `steal`, and
`revealSlotOnly` in `roundEnd`. XState routes the event by current state, so
no new event type is needed, but the gateway/host-UI author should know the
same socket event has phase-dependent meaning.

## Testing

`game.machine.spec.ts` already exercises the current flow. New/updated cases:

- Face-off: #1 answer → automatic control (second team never answers);
  lower-then-higher → second team wins; lower-then-lower → first team wins;
  strike-then-correct → answerer wins; double-strike → bounce-back to
  first-correct-wins.
- Steal: already-revealed slot is ignored; confirm awards the bank; cancel
  rolls back the reveal and leaves the bank unchanged.
- Host overrides: `HOST_AWARD_BUZZ`, `HOST_PLAY`, `HOST_PASS` drive the same
  transitions as their player equivalents.
- Round end: remaining slots reveal one-by-one; win check fires only after
  the board is complete.
- Multipliers: round 3 doubles the awarded bank, round 4 triples it, across
  controller/stealer/steal commits.
