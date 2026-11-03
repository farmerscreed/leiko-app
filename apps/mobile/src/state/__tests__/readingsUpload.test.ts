// Backlog upload (2026-11-03): saved readings go to /sync a few at a
// time instead of one by one. The first row goes alone (it may create
// the server's device row), a failure stops the run after the current
// group, and everything that did upload leaves `pending`.

let inFlight = 0;
let maxInFlight = 0;
const calls: number[] = [];
let failAt: number | null = null;

jest.mock('../../services/sync/postReading', () => ({
  postReading: jest.fn(async (row: { measuredAtSec: number }) => {
    const n = calls.length;
    calls.push(row.measuredAtSec);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    if (failAt !== null && n === failAt) throw new Error('offline');
    return { readingId: `srv-${row.measuredAtSec}`, deviceId: 'dev', duplicate: false };
  }),
}));
jest.mock('../../services/health-platform/syncBridge', () => ({
  forwardReadingToPlatform: jest.fn(async () => undefined),
}));

import { UPLOAD_CONCURRENCY, useReadings, type LocalReading } from '../readings';

function row(i: number): LocalReading {
  return {
    localId: `l${i}`,
    serverId: null,
    measuredAtSec: 1_790_000_000 + i * 60,
    systolic: 120,
    diastolic: 80,
    pulse: 70,
    source: 'watch',
    deviceBleId: 'AA:BB',
    capturedAtMs: 0,
    classification: { tier: 'normal' },
  } as unknown as LocalReading;
}

beforeEach(() => {
  inFlight = 0;
  maxInFlight = 0;
  calls.length = 0;
  failAt = null;
  useReadings.setState({ pending: [], recent: [], syncing: false, syncError: null } as never);
});

it('uploads the first row alone, then in parallel groups', async () => {
  useReadings.setState({ pending: Array.from({ length: 13 }, (_, i) => row(i)) } as never);
  await useReadings.getState().syncPending();
  expect(calls).toHaveLength(13);
  expect(maxInFlight).toBe(UPLOAD_CONCURRENCY);
  expect(useReadings.getState().pending).toHaveLength(0);
  expect(useReadings.getState().recent.every((r) => r.serverId?.startsWith('srv-'))).toBe(true);
});

it('stops after the group with a failure and keeps the rest pending', async () => {
  useReadings.setState({ pending: Array.from({ length: 13 }, (_, i) => row(i)) } as never);
  failAt = 2; // inside the first parallel group (calls 1–4)
  await useReadings.getState().syncPending();
  expect(calls).toHaveLength(1 + UPLOAD_CONCURRENCY);
  const s = useReadings.getState();
  expect(s.pending).toHaveLength(13 - UPLOAD_CONCURRENCY);
  expect(s.syncError).toBe('offline');
});

it('a failing first row uploads nothing else', async () => {
  useReadings.setState({ pending: [row(0), row(1), row(2)] } as never);
  failAt = 0;
  await useReadings.getState().syncPending();
  expect(calls).toHaveLength(1);
  expect(useReadings.getState().pending).toHaveLength(3);
});
