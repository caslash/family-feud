import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

/** Shape of the per-socket data this gateway stashes on `socket.data`. */
interface GameSocketData {
  roomCode?: string;
  createdRoomCode?: string;
}

/**
 * Connection-lifecycle-only gateway for the Family Feud game namespace.
 *
 * IMPORTANT: this gateway must never forward game events to the machine. The
 * socket actor invoked at the machine root (`game.socket.actor.ts`) already
 * listens on `io.on('connection')` for every socket in the room and owns all
 * inbound game events. A `@SubscribeMessage` handler here that re-sends
 * events to the actor would double-process every event. This gateway's only
 * job is: create/join/reject rooms on connect, and track socket counts per
 * room for empty-room teardown on disconnect.
 */
@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:3000',
    ],
  },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  io!: Server;

  private readonly logger = new Logger(GameGateway.name);

  /** Tracks the number of active sockets per room for cleanup purposes. */
  private readonly roomSocketCounts = new Map<string, number>();

  constructor(private readonly gameService: GameService) {
    // Clean up socket tracking when a room is destroyed internally (e.g. the
    // machine reaches its final `closed` state on host disconnect).
    this.gameService.onRoomDestroyed = (roomCode) => {
      this.roomSocketCounts.delete(roomCode);
    };
  }

  afterInit(): void {
    this.logger.log('Game gateway initialized');
  }

  handleConnection(socket: Socket) {
    const data = socket.data as GameSocketData;
    const roomCode = socket.handshake.query.roomCode as string | undefined;

    if (roomCode) {
      const room = this.gameService.getRoom(roomCode);

      if (!room) {
        this.logger.warn(
          `Socket ${socket.id} attempted to join non-existent room ${roomCode}`,
        );
        socket.emit('ERROR', { message: `Room ${roomCode} not found` });
        socket.disconnect();
        return;
      }

      data.roomCode = roomCode;
      // Synchronous under the default in-memory adapter: the socket actor's
      // own `connection` handler (game.socket.actor.ts) checks
      // socket.rooms.has(roomId) and relies on this join having already
      // completed by the time it runs.
      socket.join(roomCode);
      this.roomSocketCounts.set(
        roomCode,
        (this.roomSocketCounts.get(roomCode) ?? 0) + 1,
      );
      this.logger.log(`Socket ${socket.id} joined room ${roomCode}`);
      return;
    }

    // Temp socket used only to obtain a generated roomCode: it joins the
    // newly created room solely so the client can be told the code, and is
    // cleaned up in handleDisconnect below if no real participant ever joins.
    // Store it so handleDisconnect can clean up if no participant ever joins.
    let newRoomCode: string;
    try {
      newRoomCode = this.gameService.createRoom(this.io);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create room';
      this.logger.warn(`Socket ${socket.id} room creation failed: ${message}`);
      socket.emit('ERROR', { message });
      socket.disconnect();
      return;
    }
    data.createdRoomCode = newRoomCode;
    socket.join(newRoomCode);
    socket.emit('ROOM_CREATED', { roomCode: newRoomCode });
    this.logger.log(`Socket ${socket.id} created room ${newRoomCode}`);
  }

  handleDisconnect(socket: Socket) {
    const data = socket.data as GameSocketData;
    const roomCode = data.roomCode;

    if (!roomCode) {
      // Temp room-creation socket — destroy the room if no participant joined.
      const createdRoomCode = data.createdRoomCode;
      if (createdRoomCode && !this.roomSocketCounts.has(createdRoomCode)) {
        this.logger.log(
          `Destroying orphaned room ${createdRoomCode} — no participants joined`,
        );
        this.gameService.destroyRoom(createdRoomCode);
      } else {
        this.logger.debug(`Temp socket ${socket.id} disconnected`);
      }
      return;
    }

    const remaining = (this.roomSocketCounts.get(roomCode) ?? 1) - 1;
    if (remaining <= 0) {
      this.roomSocketCounts.delete(roomCode);
      this.logger.log(
        `Last participant left room ${roomCode} — destroying room`,
      );
      this.gameService.destroyRoom(roomCode);
    } else {
      this.roomSocketCounts.set(roomCode, remaining);
      this.logger.debug(
        `Socket ${socket.id} left room ${roomCode} (${remaining} remaining)`,
      );
    }
  }
}
