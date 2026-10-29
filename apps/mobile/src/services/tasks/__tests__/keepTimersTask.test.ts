// 2026-10-29 — the native BLE service starts KEEP_TIMERS_TASK and
// finishes it on stop. JS must register it, and its promise must never
// settle on its own (a settled task tells RN to pause timers again).

const registerHeadlessTask = jest.fn();
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppRegistry: { registerHeadlessTask: (...a: unknown[]) => registerHeadlessTask(...a) },
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskDefined: () => false }), {
  virtual: true,
});
jest.mock(
  'expo-background-fetch',
  () => ({ BackgroundFetchResult: { NoData: 1, NewData: 2, Failed: 3 } }),
  { virtual: true },
);

import { KEEP_TIMERS_TASK } from '../taskNames';
import { registerHeadlessTasks } from '../registerHeadlessTasks';

describe('KEEP_TIMERS_TASK', () => {
  it('is registered and its promise stays pending', async () => {
    registerHeadlessTasks();
    const call = registerHeadlessTask.mock.calls.find((c) => c[0] === KEEP_TIMERS_TASK);
    expect(call).toBeDefined();
    const task = (call![1] as () => () => Promise<void>)();
    let settled = false;
    void task().then(() => {
      settled = true;
    });
    await new Promise((r) => setImmediate(r));
    expect(settled).toBe(false);
  });

  it('matches the native task key', () => {
    expect(KEEP_TIMERS_TASK).toBe('leiko.keepJsTimersAlive');
  });
});
