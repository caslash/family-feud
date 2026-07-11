# Family Feud Game State Machine — Design

Date: 2026-07-10

## Purpose

Design the server-side game flow for a Socket.io-hosted Family Feud game,
driven by an XState v5 state machine on the NestJS backend. Covers room
lifecycle, client roles, the state machine itself, and the question bank
schema it consumes.

## Client roles

Three client types connect to a room over Socket.io:

- **host** — controls board and game state from their own device. Full
  write access to game-flow events.
- **board** — display-only client showing scores and the game board.
  Read-only; receives broadcast state, sends no events.
- **player** — one client per team (`teamId: 'home' | 'away'`). Sends buzz
  and pass/play events during their team's turn.

## Architecture

- One XState v5 actor per active room. A `RoomService` on the NestJS side
  holds `Map<roomCode, ActorRefFrom<gameMachine>>`.
- **Room creation**: host issues a create-room event; server generates a
  room code, spawns a fresh `gameMachine` actor, and stores it in the map.
- **Joining**: board and player clients join an existing room with
  `{ roomCode, role, teamId? }`.
- **Gateway**: the Socket.io gateway is a thin translator — incoming socket
  events become XState events sent to the room's actor. The gateway
  subscribes to the actor's snapshot and broadcasts a role-filtered view to
  each connected socket after every transition:
  - board: full public state (scores, board, whose turn).
  - host: full state plus which host controls are currently valid.
  - player: minimal state — their team, and whether it's currently their
    turn to buzz or choose pass/play.
- **Teardown**: if the host's socket disconnects, the room's actor is
  stopped and the room is deleted immediately. No reconnection grace
  period in v1.
- **Persistence**: none. All state lives in the actor; a server restart
  drops all active games. Matches the current scaffold (no database).

### Assumptions

