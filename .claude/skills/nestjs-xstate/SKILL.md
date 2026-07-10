---
name: nestjs-xstate
description: Patterns and conventions for building XState v5 state machines in a NestJS backend with Socket.io WebSocket integration. Use this skill whenever the user is creating or modifying an XState v5 machine, adding actions, guards, or actors, wiring up WebSocket events, or designing type-safe machine architecture in a NestJS context. Trigger even for partial tasks like "add a new action", "add a new guard", or "add a new event" — the typing patterns are easy to get wrong without this reference.
---

# XState v5 + NestJS Patterns

This skill covers conventions and patterns for building server-authoritative
XState v5 state machines in NestJS with Socket.io. It is organized into five
areas:

1. [Machine Structure](#1-machine-structure)
2. [Type-Safe Actions](#2-type-safe-actions)
3. [Type-Safe Guards](#3-type-safe-guards)
4. [Actors — Timer and WebSocket](#4-actors)
5. [WebSocket Event Flow](#5-websocket-event-flow)

For full annotated code examples, see:

- `references/machine.md` — full machine scaffold
- `references/actions.md` — assign and sendTo patterns
- `references/actors.md` — socketActor and timerActor
- `references/events.md` — inbound and outbound event types

---

## Core Architecture Principle

The server is the **single source of truth**. One XState machine instance runs
per logical session (e.g. a room, a game, a workflow) on the server. The client
is a thin Socket.io consumer — it emits events and reacts to broadcasts. There
is no XState machine on the client.

---

## 1. Machine Structure

### Rationale

The machine is created via a **factory function** rather than exported as a
singleton. Each session needs its own independent machine instance with its
own context and actor lifecycle.

### Pattern

```typescript
export const createSessionMachine = (socketInfo: SocketActorInput) => {
  const machine = setup({
    types: {
      context: {} as MyContext,
      events: {} as MyEvent,
    },
    actions,
    guards,
    actors: { socketActor, timerActor },
  }).createMachine({ ... });

  return createActor(machine).start();
};
```

### Key rules

**`setup()` before `createMachine()`** — this is where actions, guards, and
actors are registered and typed. Never call `createMachine` directly.

**`socketActor` at root level** — invoke it on the machine root so it persists
across all states for the entire session lifetime.

**`timerActor` per relevant state** — invoke it inside the state that needs
a timer so it is automatically stopped when the machine transitions away.

**`always` transitions over external events** for conditions the server can
derive itself:

```typescript
// ✓ server derives this condition from context
waitingForPlayers: {
  always: { guard: 'minPlayersMet', target: 'ready' },
}

// ✗ don't trust the client to tell the server when a condition is met
waitingForPlayers: {
  on: { MIN_PLAYERS_MET: 'ready' }
}
```

**Absolute state references** when targeting across hierarchy levels:

```typescript
// ✓ unambiguous from any nested state
target: '#machineId.targetState';

// ✗ resolves relative to current parent — may not find the right state
target: 'targetState';
```

**`final` states + `onDone`** for sequential sub-flows:

```typescript
parentState: {
  initial: 'stepOne',
  states: {
    stepOne: { on: { DONE: 'stepTwo' } },
    stepTwo: { type: 'final' },  // triggers onDone on parent
  },
  onDone: { target: 'nextParentState' },
}
```

**Guardless `always` fallthrough** as the last branch to prevent the machine
getting stuck:

```typescript
checkingCondition: {
  always: [
    { guard: 'someCondition', target: 'stateA' },
    { target: 'stateB' }, // implicit else — always reached if guard fails
  ],
},
```

### Session lifecycle (NestJS service)

```typescript
@Injectable()
export class SessionService {
  private sessions = new Map<string, ReturnType<typeof createSessionMachine>>();

  create(io: Server): string {
    const sessionId = generateId();
    const actor = createSessionMachine({ io, sessionId });

    // Destroy when machine reaches final closed state
    actor.subscribe((state) => {
      if (state.matches('closed')) this.destroy(sessionId);
    });

    this.sessions.set(sessionId, actor);
    return sessionId;
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  private destroy(sessionId: string): void {
    const actor = this.sessions.get(sessionId);
    if (actor) {
      actor.stop();
      this.sessions.delete(sessionId);
    }
  }
}
```

---

## 2. Type-Safe Actions

Actions are split into two files: `assigns.ts` (context updates via `assign`)
and `notifies.ts` (outbound socket notifications via `sendTo`). They are merged
in `index.ts`.

### assign actions (`assigns.ts`)

Define a typed `assign` helper once to avoid repeating generics:

```typescript
const sessionAssign = assign<MyContext, MyEvent, undefined, MyEvent, never>;
```

Always use `assertEvent` inside callbacks to narrow the event type. It throws
at runtime if the wrong event triggers the action — catching wiring mistakes:

```typescript
const assignItem = sessionAssign(({ context, event }) => {
  assertEvent(event, 'ITEM_ADDED');
  return { items: [...context.items, event.item] };
});

// Accept multiple event types with an array
const assignResult = sessionAssign(({ context, event }) => {
  assertEvent(event, ['USER_SUBMITTED', 'AUTO_RESOLVED']);
  return { results: [...context.results, event.result] };
});
```

### sendTo actions (`notifies.ts`)

Define a typed `sendTo` helper. The **fifth generic must be the parent
machine's event union**, NOT the outbound socket event type:

```typescript
type SocketRef = ActorRefFrom<typeof socketActor>;

const sendToSocket = sendTo<
  MyContext,
  MyEvent,
  undefined,
  SocketRef,
  MyEvent // ← parent machine event union, NOT SocketActorEvent
>;
```

> **Why?** The fifth generic constrains which machine this action belongs to.
> Setting it to `SocketActorEvent` causes TypeScript errors in `setup()` because
> the action appears to belong to a different machine. The `SocketRef` type
> (fourth generic) enforces what can actually be sent to the target actor.

When reading event data not available in context, cast the event explicitly:

```typescript
const notifyItemAdded = sendToSocket('socket', ({ event }) => ({
  type: 'NOTIFY_ITEM_ADDED',
  item: (event as ItemAddedEvent).item,
}));
```

### Action ordering matters

Actions in an array run in order. If a `sendTo` reads context that an `assign`
just updated, put `assign` first:

```typescript
// ✓ assign updates context first, then notify reads updated value
actions: ['assignResult', 'notifyResultConfirmed'];
```

### Merging actions

```typescript
// actions/index.ts
export const actions = { ...assignActions, ...notifyActions };
```

---

## 3. Type-Safe Guards

### Pattern

Define a shared `GuardArgs` alias to avoid repeating generics:

```typescript
import type { GuardArgs } from 'xstate';

type SessionGuardArgs = GuardArgs<MyContext, MyEvent>;

const isReady = ({ context }: SessionGuardArgs): boolean => {
  return context.participants.length >= context.config.minParticipants;
};

const isExpired = ({ context }: SessionGuardArgs): boolean => {
  return context.itemsRemaining === 0;
};

export const guards = { isReady, isExpired };
```

### Composing guards in the machine

Use `or`, `not`, `and` from xstate to compose guards declaratively:

```typescript
import { or, not } from 'xstate';

checkingEnd: {
  always: [
    {
      guard: or([not('hasRoundsRemaining'), 'isExpired']),
      target: 'complete',
    },
    { target: 'nextTurn' }, // guardless fallthrough
  ],
},
```

---

## 4. Actors

### timerActor

A `fromCallback` actor that fires a timeout event after a configurable duration.
Uses `never` for the event generic — no `receive` block is needed because
XState stops the actor automatically on state exit, which triggers the cleanup
function and clears the timeout.

```typescript
type TimerInput = { duration: number }; // always milliseconds

export const timerActor = fromCallback<never, TimerInput>(({ input, sendBack }) => {
  const timeout = setTimeout(() => sendBack({ type: 'TIMER_EXPIRED' }), input.duration);
  return () => clearTimeout(timeout); // cleanup on state exit
});
```

Invoke inside the state that needs the timer:

```typescript
awaitingAction: {
  invoke: {
    src: 'timerActor',
    input: ({ context }) => ({ duration: context.config.turnDuration }),
  },
  on: {
    TIMER_EXPIRED: 'timedOut',
    ACTION_SUBMITTED: { target: 'actionReceived', actions: [...] },
  },
},
```

> Do NOT add a `CANCEL_TIMER` receive block. It is redundant — XState stops
> the actor and runs cleanup automatically when the machine transitions away
> from the invoking state.

### socketActor

A `fromCallback` actor that owns the Socket.io connection for a session.
Two responsibilities:

1. **Inbound** — listen for client socket events, forward to machine via `sendBack`
2. **Outbound** — receive notifications from machine via `receive`, broadcast to clients

```typescript
export const socketActor = fromCallback<SocketActorEvent, SocketActorInput>(
  ({ input, sendBack, receive }) => {
    const { io, sessionId } = input;

    io.on('connection', (socket) => {
      // Inbound: client → machine
      socket.on('ACTION_SUBMITTED', (data) => sendBack({ type: 'ACTION_SUBMITTED', ...data }));

      // Always server-derived — never trust client to emit disconnect
      socket.on('disconnect', () =>
        sendBack({ type: 'PARTICIPANT_DISCONNECTED', participantId: socket.id }),
      );
    });

    // Outbound: machine → all session clients
    receive((event) => io.to(sessionId).emit(event.type, event));

    // Cleanup: disconnect all clients when machine stops
    return () => io.to(sessionId).disconnectSockets(true);
  },
);
```

Invoke at the machine root:

```typescript
createMachine({
  invoke: {
    id: 'socket',       // must match the string used in sendToSocket('socket', ...)
    src: 'socketActor',
    input: socketInfo,
  },
  ...
})
```

---

## 5. WebSocket Event Flow

### Two separate event type unions

Keep inbound and outbound events strictly separated into two files:

| File                 | Direction        | Naming                                      |
| -------------------- | ---------------- | ------------------------------------------- |
| `events/inbound.ts`  | Client → Machine | Plain names: `ACTION_SUBMITTED`             |
| `events/outbound.ts` | Machine → Client | `NOTIFY_` prefix: `NOTIFY_ACTION_CONFIRMED` |

The `NOTIFY_` prefix makes it immediately clear at a glance which events flow
in which direction.

### Server-derived events

Some events should **never** be emitted by the client — the server derives them:

| Pattern       | Instead of client emitting...           | Server does...                     |
| ------------- | --------------------------------------- | ---------------------------------- |
| Timer expiry  | `TIMER_EXPIRED` socket event            | `timerActor` fires after timeout   |
| Disconnection | `PARTICIPANT_DISCONNECTED` socket event | Socket.io `disconnect` handler     |
| Threshold met | `MIN_X_MET` socket event                | `always` guard on context          |
| Step complete | `STEP_DONE` socket event                | `always` transition + local action |

### Gateway intercept pattern

Some inbound events need server-side enrichment (async data fetching, server
computed values) before reaching the machine. Handle these in dedicated
`@SubscribeMessage` handlers in the NestJS gateway rather than forwarding
through the socket actor:

```typescript
@WebSocketGateway()
export class SessionGateway {
  @SubscribeMessage('START_SESSION')
  async handleStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: StartPayload,
  ): Promise<void> {
    const session = this.sessionService.get(this.getSessionId(socket));

    // Enrich server-side before forwarding to machine
    const computedData = await this.someService.compute(data.config);

    session.send({ type: 'START_SESSION', ...computedData });
  }

  // All other events forwarded generically
  @SubscribeMessage('*')
  handleMessage(@ConnectedSocket() socket: Socket, @MessageBody() data: MyEvent) {
    const session = this.sessionService.get(this.getSessionId(socket));
    session?.send(data);
  }

  private getSessionId(socket: Socket): string | undefined {
    return [...socket.rooms].find((r) => r !== socket.id);
  }
}
```

> Omit intercepted events (e.g. `START_SESSION`) from the socket actor's
> inbound listeners — they are handled entirely in the gateway.

### Full event lifecycle

```
Client emits socket event
  → socketActor.sendBack() → machine receives as XState event
    → machine transitions, runs assign + sendTo actions
      → sendTo fires socketActor.receive()
        → io.to(sessionId).emit() broadcasts to all clients
```
