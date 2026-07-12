# API App — CLAUDE.md

NestJS server for **Family Feud** — a single, room-based multiplayer game driven
entirely by an XState v5 state machine. The server is the sole authority for game
state; clients (host console, board display, team players) are thin consumers that
send events and render snapshots.

> This app is the backend half of the `@family-feud` monorepo. For repo-wide
> conventions (workspaces, Turborepo tasks, branching) see the root
> [`AGENTS.md`](../../AGENTS.md).

## Stack

| Concern        | Choice                                                     |
| -------------- | ---------------------------------------------------------- |
| Framework      | NestJS 11 (modules, DI, gateways)                          |
| State machines | XState v5                                                  |
| Real-time      | Socket.io (via a NestJS WebSocket gateway) — _in progress_ |
| Database       | PostgreSQL — question store only, _planned/not built yet_   |
| Tests          | Vitest (globals enabled)                                   |
| Shared types   | `@family-feud/types` (only when the frontend needs them)   |

**Game state is never persisted.** All room/game state lives in memory inside the
running XState actor for a room; when the room closes, the state is gone. Do not
add persistence for scores, rounds, presence, or any other game state.

The **only** planned database use is a **read store of Family Feud questions** (see
below). It does not exist yet — there is currently no database, ORM, or migration
setup in this app. Do not wire up a database for anything other than the question
store without an explicit decision.

## Questions & the Database (planned)

Questions and their answers are **content the machine consumes, not state it owns**.
Today they arrive from the client on the `HOST_START_GAME` event (and
`HOST_NEXT_ROUND`), so the machine is entirely content-agnostic — it just normalizes
and boards whatever question it's handed.

The target design moves question content into **PostgreSQL**, seeded from an existing
Family Feud Q&A dataset:

- **The `apps/api` server owns the fetch.** When the host asks for a question, a
  service (e.g. a `QuestionService` / question module) reads it from Postgres and the
  gateway feeds it into the machine via `HOST_START_GAME` / `HOST_NEXT_ROUND`. Web
  clients never query the database directly.
- The machine's event/context shape does not change — a question is still just a
  `Question` object on the event. Only the *source* of that object moves from client
  to server.
- ORM choice is not settled. The sibling `dribbl.io` project uses **TypeORM** with
  `synchronize: false` / `migrationsRun: false` and entities defined in its shared
  types package — a reasonable pattern to mirror, but confirm before committing to it.
- This store is **read-only game content**; it is unrelated to (and must not be
  conflated with) the in-memory game state above.

## Current State of the App

The XState game machine is **fully built and tested**. The NestJS wrapping around
it (bootstrap wiring, the room service, and the Socket.io gateway) is **still being
built out**:

- `src/main.ts` / `src/app.module.ts` — bare Nest scaffold. `main.ts` still listens
  on `3000` with no global prefix, CORS, or `ValidationPipe`. Expect this to grow.
- `src/app.controller.ts` / `app.service.ts` — placeholder "hello world" scaffold.
- `src/game/` — the real code. The complete Family Feud state machine.
- **Not yet present:** the WebSocket gateway, the room/lifecycle service, and the
  socket actor that bridges Socket.io <-> the machine. The "Multiplayer Architecture"
  section below is the **target pattern to follow** when adding them.

## Directory Structure

```
src/
├── main.ts                # Bootstrap (currently bare)
├── app.module.ts          # Root module (currently bare)
└── game/                  # The Family Feud state machine
    ├── game.machine.ts    # setup().createMachine() definition + createGameMachine()
    ├── game.context.ts    # GameContext shape + initialGameContext()
    ├── game.events.ts     # GameEvent discriminated union
    ├── game.actions.ts    # assign actions (context mutations)
    ├── game.guards.ts      # pure predicate guards
    ├── game.types.ts       # domain types (TeamId, Question, Answer, Team, ClientRole)
    └── game.machine.spec.ts
```

