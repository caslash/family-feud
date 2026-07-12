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
                  BUZZ: { actions: 'setAnsweringTeam', target: 'firstAnswer' },
                  HOST_AWARD_BUZZ: {
                    actions: 'awardBuzz',
                    target: 'firstAnswer',
                  },
                },
              },
              firstAnswer: {
                on: {
                  HOST_MARK_CORRECT: [
                    {
                      guard: 'isTopAnswer',
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'takeControl',
                      ],
                      target: 'controlDecision',
                    },
                    {
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'flipAnsweringTeam',
                      ],
                      target: 'secondAnswer',
                    },
                  ],
                  HOST_MARK_WRONG: {
                    actions: 'flipAnsweringTeam',
                    target: 'secondAnswer',
                  },
                },
              },
              secondAnswer: {
                on: {
                  HOST_MARK_CORRECT: [
                    {
                      guard: 'secondBeatsFirst',
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'takeControl',
                      ],
                      target: 'controlDecision',
                    },
                    {
                      actions: [
                        'revealSlotAndBank',
                        'recordFaceoffAnswer',
                        'giveControlToOther',
                      ],
                      target: 'controlDecision',
                    },
                  ],
                  HOST_MARK_WRONG: [
                    {
                      guard: 'firstTeamHasAnswer',
                      actions: 'giveControlToOther',
                      target: 'controlDecision',
                    },
                    {
                      actions: 'flipAnsweringTeam',
                      target: 'bounceBack',
                    },
                  ],
                },
              },
              bounceBack: {
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
                  HOST_PLAY: { target: '#game.roundActive.play' },
                  HOST_PASS: {
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
                initial: 'awaitingStealGuess',
                states: {
                  awaitingStealGuess: {
                    on: {
                      HOST_REVEAL_ANSWER: {
                        guard: 'isUnrevealedSlot',
                        actions: 'stageStealReveal',
                        target: 'confirmingSteal',
                      },
                      HOST_STRIKE: {
                        actions: 'commitBankToController',
                        target: '#game.roundEnd',
                      },
                    },
                  },
                  confirmingSteal: {
                    on: {
                      HOST_CONFIRM_STEAL: {
                        actions: 'commitSteal',
                        target: '#game.roundEnd',
                      },
                      HOST_CANCEL_STEAL: {
                        actions: 'cancelStealReveal',
                        target: 'awaitingStealGuess',
                      },
                    },
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
                target: '#game.fastMoney',
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

      fastMoney: {
        initial: 'setup',
        states: {
          setup: {
            on: {
              HOST_START_FAST_MONEY: {
                actions: 'startFastMoney',
                target: 'player1',
              },
            },
          },
          player1: {
            initial: 'answering',
            states: {
              answering: {
                after: { 15000: 'entry' },
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
              entry: {
                on: {
                  HOST_FM_SUBMIT_ANSWERS: {
                    actions: 'submitPlayer1',
                    target: 'reveal',
                  },
                },
              },
              reveal: {
                on: { HOST_FM_CONTINUE: '#game.fastMoney.player2' },
              },
            },
          },
          player2: {
            initial: 'answering',
            states: {
              answering: {
                after: { 20000: 'entry' },
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
              entry: {
                on: {
                  HOST_FM_SUBMIT_ANSWERS: {
                    actions: 'submitPlayer2',
                    target: '#game.fastMoney.tally',
                  },
                },
              },
            },
          },
          tally: {
            entry: 'tallyFastMoney',
            always: '#game.gameOver',
          },
        },
      },

      gameOver: {},

      closed: { type: 'final' },
    },
  });
}
