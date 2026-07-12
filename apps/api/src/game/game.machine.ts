import { setup } from 'xstate';
import { actions as assignActions } from './game.actions';
import { initialGameContext, type GameContext } from './game.context';
import type { GameEvent } from './game.events';
import { guards } from './game.guards';
import { notifyActions } from './game.notifies';
import { socketActor, type SocketActorInput } from './game.socket.actor';

/**
 * Creates a fresh Family Feud game machine for a single room. Returns the
 * machine definition, not a started actor — the caller (a future
 * `RoomService`, or a test) is responsible for `createActor(...).start()`.
 */
export function createGameMachine(input: SocketActorInput) {
  return setup({
    types: {
      context: {} as GameContext,
      events: {} as GameEvent,
    },
    actions: { ...assignActions, ...notifyActions },
    guards,
    actors: { socketActor },
  }).createMachine({
    id: 'game',
    initial: 'lobby',
    context: initialGameContext(input.roomId),

    invoke: { id: 'socket', src: 'socketActor', input },

    // Presence and host-disconnect teardown apply in every state.
    on: {
      CLIENT_CONNECTED: { actions: ['setPresence', 'notifyPresenceChanged'] },
      CLIENT_DISCONNECTED: [
        { guard: 'isHostRole', target: '#game.closed' },
        { actions: ['clearPresence', 'notifyPresenceChanged'] },
      ],
    },

    states: {
      lobby: {
        on: {
          HOST_SET_TEAM_NAME: {
            actions: ['setTeamName', 'notifyTeamNameSet'],
          },
          HOST_SET_TARGET_SCORE: {
            actions: ['setTargetScore', 'notifyTargetScoreSet'],
          },
          HOST_START_GAME: {
            guard: 'canStartGame',
            actions: ['loadQuestion', 'notifyRoundStarted'],
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
                entry: 'notifyBuzzerOpened',
                on: {
                  BUZZ: {
                    actions: ['setAnsweringTeam', 'notifyBuzzed'],
                    target: 'firstAnswer',
                  },
                  HOST_AWARD_BUZZ: {
                    actions: ['awardBuzz', 'notifyBuzzed'],
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
                        'notifyAnswerRevealed',
                        'recordFaceoffAnswer',
                        'takeControl',
                      ],
                      target: 'controlDecision',
                    },
                    {
                      actions: [
                        'revealSlotAndBank',
                        'notifyAnswerRevealed',
                        'recordFaceoffAnswer',
                        'flipAnsweringTeam',
                      ],
                      target: 'secondAnswer',
                    },
                  ],
                  HOST_MARK_WRONG: {
                    actions: ['flipAnsweringTeam', 'notifyAnswerWrong'],
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
                        'notifyAnswerRevealed',
                        'recordFaceoffAnswer',
                        'takeControl',
                      ],
                      target: 'controlDecision',
                    },
                    {
                      actions: [
                        'revealSlotAndBank',
                        'notifyAnswerRevealed',
                        'recordFaceoffAnswer',
                        'giveControlToOther',
                      ],
                      target: 'controlDecision',
                    },
                  ],
                  HOST_MARK_WRONG: [
                    {
                      guard: 'firstTeamHasAnswer',
                      actions: ['giveControlToOther', 'notifyAnswerWrong'],
                      target: 'controlDecision',
                    },
                    {
                      actions: ['flipAnsweringTeam', 'notifyAnswerWrong'],
                      target: 'bounceBack',
                    },
                  ],
                },
              },
              bounceBack: {
                on: {
                  HOST_MARK_CORRECT: {
                    actions: [
                      'revealSlotAndBank',
                      'notifyAnswerRevealed',
                      'takeControl',
                    ],
                    target: 'controlDecision',
                  },
                  HOST_MARK_WRONG: {
                    actions: ['flipAnsweringTeam', 'notifyAnswerWrong'],
                  },
                },
              },
              controlDecision: {
                entry: 'notifyControlDecision',
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
            entry: ['resetStrikes', 'notifyPlayBegan'],
            states: {
              awaitingGuess: {
                on: {
                  HOST_REVEAL_ANSWER: {
                    actions: ['revealSlotAndBank', 'notifyAnswerRevealed'],
                    target: 'checkingProgress',
                  },
                  HOST_STRIKE: {
                    actions: ['incrementStrike', 'notifyStrike'],
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
                entry: 'notifyStealStarted',
                states: {
                  awaitingStealGuess: {
                    on: {
                      HOST_REVEAL_ANSWER: {
                        guard: 'isUnrevealedSlot',
                        actions: ['stageStealReveal', 'notifyAnswerRevealed'],
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
                        actions: ['commitSteal', 'notifyStealSucceeded'],
                        target: '#game.roundEnd',
                      },
                      HOST_CANCEL_STEAL: {
                        actions: ['cancelStealReveal', 'notifyStealCancelled'],
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
        entry: 'notifyRoundEnded',
        states: {
          revealingBoard: {
            always: { guard: 'isBoardComplete', target: 'checkWin' },
            on: {
              HOST_REVEAL_ANSWER: {
                guard: 'isUnrevealedSlot',
                actions: ['revealSlotOnly', 'notifyAnswerRevealed'],
              },
            },
          },
          checkWin: {
            always: [
              {
                guard: 'targetReached',
                actions: ['setWinner', 'notifyFastMoneyReached'],
                target: '#game.fastMoney',
              },
              { target: 'awaitingNextRound' },
            ],
          },
          awaitingNextRound: {
            on: {
              HOST_NEXT_ROUND: {
                actions: ['startNextRound', 'notifyRoundStarted'],
                target: '#game.roundActive',
              },
            },
          },
        },
      },

      // Note the intentional asymmetry below: player1 has its own `reveal`
      // substate so player 1's answers are shown to the room before player 2
      // takes their turn, whereas player2.entry goes straight to `tally` —
      // player 2's board is revealed as part of the tally/gameOver flow.
      fastMoney: {
        initial: 'setup',
        states: {
          setup: {
            on: {
              HOST_START_FAST_MONEY: {
                actions: ['startFastMoney', 'notifyFastMoneyStarted'],
                target: 'player1',
              },
            },
          },
          player1: {
            initial: 'answering',
            states: {
              answering: {
                entry: 'notifyFm1AnsweringStarted',
                after: { 15000: 'entry' },
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
              entry: {
                on: {
                  HOST_FM_SUBMIT_ANSWERS: {
                    actions: ['submitPlayer1', 'notifyFmPlayer1Submitted'],
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
                entry: 'notifyFm2AnsweringStarted',
                after: { 20000: 'entry' },
                on: { HOST_FM_END_ANSWERING: 'entry' },
              },
              entry: {
                on: {
                  HOST_FM_SUBMIT_ANSWERS: {
                    actions: ['submitPlayer2', 'notifyFmPlayer2Submitted'],
                    target: '#game.fastMoney.tally',
                  },
                },
              },
            },
          },
          tally: {
            entry: ['tallyFastMoney', 'notifyFmResult'],
            always: '#game.gameOver',
          },
        },
      },

      gameOver: { entry: 'notifyGameOver' },

      closed: { type: 'final' },
    },
  });
}
