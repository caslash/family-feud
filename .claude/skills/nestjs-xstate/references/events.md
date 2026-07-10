# Events Reference

## events/inbound.ts

Inbound events flow **from clients to the machine** via the socket actor.
Use plain descriptive names without a prefix.

```typescript
import { MyContext, Participant, Config } from './context';

// ── Participant lifecycle ─────────────────────────────────────────────────

export type ParticipantJoinedEvent = {
  type: 'PARTICIPANT_JOINED';
  participant: Participant;
};

export type ParticipantLeftEvent = {
  type: 'PARTICIPANT_LEFT';
  participantId: string;
};

// Server-derived via Socket.io disconnect — never emitted by client
export type ParticipantDisconnectedEvent = {
  type: 'PARTICIPANT_DISCONNECTED';
  participantId: string;
};

export type ParticipantReconnectedEvent = {
  type: 'PARTICIPANT_RECONNECTED';
  participantId: string;
};

// ── Configuration ─────────────────────────────────────────────────────────

export type ConfigureEvent = {
  type: 'CONFIGURE';
};

export type SaveConfigEvent = {
  type: 'SAVE_CONFIG';
  config: Config;
};

// ── Session lifecycle ─────────────────────────────────────────────────────

export type StartSessionEvent = {
  type: 'START_SESSION';
  // Note: any server-computed fields (pool, turnOrder, etc.) are injected
  // by the gateway before room.send() is called — the client never sends them
  computedField: string;
};

export type CancelSessionEvent = {
  type: 'CANCEL';
};

export type SessionClosedEvent = {
  type: 'SESSION_CLOSED';
};

// ── Turn events ───────────────────────────────────────────────────────────

export type ActionSubmittedEvent = {
  type: 'ACTION_SUBMITTED';
  result: ActionResult;
};

// Server-derived via timerActor — never emitted by client
export type TimerExpiredEvent = {
  type: 'TIMER_EXPIRED';
};

export type AutoResolvedEvent = {
  type: 'AUTO_RESOLVED';
  result: ActionResult;
};

export type ResultComputedEvent = {
  type: 'RESULT_COMPUTED';
  invalidatedIds: Set<string>; // Set internally; serialize to array before emit
};

// ── Union ─────────────────────────────────────────────────────────────────

export type MyEvent =
  | ParticipantJoinedEvent
  | ParticipantLeftEvent
  | ParticipantDisconnectedEvent
  | ParticipantReconnectedEvent
  | ConfigureEvent
  | SaveConfigEvent
  | StartSessionEvent
  | CancelSessionEvent
  | SessionClosedEvent
  | ActionSubmittedEvent
  | TimerExpiredEvent
  | AutoResolvedEvent
  | ResultComputedEvent;
```

**Events intentionally absent from inbound:**

- Threshold-met events (e.g. `MIN_PLAYERS_MET`) → replaced by `always` guard
- Step-complete events (e.g. `TURN_ADVANCED`) → replaced by `always` + local action
- Disconnect events → replaced by Socket.io `disconnect` handler

---

## events/outbound.ts

Outbound events flow **from the machine to clients** via `sendTo('socket', ...)`.
Always use the `NOTIFY_` prefix to distinguish from inbound events.

```typescript
import { Participant, Config, ActionResult } from './context';

// ── Participant lifecycle ─────────────────────────────────────────────────

export type NotifyParticipantJoined = {
  type: 'NOTIFY_PARTICIPANT_JOINED';
  participant: Participant;
};

export type NotifyParticipantLeft = {
  type: 'NOTIFY_PARTICIPANT_LEFT';
  participantId: string;
};

export type NotifyParticipantDisconnected = {
  type: 'NOTIFY_PARTICIPANT_DISCONNECTED';
  participantId: string;
};

export type NotifyParticipantReconnected = {
  type: 'NOTIFY_PARTICIPANT_RECONNECTED';
  participantId: string;
};

export type NotifyConfigSaved = {
  type: 'NOTIFY_CONFIG_SAVED';
};

export type NotifyReady = {
  type: 'NOTIFY_READY';
};

export type NotifyStarted = {
  type: 'NOTIFY_STARTED';
};

export type NotifyCancelled = {
  type: 'NOTIFY_CANCELLED';
};

export type NotifyComplete = {
  type: 'NOTIFY_COMPLETE';
  history: ActionResult[];
};

// ── Turn events ───────────────────────────────────────────────────────────

export type NotifyActionConfirmed = {
  type: 'NOTIFY_ACTION_CONFIRMED';
  result: ActionResult;
  // wasAutoResolved boolean lets client render differently if needed
};

export type NotifyResultUpdated = {
  type: 'NOTIFY_RESULT_UPDATED';
  invalidatedIds: string[]; // array (not Set) — must be JSON-serializable
};

export type NotifyTurnAdvanced = {
  type: 'NOTIFY_TURN_ADVANCED';
  currentTurnIndex: number;
  currentRound: number;
  participantId: string; // whose turn it is — keeps client thin
};

// ── Union ─────────────────────────────────────────────────────────────────

export type SocketActorEvent =
  | NotifyParticipantJoined
  | NotifyParticipantLeft
  | NotifyParticipantDisconnected
  | NotifyParticipantReconnected
  | NotifyConfigSaved
  | NotifyReady
  | NotifyStarted
  | NotifyCancelled
  | NotifyComplete
  | NotifyActionConfirmed
  | NotifyResultUpdated
  | NotifyTurnAdvanced;
```

**Design decisions:**

- `NOTIFY_TURN_ADVANCED` carries `participantId` directly — client doesn't need
  to index into `turnOrder` itself, keeping the client thin
- End-of-session notifications carry full history in one payload — client can
  render the results screen without accumulating state over the session
- `invalidatedIds` is always `string[]` in outbound events even if stored as
  `Set<string>` in context — Sets are not JSON-serializable
- A single `NOTIFY_ACTION_CONFIRMED` covers both manual and auto-resolved actions —
  a boolean flag on the result distinguishes them if the client needs to