- Board and player disconnects do **not** tear down the room — only a host
  disconnect does, since the host retains full control over board state via
  slot-clicking and doesn't strictly need the other clients to keep
  operating (though a missing player client means that team can't buzz in).
- `HOST_NEXT_ROUND` is an explicit host-triggered event, not automatic,
  so the host can narrate or recap between rounds.

## Game rules encoded

- Exactly two teams (`home`, `away`) per game.
- No fixed round count — the game repeats face-off rounds until either
  team's score reaches a host-configured `targetScore`.
- Standard steal mechanic: after 3 strikes, the opposing team gets one
  guess to steal all revealed-plus-remaining board points.
- Face-off buzz-in is server-resolved: the server timestamps `BUZZ` events
  per room and the first one received wins, no host judgment needed.
- Face-off answer judging is host-mediated: the host clicks a matching
  board slot to mark an answer correct, or a strike button to mark it
  wrong. No free-text/fuzzy matching.
- Face-off bounce-back: if the buzz winner's answer is wrong, the other
  team gets a chance. If *that's* wrong too, control keeps bouncing
  back and forth between the two teams (no re-buzz, no question reset)
  until one team lands a correct answer on the board.
- Question content comes from a pre-loaded question bank; the host selects
  the next question when starting each round.
- `targetScore` is set by the host at game creation.

## State machine

```
gameMachine
├─ lobby                     // waiting for host+board+both player clients,
│                             team names, and targetScore to be set
├─ roundActive
│  ├─ faceoff
│  │  ├─ buzzerOpen           // waiting for first BUZZ from either player client
│  │  ├─ answerPending        // host judges the current answering team's answer
│  │  └─ controlDecision      // winning team's client sends PASS or PLAY
│  └─ play
│     ├─ awaitingGuess        // host reveals slots or adds strikes for controllingTeam
│     └─ steal                // opponent gets one guess after the 3rd strike
├─ roundEnd                  // score check against targetScore
└─ gameOver                  // winner declared, terminal
```

### lobby

Entry state. Transitions to `roundActive` on `HOST_START_GAME`, guarded by:
host, board, and both player clients connected, both team names set, and
`targetScore` set.

### roundActive.faceoff.buzzerOpen

Entry action loads the next question from `questionQueue` into
`currentQuestion` (only on the *first* entry into `roundActive` for a given
round — see roundEnd below for how the next round is kicked off).

- `BUZZ` (player) — first one received wins the race. Sets `answeringTeam`
  to that team, transitions to `answerPending`.

### roundActive.faceoff.answerPending

- `HOST_MARK_CORRECT` — reveals the matching board slot, sets
  `controllingTeam = answeringTeam`, transitions to `controlDecision`.
- `HOST_MARK_WRONG` — flips `answeringTeam` to the other team and stays in
  `answerPending`. This can repeat indefinitely until someone lands a
  correct answer — there is no re-buzz and no question reset.

### roundActive.faceoff.controlDecision

Controlling team's player client sends:

- `PLAY` — `controllingTeam` unchanged, transitions to `play.awaitingGuess`.
- `PASS` — `controllingTeam` flips to the other team, transitions to
  `play.awaitingGuess`.

### roundActive.play.awaitingGuess

- `HOST_REVEAL_ANSWER{slotIndex}` (host) — marks that slot revealed, adds
  its points to `controllingTeam.score`. If all answers are now revealed,
  the round ends immediately (no steal opportunity).
- `HOST_STRIKE` (host) — increments `strikes`. At `strikes === 3`,
  transitions to `play.steal`.

### roundActive.play.steal

The non-controlling team gets exactly one guess:

- `HOST_REVEAL_ANSWER{slotIndex}` — steal succeeds: reveal all remaining
  slots, award all remaining board points to the stealing team.
- `HOST_STRIKE` — steal fails: `controllingTeam` keeps the points already
  earned this round.

Either outcome transitions to `roundEnd`.

### roundEnd

Entry action checks both teams' scores against `targetScore`.

- If either team has met or exceeded `targetScore` → transition to
  `gameOver`.
- Otherwise, wait for `HOST_NEXT_ROUND` (host), then reset per-round
  context (`strikes = 0`, `controllingTeam = null`, `answeringTeam = null`,
  load next question from `questionQueue`) and transition back to
  `roundActive.faceoff.buzzerOpen`.

### gameOver

Terminal state. Broadcasts the winning team.

## Context shape

```ts
interface GameContext {
  roomCode: string;
  targetScore: number;
  teams: {
    home: { name: string; score: number };
    away: { name: string; score: number };
  };
  questionQueue: string[];          // remaining question IDs from the bank
  currentQuestion: {
    id: string;
    prompt: string;
    answers: { text: string; points: number; revealed: boolean }[];
  } | null;
  answeringTeam: 'home' | 'away' | null;   // who's currently up in answerPending
  controllingTeam: 'home' | 'away' | null; // who's playing the board
  strikes: number;                          // 0-3, resets when controllingTeam changes
}
```

## Events by originator

- **host**: `HOST_START_GAME`, `HOST_SET_TEAM_NAME`, `HOST_SET_TARGET_SCORE`,
  `HOST_OPEN_BUZZER`, `HOST_MARK_CORRECT`, `HOST_MARK_WRONG`,
  `HOST_REVEAL_ANSWER{slotIndex}`, `HOST_STRIKE`, `HOST_NEXT_ROUND`
- **player** (only accepted from the currently-expected team): `BUZZ`
  (during `buzzerOpen`), `PASS` / `PLAY` (during `controlDecision`, only
  from `controllingTeam`)
- **board**: none — read-only, receives broadcast state only

## Appendix: question bank JSON schema

Question bank entries follow the shape below, based on an existing example
(`7Answers.json` from a prior project) and matched against `currentQuestion`
in the context above:

```json
[
  {
    "question": "Tell Me The Age When Boys Stop Playing With Stuffed Animals (Numeric Only).",
    "answers": [
      { "answer": "7", "value": 22 },
      { "answer": "8", "value": 19 },
      { "answer": "10", "value": 15 },
      { "answer": "5", "value": 11 },
      { "answer": "6", "value": 10 },
      { "answer": "4", "value": 9 },
      { "answer": "3", "value": 8 }
    ]
  }
]
```

Field mapping to runtime `currentQuestion`:

- `question` → `currentQuestion.prompt`
- `answers[].answer` → `currentQuestion.answers[].text`
- `answers[].value` → `currentQuestion.answers[].points`
- `revealed` is runtime-only state, not present in the source data.

Sourcing and converting the full question bank from the referenced Google
Sheet into this JSON format is **out of scope for this spec** — it will be
planned as a separate, self-contained follow-up task (a one-off import
script).
