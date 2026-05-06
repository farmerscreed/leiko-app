import { setup, assign } from 'xstate';

export type ConnectionContext = {
  deviceId: string | null;
  retryCount: number;
  lastError: string | null;
  lastConnectedAt: number | null;
};

export type ConnectionEvent =
  | { type: 'BT_READY' }
  | { type: 'BT_OFF' }
  | { type: 'SCAN' }
  | { type: 'CANCEL' }
  | { type: 'CONNECT'; deviceId: string }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED'; reason?: string }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_DONE' }
  | { type: 'ERROR'; message: string };

export const MAX_RETRIES = 6;
export const BACKOFF_LADDER_MS = [
  5_000,
  15_000,
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
] as const;

export function backoffDelay(retryCount: number): number {
  const idx = Math.min(Math.max(retryCount - 1, 0), BACKOFF_LADDER_MS.length - 1);
  return BACKOFF_LADDER_MS[idx];
}

const initialContext: ConnectionContext = {
  deviceId: null,
  retryCount: 0,
  lastError: null,
  lastConnectedAt: null,
};

export const connectionMachine = setup({
  types: {
    context: {} as ConnectionContext,
    events: {} as ConnectionEvent,
  },
  guards: {
    retriesExhausted: ({ context }) => context.retryCount > MAX_RETRIES,
  },
  delays: {
    backoff: ({ context }) => backoffDelay(context.retryCount),
  },
  actions: {
    storeDeviceId: assign({
      deviceId: ({ event }) =>
        event.type === 'CONNECT' ? event.deviceId : null,
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    resetOnConnect: assign({
      retryCount: 0,
      lastError: null,
      lastConnectedAt: () => Date.now(),
    }),
    resetRetry: assign({
      retryCount: 0,
    }),
    captureError: assign({
      lastError: ({ event }) => {
        if (event.type === 'ERROR') return event.message;
        if (event.type === 'DISCONNECTED') return event.reason ?? 'disconnected';
        return null;
      },
    }),
  },
}).createMachine({
  id: 'ble',
  initial: 'uninitialized',
  context: initialContext,
  on: {
    BT_OFF: { target: '.powered_off' },
  },
  states: {
    uninitialized: {
      on: {
        BT_READY: { target: 'idle' },
      },
    },
    powered_off: {
      on: {
        BT_READY: { target: 'idle' },
      },
    },
    idle: {
      on: {
        SCAN: { target: 'scanning' },
        CONNECT: { target: 'connecting', actions: 'storeDeviceId' },
      },
    },
    scanning: {
      on: {
        CANCEL: { target: 'idle' },
        CONNECT: { target: 'connecting', actions: 'storeDeviceId' },
      },
    },
    connecting: {
      on: {
        CONNECTED: { target: 'connected', actions: 'resetOnConnect' },
        ERROR: {
          target: 'reconnecting',
          actions: ['captureError', 'incrementRetry'],
        },
        DISCONNECTED: {
          target: 'reconnecting',
          actions: ['captureError', 'incrementRetry'],
        },
      },
    },
    connected: {
      on: {
        SYNC_START: { target: 'syncing' },
        DISCONNECTED: {
          target: 'reconnecting',
          actions: ['captureError', 'incrementRetry'],
        },
      },
    },
    syncing: {
      on: {
        SYNC_DONE: { target: 'connected' },
        DISCONNECTED: {
          target: 'reconnecting',
          actions: ['captureError', 'incrementRetry'],
        },
      },
    },
    reconnecting: {
      always: [
        {
          guard: 'retriesExhausted',
          target: 'idle',
          actions: 'resetRetry',
        },
      ],
      after: {
        backoff: { target: 'connecting' },
      },
    },
  },
});

export type ConnectionMachine = typeof connectionMachine;
