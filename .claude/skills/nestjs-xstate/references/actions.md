# Actions Reference

## assigns.ts

```typescript
import { MyContext } from './context';
import { MyEvent } from './events/inbound';
import { assertEvent, assign } from 'xstate';

// Typed assign helper — define once, reuse for all assign actions
const sessionAssign = assign<MyContext, MyEvent, undefined, MyEvent, never>;

// Single event type — assertEvent narrows and throws if wrong event fires
const assignConfig = sessionAssign(({ event }) => {
  assertEvent(event, 'SAVE_CONFIG');
  return { config: event.config };
});

// Multiple event types — pass an array to assertEvent
const assignAction = sessionAssign(({ context, event }) => {
  assertEvent(event, ['ACTION_SUBMITTED', 'AUTO_RESOLVED']);
  return { history: [...context.history, event.result] };
});

// Context-only computation — no event needed
const advanceTurn = sessionAssign(({ context }) => ({
  currentTurnIndex: context.currentTurnIndex + 1,
  currentRound: Math.floor(context.currentTurnIndex / context.participants.length) + 1,
}));

// Immutable array update — add participant
const assignParticipant = sessionAssign(({ context, event }) => {
  assertEvent(event, 'PARTICIPANT_JOINED');
  return { participants: [...context.participants, event.participant] };
});

// Immutable array update — remove participant
const removeParticipant = sessionAssign(({ context, event }) => {
  assertEvent(event, 'PARTICIPANT_LEFT');
  return {
    participants: context.participants.filter((p) => p.id !== event.participantId),
  };
});

// Immutable array update — toggle field on matching item
const assignParticipantDisconnected = sessionAssign(({ context, event }) => {
  assertEvent(event, 'PARTICIPANT_DISCONNECTED');
  return {
    participants: context.participants.map((p) =>
      p.id === event.participantId ? { ...p, isConnected: false } : p,
    ),
  };
});

export const assignActions = {
  assignConfig,
  assignAction,
  advanceTurn,
  assignParticipant,
  removeParticipant,
  assignParticipantDisconnected,
  // ... other assign actions
};
```

---

## notifies.ts

```typescript
import { socketActor } from './actors/websocket';
import { MyContext } from './context';
import {
  MyEvent,
  ActionSubmittedEvent,
  AutoResolvedEvent,
  ParticipantDisconnectedEvent,
} from './events/inbound';
import { ActorRefFrom, sendTo } from 'xstate';

type SocketRef = ActorRefFrom<typeof socketActor>;

// IMPORTANT: fifth generic is MyEvent (parent machine event union)
// NOT SocketActorEvent — see SKILL.md section 2 for full explanation
const sendToSocket = sendTo<MyContext, MyEvent, undefined, SocketRef, MyEvent>;

// Reading from context — safe when paired assign runs first in actions array
const notifyConfigSaved = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_CONFIG_SAVED',
  config: context.config,
}));

// Reading from event — use when event has the needed data directly
// Cast is necessary because sendToSocket types event as full MyEvent union
const notifyActionConfirmed = sendToSocket('socket', ({ event }) => ({
  type: 'NOTIFY_ACTION_CONFIRMED',
  result: (event as ActionSubmittedEvent | AutoResolvedEvent).result,
}));

// Reading from both context and event
const notifyTurnAdvanced = sendToSocket('socket', ({ context }) => ({
  type: 'NOTIFY_TURN_ADVANCED',
  currentTurnIndex: context.currentTurnIndex, // already updated by advanceTurn
  currentRound: context.currentRound, // already updated by advanceTurn
  participantId: context.turnOrder[context.currentTurnIndex],
}));

// No payload needed — event type alone carries meaning
const notifyCancelled = sendToSocket('socket', () => ({
  type: 'NOTIFY_CANCELLED',
}));

// Passing event data through with a cast
const notifyDisconnected = sendToSocket('socket', ({ event }) => ({
  type: 'NOTIFY_PARTICIPANT_DISCONNECTED',
  participantId: (event as ParticipantDisconnectedEvent).participantId,
}));

// Serialize non-JSON-safe types (e.g. Set → array) before emitting
const notifyResultUpdated = sendToSocket('socket', ({ event, context }) => ({
  type: 'NOTIFY_RESULT_UPDATED',
  invalidatedIds: [...context.invalidatedIds], // Set → array for socket serialization
}));

export const notifyActions = {
  notifyConfigSaved,
  notifyActionConfirmed,
  notifyTurnAdvanced,
  notifyCancelled,
  notifyDisconnected,
  notifyResultUpdated,
  // ... other notify actions
};
```

---

## actions/index.ts

```typescript
import { assignActions } from './assigns';
import { notifyActions } from './notifies';

export const actions = {
  ...assignActions,
  ...notifyActions,
};
```
