# Machine Scaffold Reference

Full annotated generic machine scaffold following established patterns.

## statemachine.ts

```typescript
import { actions } from './actions';
import { timerActor } from './actors/timer';
import { socketActor, SocketActorInput } from './actors/websocket';
import { MyContext } from './context';
import { MyEvent } from './events/inbound';
import { guards } from './guards';
import { createActor, not, or, setup } from 'xstate';

export const createSessionMachine = (socketInfo: SocketActorInput) => {
  const machine = setup({
    types: {
      context: {} as MyContext,
      events: {} as MyEvent,
    },
    actions,
    guards,
    actors: { timerActor, socketActor },
  }).createMachine({
    id: 'session',
    initial: 'lobby',

    // socketActor at root — persists for entire machine lifetime
    invoke: {
      id: 'socket',
      src: 'socketActor',
      input: socketInfo,
    },

    context: {
      sessionId: '',
      config: {
        /* initial config values */
      },
      participants: [],
      // ... other context fields
    },

    states: {
      lobby: {
        initial: 'waiting',
        states: {
          waiting: {
            // always replaces client-emitted threshold events
            always: { guard: 'minParticipantsMet', target: 'ready' },
            on: {
              PARTICIPANT_JOINED: {
                actions: ['assignParticipant', 'notifyParticipantJoined'],
              },
              PARTICIPANT_LEFT: {
                actions: ['removeParticipant', 'notifyParticipantLeft'],
              },
              CONFIGURE: 'configuring',
            },
          },
          configuring: {
            on: {
              SAVE_CONFIG: {
                target: 'waiting',
                actions: ['assignConfig', 'notifyConfigSaved'],
              },
            },
          },
          ready: {
            entry: 'notifyReady',
            on: {
              PARTICIPANT_LEFT: {
                target: 'waiting',
                actions: ['removeParticipant', 'notifyParticipantLeft'],
              },
              START: {
                target: '#session.active', // absolute reference across hierarchy
                actions: ['assignStart', 'notifyStarted'],
              },
            },
          },
        },
      },

      active: {
        initial: 'turnInProgress',
        on: {
          CANCEL: {
            target: 'lobby',
            actions: 'notifyCancelled',
          },
          // Connection events at active level — fire in any sub-state
          PARTICIPANT_DISCONNECTED: {
            actions: ['assignParticipantDisconnected', 'notifyDisconnected'],
          },
          PARTICIPANT_RECONNECTED: {
            actions: ['assignParticipantReconnected', 'notifyReconnected'],
          },
        },
        states: {
          turnInProgress: {
            initial: 'awaitingAction',
            states: {
              awaitingAction: {
                // timerActor per-turn — stopped automatically on transition
                invoke: {
                  src: 'timerActor',
                  input: ({ context }) => ({
                    duration: context.config.turnDuration,
                  }),
                },
                on: {
                  ACTION_SUBMITTED: {
                    target: 'actionReceived',
                    actions: ['assignAction', 'notifyActionConfirmed'],
                  },
                  TIMER_EXPIRED: 'autoResolving',
                },
              },
              autoResolving: {
                on: {
                  AUTO_RESOLVED: {
                    target: 'actionReceived',
                    actions: ['assignAction', 'notifyActionConfirmed'],
                  },
                },
              },
              actionReceived: { type: 'final' },
            },
            onDone: { target: 'processingResult' }, // fires when actionReceived reached
          },

          processingResult: {
            initial: 'computing',
            states: {
              computing: {
                on: {
                  RESULT_COMPUTED: {
                    target: 'done',
                    actions: ['assignResult', 'notifyResultUpdated'],
                  },
                },
              },
              done: { type: 'final' },
            },
            onDone: { target: 'checkingEnd' },
          },

          checkingEnd: {
            always: [
              {
                guard: or([not('hasRoundsRemaining'), 'isPoolEmpty']),
                target: 'complete',
              },
              { target: 'advancingTurn' }, // guardless fallthrough
            ],
          },

          advancingTurn: {
            // assign first — notify reads updated context values
            entry: ['advanceTurn', 'notifyTurnAdvanced'],
            always: { target: 'turnInProgress' },
          },

          complete: {
            type: 'final',
            entry: 'notifyComplete',
          },
        },
        onDone: { target: 'results' },
      },

      results: {
        initial: 'viewing',
        states: {
          viewing: {
            on: { SESSION_CLOSED: '#session.closed' },
          },
        },
      },

      closed: { type: 'final' }, // triggers session destroy in service
    },
  });

  return createActor(machine).start();
};
```
