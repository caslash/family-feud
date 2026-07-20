import type { GameSocketActorEvent } from '@family-feud/types';
import type { Server } from 'socket.io';
import { QuestionService } from '../question/question.service';
import { GameService } from './game.service';

/**
 * The socketActor stub is a no-op — the service tests only care about actor
 * lifecycle (creation, storage, destruction, auto-teardown), not socket I/O.
 * vi.hoisted keeps this accessible inside the vi.mock factory, which is
 * hoisted above all imports (same technique as game.machine.spec.ts).
 */
vi.mock('./game.socket.actor', async () => {
  const { fromCallback } = await import('xstate');
  return {
    socketActor: fromCallback<GameSocketActorEvent, unknown>(() => {
      return () => {};
    }),
  };
});

function makeIo(): Server {
  return {} as unknown as Server;
}

describe('GameService', () => {
  let service: GameService;

  beforeEach(() => {
    service = new GameService({
      getRandomStandard: () => Promise.resolve(null),
      getRandomFastMoney: () => Promise.resolve([]),
    } as unknown as QuestionService);
  });

  describe('createRoom', () => {
    it('returns a 5-char uppercase alphanumeric room code', () => {
      const roomCode = service.createRoom(makeIo());
      expect(roomCode).toMatch(/^[A-Z0-9]{5}$/);
    });

    it('generates distinct codes across repeated calls', () => {
      const codes = new Set(
        Array.from({ length: 10 }, () => service.createRoom(makeIo())),
      );
      expect(codes.size).toBe(10);
    });

    it('throws once the room limit is reached', () => {
      for (let i = 0; i < 50; i++) {
        service.createRoom(makeIo());
      }
      expect(() => service.createRoom(makeIo())).toThrow(/room limit/i);
    });
  });

  describe('getRoom', () => {
    it('returns the started actor for a known room code', () => {
      const roomCode = service.createRoom(makeIo());
      const actor = service.getRoom(roomCode);
      expect(actor).toBeDefined();
      expect(actor?.getSnapshot().status).toBe('active');
    });

    it('returns undefined for an unknown room code', () => {
      expect(service.getRoom('nope')).toBeUndefined();
    });
  });

  describe('destroyRoom', () => {
    it('stops the actor, removes it from the map, and calls onRoomDestroyed', () => {
      const roomCode = service.createRoom(makeIo());
      const actor = service.getRoom(roomCode);
      const onRoomDestroyed = vi.fn();
      service.onRoomDestroyed = onRoomDestroyed;

      service.destroyRoom(roomCode);

      expect(actor?.getSnapshot().status).toBe('stopped');
      expect(service.getRoom(roomCode)).toBeUndefined();
      expect(onRoomDestroyed).toHaveBeenCalledWith(roomCode);
    });
  });

  describe('auto-teardown', () => {
    it('destroys the room when the machine reaches its final closed state', () => {
      const roomCode = service.createRoom(makeIo());
      const actor = service.getRoom(roomCode)!;

      actor.send({ type: 'CLIENT_CONNECTED', role: 'host' });
      actor.send({ type: 'CLIENT_DISCONNECTED', role: 'host' });

      expect(service.getRoom(roomCode)).toBeUndefined();
    });
  });
});
