import { setup } from 'xstate';
import { actions } from './game.actions';
import { initialGameContext, type GameContext } from './game.context';
import type { GameEvent } from './game.events';
import { guards } from './game.guards';

/**
 * Creates a fresh Family Feud game machine for a single room. Returns the
 * machine definition, not a started actor — the caller (a future
 * `RoomService`, or a test) is responsible for `createActor(...).start()`.
 */
export function createGameMachine(roomCode: string) {
  return setup({
    types: {
      context: {} as GameContext,
      events: {} as GameEvent,
    },
    actions,
    guards,
  }).createMachine({
    id: 'game',
    initial: 'lobby',
    context: initialGameContext(roomCode),

    // Presence and host-disconnect teardown apply in every state.
    on: {
      CLIENT_CONNECTED: { actions: 'setPresence' },
      CLIENT_DISCONNECTED: [
        { guard: 'isHostRole', target: '#game.closed' },
        { actions: 'clearPresence' },
      ],
    },

    states: {
      lobby: {
        on: {
          HOST_SET_TEAM_NAME: { actions: 'setTeamName' },
          HOST_SET_TARGET_SCORE: { actions: 'setTargetScore' },
          HOST_START_GAME: {
            guard: 'canStartGame',
            actions: 'loadQuestion',
            target: 'roundActive',
          },
        },
      },

      roundActive: {
        initial: 'faceoff',
        states: {
          faceoff: {
            initial: 'ready',
            states: {
              ready: {
                on: { HOST_OPEN_BUZZER: 'buzzerOpen' },
              },
              buzzerOpen: {
                on: {
                  BUZZ: {
                    actions: 'setAnsweringTeam',
                    target: 'answerPending',
                  },
                },
              },
              answerPending: {
                on: {
                  HOST_MARK_CORRECT: {
                    actions: ['revealSlotAndBank', 'takeControl'],
                    target: 'controlDecision',
                  },
                  HOST_MARK_WRONG: { actions: 'flipAnsweringTeam' },
                },
              },
              controlDecision: {
                on: {
                  PLAY: {
                    guard: 'isDecidingTeam',
                    target: '#game.roundActive.play',
                  },
                  PASS: {
                    guard: 'isDecidingTeam',
                    actions: 'flipControl',
                    target: '#game.roundActive.play',
                  },
                },
              },
            },
          },

          play: {
            initial: 'awaitingGuess',
            entry: 'resetStrikes',
            states: {
              awaitingGuess: {
                on: {
                  HOST_REVEAL_ANSWER: {
                    actions: 'revealSlotAndBank',
                    target: 'checkingProgress',
                  },
                  HOST_STRIKE: {
                    actions: 'incrementStrike',
                    target: 'checkingProgress',
                  },
                },
              },
              checkingProgress: {
                always: [
                  {
                    guard: 'isBoardComplete',
                    actions: 'commitBankToController',
                    target: '#game.roundEnd',
                  },
                  { guard: 'reachedMaxStrikes', target: 'steal' },
                  { target: 'awaitingGuess' },
                ],
              },
              steal: {
                on: {
                  HOST_REVEAL_ANSWER: {
                    actions: ['revealSlotAndBank', 'commitBankToStealer'],
                    target: '#game.roundEnd',
                  },
                  HOST_STRIKE: {
                    actions: 'commitBankToController',
                    target: '#game.roundEnd',
                  },
                },
              },
            },
          },
        },
      },

      roundEnd: {
        initial: 'revealingBoard',
        states: {
          revealingBoard: {
            always: { guard: 'isBoardComplete', target: 'checkWin' },
            on: {
              HOST_REVEAL_ANSWER: {
                guard: 'isUnrevealedSlot',
                actions: 'revealSlotOnly',
              },
            },
          },
          checkWin: {
            always: [
              {
                guard: 'targetReached',
                actions: 'setWinner',
                target: '#game.gameOver',
              },
              { target: 'awaitingNextRound' },
            ],
          },
          awaitingNextRound: {
            on: {
              HOST_NEXT_ROUND: {
                actions: 'startNextRound',
                target: '#game.roundActive',
              },
            },
          },
        },
      },

      gameOver: {},

      closed: { type: 'final' },
    },
  });
}