The machine is deliberately split by _responsibility_ (context / events / actions /
guards / types) into small files rather than one monolith. Keep that split when
extending it.

## The Game Machine

`createGameMachine(roomCode)` builds the machine with `setup({ types, actions,
guards }).createMachine(...)`. It currently returns the **machine definition**, not a
started actor — the caller (the future room service, or a test) does
`createActor(machine).start()`. When the socket actor is added, this factory will
take the socket/room input and invoke the socket actor at the machine root (see
Multiplayer Architecture).

### Key concepts

- **Host-authoritative.** Almost every event is a `HOST_*` event emitted by the host
  console (mark correct/wrong, reveal, strike, advance round). Player clients emit only
  a small set (`BUZZ`, `PLAY`, `PASS`). The machine trusts the host.
- **Presence.** `context.presence` tracks whether the `host`, `board`, and each team
  (`home`/`away`) player is connected. `canStartGame` gates the lobby on full presence
  plus configured team names and a target score. `CLIENT_CONNECTED`/`CLIENT_DISCONNECTED`
  are handled at the machine root in every state; a host disconnect tears the room down
  (`-> closed`).
- **Roles vs teams.** `ClientRole` is `'host' | 'board' | 'player'`; teams are
  `TeamId = 'home' | 'away'`. A `player` connects for a specific `teamId`.
- **Game flow.** `lobby -> roundActive (faceoff -> play) -> roundEnd -> ...` looping
  until `targetReached`, then `fastMoney -> gameOver`. `closed` is the only `final`
  state. Read `game.machine.ts` for the full nested-state chart; it is the source of
  truth for the rules.

### XState conventions (follow the `nestjs-xstate` skill)

Invoke the **`nestjs-xstate`** skill whenever creating or modifying the machine,
adding an action, guard, event, or actor — the v5 typing is easy to get subtly wrong.
The patterns already established here:

- **Assign actions** (`game.actions.ts`): use the module-local typed wrapper
  ```ts
  const gameAssign = assign<
    GameContext,
    GameEvent,
    undefined,
    GameEvent,
    never
  >;
  ```
  Use `gameAssign` instead of raw `assign` for every context mutation. Narrow the event
  inside the action with `assertEvent(event, 'HOST_X')` (or an array for multi-event
  actions). Actions return partial context and treat impossible states as no-ops
  (`return {}`) rather than throwing.
- **Guards** (`game.guards.ts`): pure predicates typed via
  `GuardArgs<GameContext, GameEvent>`, named with an `is*` / `are*` / verb-phrase prefix
  (`canStartGame`, `isTopAnswer`, `reachedMaxStrikes`). Use `assertEvent` when the guard
  reads event fields.
- **Events** (`game.events.ts`): a single discriminated union `GameEvent`, one member
  per `type`. Names are `SCREAMING_SNAKE_CASE`, prefixed `HOST_*` for host-console
  actions, `HOST_FM_*` for Fast Money.
- **Context** (`game.context.ts`): one `GameContext` interface plus an
  `initialGameContext(roomCode)` factory — always seed new state through the factory.
- `actions` and `guards` are exported as plain objects and registered in `setup(...)`;
  reference them by string key in the machine.

## Multiplayer Architecture (target pattern)

This is the pattern to implement for Socket.io rooms, adapted from the sibling
`dribbl.io` project's draft mode. Three pieces:

### 1. Socket actor — the Socket.io <-> machine bridge

A `fromCallback` actor **invoked once at the machine root** (so it lives for the whole
room lifetime), created with the room's `io: Server` and `roomId`. It:

- listens on `io.on('connection')`, ignoring sockets not in this room
  (`if (!socket.rooms.has(roomId)) return;`),
- translates inbound socket messages into machine events via `sendBack({ type, ... })`,
- forwards outbound machine events to the room via
  `receive((event) => io.to(roomId).emit(event.type, event))`,
- disconnects the room's sockets in its cleanup return.

