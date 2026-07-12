import type { GameSocketActorEvent } from '@family-feud/types';
import type { Server, Socket } from 'socket.io';
import { fromCallback } from 'xstate';
import type { ClientRole, TeamId } from './game.types';

export type SocketActorInput = { io: Server; roomId: string };

// Client-emitted machine events the socket actor forwards inbound. Server-
// derived events (CLIENT_CONNECTED / CLIENT_DISCONNECTED) are handled
// separately below and are never accepted directly off the wire.
const INBOUND_EVENT_TYPES = [
  'HOST_SET_TEAM_NAME',
  'HOST_SET_TARGET_SCORE',
  'HOST_START_GAME',
  'HOST_OPEN_BUZZER',
  'HOST_MARK_CORRECT',
  'HOST_MARK_WRONG',
  'HOST_REVEAL_ANSWER',
  'HOST_STRIKE',
  'HOST_CONFIRM_STEAL',
  'HOST_CANCEL_STEAL',
  'HOST_NEXT_ROUND',
  'HOST_AWARD_BUZZ',
  'HOST_PLAY',
  'HOST_PASS',
  'HOST_START_FAST_MONEY',
  'HOST_FM_END_ANSWERING',
  'HOST_FM_SUBMIT_ANSWERS',
  'HOST_FM_CONTINUE',
  'BUZZ',
  'PLAY',
  'PASS',
] as const;

export const socketActor = fromCallback<GameSocketActorEvent, SocketActorInput>(
  ({ input, sendBack, receive }) => {
    const { io, roomId } = input;

    io.on('connection', (socket: Socket) => {
      if (!socket.rooms.has(roomId)) return;

      const role = socket.handshake.query.role as ClientRole;
      const teamId = socket.handshake.query.teamId as TeamId | undefined;

      sendBack({ type: 'CLIENT_CONNECTED', role, teamId });

      for (const type of INBOUND_EVENT_TYPES) {
        socket.on(type, (data: unknown) => {
          if (!data || typeof data !== 'object') return;
          sendBack({ type, ...(data as Record<string, unknown>) });
        });
      }

      socket.on('disconnect', () => {
        sendBack({ type: 'CLIENT_DISCONNECTED', role, teamId });
      });
    });

    receive((event) => io.to(roomId).emit(event.type, event));

    return () => {
      io.to(roomId).disconnectSockets(true);
    };
  },
);
