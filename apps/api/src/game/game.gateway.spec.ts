import type { Server, Socket } from 'socket.io';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

function makeSocket(id: string, query: Record<string, string> = {}) {
  return {
    id,
    handshake: { query },
    data: {} as Record<string, unknown>,
    join: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeGameService() {
  return {
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    destroyRoom: vi.fn(),
  };
}

describe('GameGateway', () => {
  let gameService: ReturnType<typeof makeGameService>;
  let gateway: GameGateway;

  beforeEach(() => {
    gameService = makeGameService();
    gateway = new GameGateway(gameService as unknown as GameService);
    gateway.io = {} as unknown as Server;
  });

  describe('handleConnection', () => {
    it('joins an existing room when roomCode is valid', () => {
      gameService.getRoom.mockReturnValue({ id: 'actor' });
      const socket = makeSocket('s1', { roomCode: 'ABCDE' });

      gateway.handleConnection(socket as unknown as Socket);

      expect(socket.join).toHaveBeenCalledWith('ABCDE');
      expect(socket.data.roomCode).toBe('ABCDE');
      expect(socket.emit).not.toHaveBeenCalledWith('ERROR', expect.anything());
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('rejects and disconnects when roomCode is unknown', () => {
      gameService.getRoom.mockReturnValue(undefined);
      const socket = makeSocket('s1', { roomCode: 'ZZZZZ' });

      gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith('ERROR', {
        message: 'Room ZZZZZ not found',
      });
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('creates a room and emits ROOM_CREATED when no roomCode is given', () => {
      gameService.createRoom.mockReturnValue('NEWID');
      const socket = makeSocket('s1');

      gateway.handleConnection(socket as unknown as Socket);

      expect(gameService.createRoom).toHaveBeenCalledWith(gateway.io);
      expect(socket.join).toHaveBeenCalledWith('NEWID');
      expect(socket.emit).toHaveBeenCalledWith('ROOM_CREATED', {
        roomCode: 'NEWID',
      });
      expect(socket.data.createdRoomCode).toBe('NEWID');
    });

    it('emits ERROR and disconnects when room creation fails', () => {
      gameService.createRoom.mockImplementation(() => {
        throw new Error('Room limit reached. Try again later.');
      });
      const socket = makeSocket('s1');

      gateway.handleConnection(socket as unknown as Socket);

      expect(socket.emit).toHaveBeenCalledWith('ERROR', {
        message: 'Room limit reached. Try again later.',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('destroys the room when the last joined socket disconnects', () => {
      gameService.getRoom.mockReturnValue({ id: 'actor' });
      const socket = makeSocket('s1', { roomCode: 'ABCDE' });
      gateway.handleConnection(socket as unknown as Socket);

      gateway.handleDisconnect(socket as unknown as Socket);

      expect(gameService.destroyRoom).toHaveBeenCalledWith('ABCDE');
    });

    it('does not destroy the room when other sockets remain', () => {
      gameService.getRoom.mockReturnValue({ id: 'actor' });
      const socket1 = makeSocket('s1', { roomCode: 'ABCDE' });
      const socket2 = makeSocket('s2', { roomCode: 'ABCDE' });
      gateway.handleConnection(socket1 as unknown as Socket);
      gateway.handleConnection(socket2 as unknown as Socket);

      gateway.handleDisconnect(socket1 as unknown as Socket);

      expect(gameService.destroyRoom).not.toHaveBeenCalled();
    });

    it('destroys an orphaned created room that no participant ever joined', () => {
      gameService.createRoom.mockReturnValue('NEWID');
      const socket = makeSocket('s1');
      gateway.handleConnection(socket as unknown as Socket);

      gateway.handleDisconnect(socket as unknown as Socket);

      expect(gameService.destroyRoom).toHaveBeenCalledWith('NEWID');
    });

    it('does not destroy a created room once a participant has joined it', () => {
      gameService.createRoom.mockReturnValue('NEWID');
      gameService.getRoom.mockReturnValue({ id: 'actor' });

      const creatorSocket = makeSocket('s1');
      gateway.handleConnection(creatorSocket as unknown as Socket);

      const participantSocket = makeSocket('s2', { roomCode: 'NEWID' });
      gateway.handleConnection(participantSocket as unknown as Socket);

      gateway.handleDisconnect(creatorSocket as unknown as Socket);

      expect(gameService.destroyRoom).not.toHaveBeenCalled();
    });
  });

  describe('afterInit', () => {
    it('logs that the gateway initialized', () => {
      const logger = gateway['logger'] as { log: (msg: string) => void };
      const logSpy = vi.spyOn(logger, 'log');
      gateway.afterInit();
      expect(logSpy).toHaveBeenCalledWith('Game gateway initialized');
    });
  });
});
