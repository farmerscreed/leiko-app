import { createActor } from 'xstate';
import {
  BACKOFF_LADDER_MS,
  MAX_RETRIES,
  backoffDelay,
  connectionMachine,
} from '../connectionMachine';

describe('backoffDelay', () => {
  it('returns 5s for the first retry (retryCount=1)', () => {
    expect(backoffDelay(1)).toBe(5_000);
  });

  it('walks the ladder for retries 1..6', () => {
    expect([1, 2, 3, 4, 5, 6].map(backoffDelay)).toEqual([
      ...BACKOFF_LADDER_MS,
    ]);
  });

  it('clamps to the last value past the ladder length', () => {
    expect(backoffDelay(99)).toBe(15 * 60_000);
  });

  it('treats retryCount=0 as the first ladder value (defensive)', () => {
    expect(backoffDelay(0)).toBe(5_000);
  });
});

describe('connectionMachine — initial state', () => {
  it('starts in uninitialized', () => {
    const actor = createActor(connectionMachine).start();
    expect(actor.getSnapshot().value).toBe('uninitialized');
    actor.stop();
  });

  it('moves to idle on BT_READY', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});

describe('connectionMachine — happy path', () => {
  it('idle → scanning → connecting → connected', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'SCAN' });
    expect(actor.getSnapshot().value).toBe('scanning');
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    expect(actor.getSnapshot().value).toBe('connecting');
    expect(actor.getSnapshot().context.deviceId).toBe('aa:bb');
    actor.send({ type: 'CONNECTED' });
    expect(actor.getSnapshot().value).toBe('connected');
    actor.stop();
  });

  it('connected → syncing → connected', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    actor.send({ type: 'CONNECTED' });
    actor.send({ type: 'SYNC_START' });
    expect(actor.getSnapshot().value).toBe('syncing');
    actor.send({ type: 'SYNC_DONE' });
    expect(actor.getSnapshot().value).toBe('connected');
    actor.stop();
  });

  it('resets retryCount + records lastConnectedAt on CONNECTED', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    actor.send({ type: 'ERROR', message: 'first fail' });
    expect(actor.getSnapshot().context.retryCount).toBe(1);
    actor.stop();
  });
});

describe('connectionMachine — cancel during scan', () => {
  it('scanning → idle on CANCEL', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'SCAN' });
    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});

describe('connectionMachine — failure + reconnection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('connecting → reconnecting → connecting (after 5s)', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    actor.send({ type: 'ERROR', message: 'boom' });
    expect(actor.getSnapshot().value).toBe('reconnecting');
    expect(actor.getSnapshot().context.retryCount).toBe(1);
    expect(actor.getSnapshot().context.lastError).toBe('boom');

    jest.advanceTimersByTime(5_000);
    expect(actor.getSnapshot().value).toBe('connecting');
    actor.stop();
  });

  it('mid-connection DISCONNECTED → reconnecting', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    actor.send({ type: 'CONNECTED' });
    actor.send({ type: 'DISCONNECTED', reason: 'out_of_range' });
    expect(actor.getSnapshot().value).toBe('reconnecting');
    expect(actor.getSnapshot().context.lastError).toBe('out_of_range');
    actor.stop();
  });

  it('DISCONNECTED during syncing → reconnecting', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    actor.send({ type: 'CONNECTED' });
    actor.send({ type: 'SYNC_START' });
    actor.send({ type: 'DISCONNECTED' });
    expect(actor.getSnapshot().value).toBe('reconnecting');
    actor.stop();
  });

  it('walks the backoff ladder over consecutive failures', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });

    for (let i = 0; i < BACKOFF_LADDER_MS.length; i++) {
      actor.send({ type: 'ERROR', message: `fail ${i + 1}` });
      expect(actor.getSnapshot().value).toBe('reconnecting');
      expect(actor.getSnapshot().context.retryCount).toBe(i + 1);
      jest.advanceTimersByTime(BACKOFF_LADDER_MS[i]);
      expect(actor.getSnapshot().value).toBe('connecting');
    }
    actor.stop();
  });

  it(`gives up after ${MAX_RETRIES} retries (returns to idle, retryCount reset)`, () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });

    for (let i = 0; i < MAX_RETRIES; i++) {
      actor.send({ type: 'ERROR', message: `fail ${i + 1}` });
      jest.advanceTimersByTime(BACKOFF_LADDER_MS[Math.min(i, BACKOFF_LADDER_MS.length - 1)]);
    }
    // 7th failure should trip the cap
    actor.send({ type: 'ERROR', message: 'final' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.retryCount).toBe(0);
    actor.stop();
  });

  it('retryCount resets to 0 on successful CONNECTED', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_READY' });
    actor.send({ type: 'CONNECT', deviceId: 'aa:bb' });
    actor.send({ type: 'ERROR', message: 'fail' });
    actor.send({ type: 'ERROR', message: 'fail again' });
    // we're now in reconnecting with retryCount=2; advance to connecting
    jest.advanceTimersByTime(BACKOFF_LADDER_MS[1]);
    expect(actor.getSnapshot().value).toBe('connecting');
    actor.send({ type: 'CONNECTED' });
    expect(actor.getSnapshot().context.retryCount).toBe(0);
    expect(actor.getSnapshot().context.lastError).toBeNull();
    actor.stop();
  });
});

describe('connectionMachine — BT_OFF (global)', () => {
  it.each([
    ['uninitialized', [] as Array<{ type: string }>],
    ['idle', [{ type: 'BT_READY' }]],
    ['scanning', [{ type: 'BT_READY' }, { type: 'SCAN' }]],
    [
      'connecting',
      [{ type: 'BT_READY' }, { type: 'CONNECT', deviceId: 'aa:bb' }],
    ],
    [
      'connected',
      [
        { type: 'BT_READY' },
        { type: 'CONNECT', deviceId: 'aa:bb' },
        { type: 'CONNECTED' },
      ],
    ],
    [
      'syncing',
      [
        { type: 'BT_READY' },
        { type: 'CONNECT', deviceId: 'aa:bb' },
        { type: 'CONNECTED' },
        { type: 'SYNC_START' },
      ],
    ],
  ])('any state (here: %s) goes to powered_off on BT_OFF', (_label, setup) => {
    const actor = createActor(connectionMachine).start();
    for (const ev of setup) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actor.send(ev as any);
    }
    actor.send({ type: 'BT_OFF' });
    expect(actor.getSnapshot().value).toBe('powered_off');
    actor.stop();
  });

  it('powered_off → idle on BT_READY', () => {
    const actor = createActor(connectionMachine).start();
    actor.send({ type: 'BT_OFF' });
    expect(actor.getSnapshot().value).toBe('powered_off');
    actor.send({ type: 'BT_READY' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });
});
