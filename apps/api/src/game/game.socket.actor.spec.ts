import { EventEmitter } from 'node:events';
import type { Server, Socket } from 'socket.io';
import { assign, createActor, createMachine } from 'xstate';
import type { GameEvent } from './game.events';
import { socketActor } from './game.socket.actor';

const ROOM_ID = 'ROOM1';

/**
 * Minimal EventEmitter-backed stub for the Socket.io `Server`. `on`/`off`
 * (inherited from EventEmitter) let us drive `connection` and assert
 * listener counts; `to(roomId)` returns spies we can assert against.
 */
function makeFakeIo() {
  const emitter = new EventEmitter();
  const toTarget = { emit: vi.fn(), disconnectSockets: vi.fn() };
  const to = vi.fn(() => toTarget);
  return Object.assign(emitter, { to, toTarget }) as unknown as Server & {
    to: typeof to;
    toTarget: typeof toTarget;
  };
}

/**
 * Minimal EventEmitter-backed stub for a client Socket. `socket.emit(type,
 * data)` simulates the client sending an inbound message (triggers whatever
 * the actor registered via `socket.on(type, ...)`); `socket.emit('disconnect')`
 * simulates disconnection.
 */
function makeFakeSocket(query: Record<string, string | undefined>) {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    handshake: { query },
    rooms: new Set([ROOM_ID]),
  }) as unknown as Socket;
}

/** Invokes the real socketActor as a child of a tiny harness machine so we
 * can capture every event it `sendBack`s to its parent, and reach the child
 * ref to simulate outbound `receive()` delivery. */
function makeHarness(io: Server) {
  const received: GameEvent[] = [];
  const machine = createMachine({
    types: {},
    context: {},
    invoke: {
      id: 'socket',
      src: socketActor,
      input: { io, roomId: ROOM_ID },
    },
    on: {
      '*': {
        actions: assign(({ event }) => {
          received.push(event);
          return {};
        }),
      },
    },
  });
  const actor = createActor(machine).start();
  return { actor, received };
}

describe('socketActor', () => {
  describe('inbound event-type injection (C1)', () => {
    it('does not let a payload `type` field override the registered event name', () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'host' });

      io.emit('connection', socket);
      socket.emit('HOST_MARK_WRONG', {
        type: 'CLIENT_DISCONNECTED',
        role: 'host',
      });

      expect(received).not.toContainEqual(
        expect.objectContaining({ type: 'CLIENT_DISCONNECTED', role: 'host' }),
      );
      expect(received).toContainEqual(
        expect.objectContaining({ type: 'HOST_MARK_WRONG' }),
      );
    });
  });

  describe('role authorization on inbound events (I1)', () => {
    it('ignores HOST_* events from a non-host socket', () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'player', teamId: 'home' });

      io.emit('connection', socket);
      received.length = 0; // drop CLIENT_CONNECTED noise
      socket.emit('HOST_MARK_WRONG', {});

      expect(received).toEqual([]);
    });

    it('ignores BUZZ/PLAY/PASS from sockets with no handshake teamId (host/board)', () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'board' });

      io.emit('connection', socket);
      received.length = 0;
      socket.emit('BUZZ', { teamId: 'home' });

      expect(received).toEqual([]);
    });

    it("derives a player's BUZZ teamId from the handshake, not a spoofed payload teamId", () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'player', teamId: 'home' });

      io.emit('connection', socket);
      socket.emit('BUZZ', { teamId: 'away' });

      expect(received).toContainEqual({ type: 'BUZZ', teamId: 'home' });
      expect(received).not.toContainEqual(
        expect.objectContaining({ type: 'BUZZ', teamId: 'away' }),
      );
    });

    it("derives a player's PLAY/PASS teamId from the handshake, not the payload", () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'player', teamId: 'away' });

      io.emit('connection', socket);
      socket.emit('PLAY', { teamId: 'home' });
      socket.emit('PASS', { teamId: 'home' });

      expect(received).toContainEqual({ type: 'PLAY', teamId: 'away' });
      expect(received).toContainEqual({ type: 'PASS', teamId: 'away' });
    });
  });

  describe('connection listener cleanup (I3)', () => {
    it('removes the connection listener when the actor is stopped', () => {
      const io = makeFakeIo();
      expect(io.listenerCount('connection')).toBe(0);

      const { actor } = makeHarness(io);
      expect(io.listenerCount('connection')).toBe(1);

      actor.stop();
      expect(io.listenerCount('connection')).toBe(0);
    });

    it('still disconnects the room sockets on cleanup', () => {
      const io = makeFakeIo();
      const { actor } = makeHarness(io);

      actor.stop();

      expect(io.to).toHaveBeenCalledWith(ROOM_ID);
      expect(io.toTarget.disconnectSockets).toHaveBeenCalledWith(true);
    });
  });

  describe('presence derivation (unchanged behavior)', () => {
    it('sends CLIENT_CONNECTED derived from the handshake on connect', () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'player', teamId: 'home' });

      io.emit('connection', socket);

      expect(received).toContainEqual({
        type: 'CLIENT_CONNECTED',
        role: 'player',
        teamId: 'home',
      });
    });

    it('sends CLIENT_DISCONNECTED derived from the handshake on disconnect', () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'player', teamId: 'away' });

      io.emit('connection', socket);
      socket.emit('disconnect');

      expect(received).toContainEqual({
        type: 'CLIENT_DISCONNECTED',
        role: 'player',
        teamId: 'away',
      });
    });

    it('ignores sockets that have not joined this room', () => {
      const io = makeFakeIo();
      const { received } = makeHarness(io);
      const socket = makeFakeSocket({ role: 'host' });
      socket.rooms.delete(ROOM_ID);

      io.emit('connection', socket);

      expect(received).toEqual([]);
    });
  });

  describe('outbound receive -> emit (unchanged behavior)', () => {
    it('forwards machine notify events to the room via io.to(roomId).emit', () => {
      const io = makeFakeIo();
      const { actor } = makeHarness(io);

      const snapshot = actor.getSnapshot() as unknown as {
        children: { socket: { send: (e: unknown) => void } };
      };
      snapshot.children.socket.send({
        type: 'NOTIFY_STRIKE',
        strikes: 1,
      });

      expect(io.to).toHaveBeenCalledWith(ROOM_ID);
      expect(io.toTarget.emit).toHaveBeenCalledWith('NOTIFY_STRIKE', {
        type: 'NOTIFY_STRIKE',
        strikes: 1,
      });
    });
  });
});
