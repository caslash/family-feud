import { Injectable, Logger } from '@nestjs/common';
import ShortUniqueId from 'short-unique-id';
import type { Server } from 'socket.io';
import { createActor, type Actor, type Subscription } from 'xstate';
import { createGameMachine } from './game.machine';

const uid = new ShortUniqueId({ length: 5, dictionary: 'alphanum_upper' });

/** Maximum number of concurrent game rooms allowed. */
const MAX_ROOMS = 50;

/**
 * Manages the lifecycle of active game rooms and their XState actors.
 *
 * @example
 * const roomCode = gameService.createRoom(io);
 * gameService.getRoom(roomCode)?.send({ type: 'HOST_OPEN_BUZZER' });
 */
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  private readonly rooms = new Map<
    string,
    Actor<ReturnType<typeof createGameMachine>>
  >();

  private readonly subscriptions = new Map<string, Subscription>();

  /** Optional callback invoked when a room is destroyed (for external cleanup). */
  onRoomDestroyed?: (roomCode: string) => void;

  /**
   * Creates a new game room, starts its XState actor, and registers a
   * subscription to auto-destroy the room when the machine reaches its
   * final `closed` state (host disconnect).
   *
   * @param io - The Socket.io server instance.
   * @returns The newly created room code.
   * @throws {Error} When the room limit has been reached.
   */
  createRoom(io: Server): string {
    if (this.rooms.size >= MAX_ROOMS) {
      this.logger.warn(
        `Room limit reached (${MAX_ROOMS}) — rejecting new room creation`,
      );
      throw new Error('Room limit reached. Try again later.');
    }

    const roomCode = uid.randomUUID();

    const actor = createActor(
      createGameMachine({ io, roomId: roomCode }),
    ).start();

    const subscription = actor.subscribe((state) => {
      if (state.status === 'done') {
        this.logger.log(
          `Game machine for room ${roomCode} reached final state — triggering cleanup`,
        );
        this.destroyRoom(roomCode);
      }
    });

    this.subscriptions.set(roomCode, subscription);
    this.rooms.set(roomCode, actor);
    this.logger.log(
      `Game room ${roomCode} created (active rooms: ${this.rooms.size})`,
    );
    return roomCode;
  }

  /**
   * Retrieves the running XState actor for a given room.
   *
   * @param roomCode - The room code to look up.
   * @returns The actor instance, or `undefined` if the room does not exist.
   */
  getRoom(
    roomCode: string,
  ): Actor<ReturnType<typeof createGameMachine>> | undefined {
    return this.rooms.get(roomCode);
  }

  /**
   * Stops the XState actor for a room, cleans up its subscription, and
   * removes it from the active rooms map.
   *
   * @param roomCode - The room code to destroy.
   */
  destroyRoom(roomCode: string): void {
    const actor = this.rooms.get(roomCode);

    if (actor) {
      this.logger.log(
        `Game room ${roomCode} destroyed (active rooms: ${this.rooms.size - 1})`,
      );
      this.subscriptions.get(roomCode)?.unsubscribe();
      this.subscriptions.delete(roomCode);
      actor.stop();
      this.rooms.delete(roomCode);
      this.onRoomDestroyed?.(roomCode);
    }
  }
}
