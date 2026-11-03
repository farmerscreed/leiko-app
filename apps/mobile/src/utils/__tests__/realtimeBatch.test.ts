// realtimeBatch (2026-11-03): a burst of realtime INSERTs becomes one
// flush, and nothing runs while the app is in the background.

let appState = 'active';
let listener: ((s: string) => void) | null = null;

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return appState;
    },
    addEventListener: (_: string, cb: (s: string) => void) => {
      listener = cb;
      return { remove: () => undefined };
    },
  },
}));

import { createRealtimeBatcher, REALTIME_BATCH_DELAY_MS } from '../realtimeBatch';

beforeEach(() => {
  jest.useFakeTimers();
  appState = 'active';
  listener = null;
});

afterEach(() => {
  jest.useRealTimers();
});

it('coalesces a burst into one flush after the last event', () => {
  const onFlush = jest.fn();
  const b = createRealtimeBatcher(onFlush);
  for (let i = 0; i < 300; i++) b.notify();
  jest.advanceTimersByTime(REALTIME_BATCH_DELAY_MS - 1);
  expect(onFlush).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(onFlush).toHaveBeenCalledTimes(1);
  expect(onFlush).toHaveBeenCalledWith(300);
  b.dispose();
});

it('does nothing in the background, then flushes once on return', () => {
  const onFlush = jest.fn();
  const b = createRealtimeBatcher(onFlush);
  appState = 'background';
  for (let i = 0; i < 50; i++) b.notify();
  jest.advanceTimersByTime(60_000);
  expect(onFlush).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0); // nothing wakes the JS thread
  appState = 'active';
  listener?.('active');
  jest.advanceTimersByTime(REALTIME_BATCH_DELAY_MS);
  expect(onFlush).toHaveBeenCalledTimes(1);
  expect(onFlush).toHaveBeenCalledWith(50);
  b.dispose();
});

it('a burst that ends as the app goes to the background waits for return', () => {
  const onFlush = jest.fn();
  const b = createRealtimeBatcher(onFlush);
  b.notify();
  appState = 'background';
  jest.advanceTimersByTime(REALTIME_BATCH_DELAY_MS);
  expect(onFlush).not.toHaveBeenCalled();
  appState = 'active';
  listener?.('active');
  jest.advanceTimersByTime(REALTIME_BATCH_DELAY_MS);
  expect(onFlush).toHaveBeenCalledTimes(1);
  b.dispose();
});

it('never flushes after dispose', () => {
  const onFlush = jest.fn();
  const b = createRealtimeBatcher(onFlush);
  b.notify();
  b.dispose();
  jest.advanceTimersByTime(REALTIME_BATCH_DELAY_MS * 2);
  listener?.('active');
  jest.advanceTimersByTime(REALTIME_BATCH_DELAY_MS * 2);
  expect(onFlush).not.toHaveBeenCalled();
});