Outbound events are emitted by **notify actions** — `sendTo('socket', ...)` using a
typed wrapper (mirror `sendToSocket`/notify actions from dribbl.io). Keep notify
actions separate from assign actions. Anything sent over the wire must be
JSON-serializable (send `string[]`, not `Set`).

### 2. Room service — actor lifecycle

An `@Injectable()` service owning a `Map<roomCode, actor>` (plus a `Map` of
subscriptions):

- generates a room code (dribbl.io uses `short-unique-id`, 5-char uppercase alphanum),
- `createRoom(io)` builds + starts the actor and `subscribe`s to auto-destroy the room
  when the machine reaches a final state (`state.status === 'done'`),
- `getRoom(code)` / `destroyRoom(code)` (unsubscribe, `actor.stop()`, delete from map),
- consider a `MAX_ROOMS` cap and an `onRoomDestroyed` hook for the gateway.

### 3. Gateway — the transport edge

A `@WebSocketGateway({ namespace, cors })` implementing `OnGatewayConnection` /
`OnGatewayDisconnect`:

- `handleConnection`: join an existing room via a `roomId`/`roomCode` handshake query,
  or create a new one and emit its code back; reject unknown rooms.
- `handleDisconnect`: track live socket counts per room and destroy empty rooms.
- Forward client messages to `room.send(...)`. Use a wildcard `@SubscribeMessage('*')`
  for straight pass-through events, and dedicated `@SubscribeMessage('NAME')` handlers
  only for events that need async server work before hitting the machine.
- CORS origin comes from `CORS_ORIGIN` (comma-separated), default `http://localhost:3000`.

## Naming Conventions

| Thing                 | Convention                    | Example              |
| --------------------- | ----------------------------- | -------------------- |
| Files                 | `game.<concern>.ts`           | `game.actions.ts`    |
| Classes               | PascalCase                    | `GameGateway`        |
| XState events         | SCREAMING_SNAKE_CASE          | `HOST_MARK_CORRECT`  |
| XState guards         | predicate (`is*`/`are*`/verb) | `reachedMaxStrikes`  |
| XState assign actions | verb phrase                   | `revealSlotAndBank`  |
| XState notify actions | `notify*` prefix              | `notifyRoundStarted` |
| XState states         | camelCase                     | `awaitingGuess`      |
| Teams                 | `home` / `away`               | —                    |
| Client roles          | `host` / `board` / `player`   | —                    |

## Types

- Types the game logic needs live locally in `src/game/game.types.ts`.
- Promote a type to `@family-feud/types` **only** when the frontend must consume it
  (e.g. socket event payloads, context snapshots shipped to clients). Today that package
  holds only `HealthCheckResponse`.
- Imports within `game/` are **relative** (`./game.actions`). There is currently no
  `@/` path alias configured (unlike dribbl.io) — don't assume one exists.

## Testing

- **Vitest** with globals on — no need to import `describe`/`it`/`expect`.
- Specs are co-located as `*.spec.ts` (`src/game/game.machine.spec.ts`).
- E2E config lives at `test/vitest-e2e.config.ts`.
- Test the machine by driving a started actor with events and asserting on
  `actor.getSnapshot()` (`.value` for state, `.context` for data).

```bash
npm test           # unit tests once (vitest run)
npm run test:watch     # watch mode
npm run test:cov       # coverage
npm run test:e2e       # e2e
npm run typecheck      # tsc --noEmit
npm run lint           # eslint --fix
```

Run these from the repo root (`npm run <task>`, orchestrated by Turborepo) or from
this directory. Do not run `npm install` inside this app — install from the repo root.

## Adding to the App

1. Game-rule changes go in `src/game/` — extend the relevant `game.*.ts` file, keep the
   context/events/actions/guards split, and invoke the `nestjs-xstate` skill.
2. Socket/transport work follows the three-piece pattern above (socket actor + room
   service + gateway).
3. Add a `*.spec.ts` next to any new logic.
