// Settings / Home "connect" flow (2026-11-02): the switch must ask the
// OS for permission and only report "on" for what was actually granted,
// then start the history copy.

jest.mock('../backfill', () => ({ backfillHealthPlatform: jest.fn(async () => undefined) }));
jest.mock('../../analytics/logger', () => ({ logger: { track: jest.fn() } }));

import { mockAdapter, __reset as resetMockAdapter } from '../adapters/mock';
import { __resetAdapterForTest, __setAdapterForTest } from '../index';
import { connectHealthPlatform, enableWriteVital } from '../connect';
import { backfillHealthPlatform } from '../backfill';
import { __resetForTest as resetToggles, getToggles } from '../toggles';
import type { HealthPlatformAdapter, PermissionGrant } from '../types';
import { backfillCaption } from '../backfillCaption';

const backfill = backfillHealthPlatform as jest.Mock;

function adapterGranting(grant: Partial<PermissionGrant> & { userPrompted: boolean }): HealthPlatformAdapter {
  return {
    ...mockAdapter,
    requestPermissions: async (req) => ({
      write: Object.fromEntries(req.write.map((k) => [k, grant.write?.[k] ?? false])) as PermissionGrant['write'],
      read: Object.fromEntries(req.read.map((k) => [k, grant.read?.[k] ?? false])) as PermissionGrant['read'],
      userPrompted: grant.userPrompted,
    }),
  };
}

beforeEach(() => {
  resetMockAdapter();
  resetToggles();
  backfill.mockClear();
});

afterAll(() => __resetAdapterForTest());

it('asks the OS, turns on what was granted, and starts the history copy', async () => {
  __setAdapterForTest(mockAdapter); // grants everything
  await expect(connectHealthPlatform()).resolves.toBe('connected');
  const t = getToggles();
  expect(t.master).toBe(true);
  expect(t.perVitalWrite.bp).toBe(true);
  expect(backfill).toHaveBeenCalledTimes(1);
});

it('leaves the switch off when nothing was granted', async () => {
  __setAdapterForTest(adapterGranting({ userPrompted: true }));
  await expect(connectHealthPlatform()).resolves.toBe('none_granted');
  expect(getToggles().master).toBe(false);
  expect(backfill).not.toHaveBeenCalled();
});

it('mirrors a partial grant per vital', async () => {
  __setAdapterForTest(adapterGranting({ userPrompted: true, write: { bp: true, steps: true } as never }));
  await connectHealthPlatform();
  const t = getToggles();
  expect(t.perVitalWrite.bp).toBe(true);
  expect(t.perVitalWrite.hr).toBe(false);
  expect(t.perVitalWrite.steps).toBe(true);
});

it('reports unavailable when the OS shows no prompt', async () => {
  __setAdapterForTest(adapterGranting({ userPrompted: false }));
  await expect(connectHealthPlatform()).resolves.toBe('unavailable');
  expect(getToggles().master).toBe(false);
});

it('a single share row asks for its own permission', async () => {
  __setAdapterForTest(adapterGranting({ userPrompted: true }));
  await expect(enableWriteVital('hr')).resolves.toBe(false);
  expect(getToggles().perVitalWrite.hr).toBe(false);
});

describe('backfillCaption', () => {
  it('describes each state without health values', () => {
    expect(backfillCaption('idle', 0, null)).toBe('Sends your earlier readings to Health Connect.');
    expect(backfillCaption('running', 0, null)).toBe('Copying…');
    expect(backfillCaption('running', 1200, null)).toMatch(/^Copying… 1.?200 so far$/);
    expect(backfillCaption('failed', 3, null)).toBe("That didn't finish. Tap to try again.");
    expect(backfillCaption('done', 9, Date.UTC(2026, 10, 2))).toMatch(/^Last copied .+\. Tap to copy again\.$/);
  });
});
