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

/** Fast Money always asks the same fixed number of questions. */
const FAST_MONEY_QUESTION_COUNT = 5;

// Client-emitted machine events the socket actor forwards inbound. Server-
// derived events (CLIENT_CONNECTED / CLIENT_DISCONNECTED) are handled
// separately below and are never accepted directly off the wire.
// HOST_START_GAME / HOST_NEXT_ROUND / HOST_START_FAST_MONEY are handled by
// dedicated handlers below (they fetch questions server-side) and are
// deliberately excluded from this generic pass-through list.
const HOST_EVENT_TYPES = [
  'HOST_SET_TEAM_NAME',
  'HOST_SET_TARGET_SCORE',
  'HOST_OPEN_BUZZER',
  'HOST_MARK_CORRECT',
  'HOST_MARK_WRONG',
  'HOST_REVEAL_ANSWER',
  'HOST_STRIKE',
  'HOST_CONFIRM_STEAL',
  'HOST_CANCEL_STEAL',
  'HOST_AWARD_BUZZ',
  'HOST_PLAY',
  'HOST_PASS',
  'HOST_FM_END_ANSWERING',
  'HOST_FM_SUBMIT_ANSWERS',
  'HOST_FM_CONTINUE',
] as const;

// Events a player (identified by a handshake teamId) may emit. The payload's
// teamId is never trusted — see PLAYER_EVENT_TYPES handling below.
const PLAYER_EVENT_TYPES = ['BUZZ', 'PLAY', 'PASS'] as const;

export const socketActor = fromCallback<GameSocketActorEvent, SocketActorInput>(
  ({ input, sendBack, receive }) => {
    const { io, roomId, questions } = input;

    // Row ids already served this game; passed as exclusions so questions never
    // repeat. Scoped to the actor (one per room) and discarded on teardown.
    const servedIds = new Set<string>();

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

        socket.on('HOST_START_GAME', () => {
          void (async () => {
            const picked = await questions.getRandomStandard([...servedIds]);
            if (!picked) {
              socket.emit('ERROR', { message: 'No questions available' });
              return;
            }
            servedIds.add(picked.id);
            sendBack({ type: 'HOST_START_GAME', question: picked.question });
          })();
        });

        socket.on('HOST_NEXT_ROUND', () => {
          void (async () => {
            const picked = await questions.getRandomStandard([...servedIds]);
            if (!picked) {
              socket.emit('ERROR', { message: 'No questions available' });
              return;
            }
            servedIds.add(picked.id);
            sendBack({ type: 'HOST_NEXT_ROUND', question: picked.question });
          })();
        });

        socket.on('HOST_START_FAST_MONEY', () => {
          void (async () => {
            const picks = await questions.getRandomFastMoney(
              FAST_MONEY_QUESTION_COUNT,
              [...servedIds],
            );
            if (picks.length < FAST_MONEY_QUESTION_COUNT) {
              socket.emit('ERROR', {
                message: 'Not enough Fast Money questions',
              });
              return;
            }
            for (const p of picks) servedIds.add(p.id);
            sendBack({
              type: 'HOST_START_FAST_MONEY',
              questions: picks.map((p) => p.question),
            });
          })();
        });
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
