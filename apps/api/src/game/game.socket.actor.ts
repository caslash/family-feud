import type { GameSocketActorEvent } from '@family-feud/types';
import type { Server, Socket } from 'socket.io';
import { fromCallback } from 'xstate';
import type { ClientRole, TeamId } from './game.types';
import type { QuestionProvider } from './game.questions';

export type SocketActorInput = {
  io: Server;
  roomId: string;
  questions: QuestionProvider;
};

// Client-emitted machine events the socket actor forwards inbound. Server-
// derived events (CLIENT_CONNECTED / CLIENT_DISCONNECTED) are handled
// separately below and are never accepted directly off the wire.
const HOST_EVENT_TYPES = [
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
] as const;

// Events a player (identified by a handshake teamId) may emit. The payload's
// teamId is never trusted — see PLAYER_EVENT_TYPES handling below.
const PLAYER_EVENT_TYPES = ['BUZZ', 'PLAY', 'PASS'] as const;

export const socketActor = fromCallback<GameSocketActorEvent, SocketActorInput>(
  ({ input, sendBack, receive }) => {
    const { io, roomId } = input;

    const onConnection = (socket: Socket) => {
      // Relies on the gateway's synchronous socket.join(roomCode) (the
      // default in-memory adapter) having already completed by the time this
      // connection handler runs, so socket.rooms reflects membership here.
      if (!socket.rooms.has(roomId)) return;

      const role = socket.handshake.query.role as ClientRole;
      const teamId = socket.handshake.query.teamId as TeamId | undefined;

      sendBack({ type: 'CLIENT_CONNECTED', role, teamId });

      // Host-authoritative transport edge: HOST_* events are only accepted
      // from sockets that authenticated as the host.
      if (role === 'host') {
        for (const type of HOST_EVENT_TYPES) {
          socket.on(type, (data: unknown) => {
            if (!data || typeof data !== 'object') return;
            // Spread first, force the trusted `type` last — a `type` field
            // inside client-supplied `data` must never override the
            // registered (allowlisted) event name.
            sendBack({ ...(data as Record<string, unknown>), type });
          });
        }
      }

      // Player-only events. teamId is always derived from the socket's
      // handshake, never trusted from the payload — otherwise a player could
      // spoof the other team. Sockets without a handshake teamId (host,
      // board) cannot emit these at all.
      if (teamId) {
        for (const type of PLAYER_EVENT_TYPES) {
          socket.on(type, (data: unknown) => {
            if (!data || typeof data !== 'object') return;
            sendBack({
              ...(data as Record<string, unknown>),
              type,
              teamId,
            });
          });
        }
      }

      socket.on('disconnect', () => {
        sendBack({ type: 'CLIENT_DISCONNECTED', role, teamId });
      });
    };

    io.on('connection', onConnection);

    receive((event) => io.to(roomId).emit(event.type, event));

    return () => {
      io.to(roomId).disconnectSockets(true);
      io.off('connection', onConnection);
    };
  },
);
