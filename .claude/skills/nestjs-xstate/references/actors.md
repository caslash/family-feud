# Actors Reference

## timer.ts

```typescript
import { fromCallback } from 'xstate';

type TimerInput = {
  duration: number; // always milliseconds — consistent with backend services
};

// Generic is `never` — no receive block needed.
// XState stops the actor on state exit, triggering cleanup automatically.
export const timerActor = fromCallback<never, TimerInput>(({ input, sendBack }) => {
  const timeout = setTimeout(() => sendBack({ type: 'TIMER_EXPIRED' }), input.duration);
  return () => clearTimeout(timeout); // only cancellation mechanism needed
});
```

**Rules:**

- Always use milliseconds for duration
- Never add a `CANCEL_TIMER` receive block — it's redundant
- The cleanup function handles cancellation when XState stops the actor
- Name the emitted event to match what the machine listens for in `on`

---

## websocket.ts

```typescript
import { SocketActorEvent } from './events/outbound';
import { Server, Socket } from 'socket.io';
import { fromCallback } from 'xstate';

export type SocketActorInput = {
  io: Server; // shared server instance, passed in — not created here
  sessionId: string;
};

export const socketActor = fromCallback<SocketActorEvent, SocketActorInput>(
  ({ input, sendBack, receive }) => {
    const { io, sessionId } = input;

    io.on('connection', (socket: Socket) => {
      // ── Inbound ──────────────────────────────────────────────────────
      // Forward client socket events to the machine via sendBack.
      // Only include events NOT intercepted by the gateway.

      socket.on('ACTION_SUBMITTED', (data) => sendBack({ type: 'ACTION_SUBMITTED', ...data }));
      socket.on('PARTICIPANT_LEFT', (data) => sendBack({ type: 'PARTICIPANT_LEFT', ...data }));
      socket.on('CONFIGURE', () => sendBack({ type: 'CONFIGURE' }));
      socket.on('SAVE_CONFIG', (data) => sendBack({ type: 'SAVE_CONFIG', ...data }));

      // Always server-derived — never trust the client to emit this
      socket.on('disconnect', () =>
        sendBack({ type: 'PARTICIPANT_DISCONNECTED', participantId: socket.id }),
      );
    });

    // ── Outbound ─────────────────────────────────────────────────────
    // Receive NOTIFY_ events from the machine and broadcast to all
    // clients in the session room.
    receive((event) => io.to(sessionId).emit(event.type, event));

    // ── Cleanup ──────────────────────────────────────────────────────
    // Runs when the machine stops (reaches closed final state).
    return () => io.to(sessionId).disconnectSockets(true);
  },
);
```

**Rules:**

- The `io` server instance is always passed as input — never created inside the actor
- Events intercepted by the gateway (needing async enrichment) are absent here
- `disconnect` is always server-derived via Socket.io, never client-emitted
- The single `receive` handler broadcasts all outbound events to the full session room
- The cleanup function disconnects all clients when the session ends
