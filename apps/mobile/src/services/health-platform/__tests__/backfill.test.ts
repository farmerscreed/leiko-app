// History copy into Health Connect (2026-11-02). Verifies: only the
// user's OWN circle is read, every enabled vital is copied in pages, HR
// is limited to 30 days, a caregiver only copies their own watch BP, and
// nothing runs when Health Connect is off.

type Row = Record<string, unknown>;
interface Query {
  table: string;
  filters: [string, string, unknown][];
  range?: [number, number];
}

const queries: Query[] = [];
let tables: Record<string, Row[]> = {};
let ownFamily: string | null = 'fam-own';

function builder(table: string) {
  const q: Query = { table, filters: [] };
  queries.push(q);
  const self: Record<string, unknown> = {};
  const chain = (op: string) => (col: string, val?: unknown) => {
    q.filters.push([op, col, val]);
    return self;
  };
  Object.assign(self, {
    select: () => self,
    eq: chain('eq'),
    is: chain('is'),
    gte: chain('gte'),
    or: chain('or'),
    order: () => self,
    limit: () => self,
    maybeSingle: async () => ({
      data: ownFamily ? { family_id: ownFamily } : null,
      error: null,
    }),
    range: async (from: number, to: number) => {
      q.range = [from, to];
      const type = q.filters.find((f) => f[1] === 'vital_type')?.[2];
      const all = (tables[type ? `${table}:${String(type)}` : table] ?? []).slice(from, to + 1);
      return { data: all, error: null };
    },
  });
  return self;
}

jest.mock('../../supabase', () => ({
  supabase: { from: (t: string) => builder(t) },
}));
jest.mock('../../analytics/logger', () => ({ logger: { track: jest.fn() } }));

import { Platform } from 'react-native';
import { __getWritten, __reset as resetMockAdapter, mockAdapter } from '../adapters/mock';
import { __resetAdapterForTest, __setAdapterForTest } from '../index';
import { __resetBackfillForTest, backfillHealthPlatform, useHealthBackfill } from '../backfill';
import { __resetForTest as resetToggles, setMaster, setWriteVital } from '../toggles';
import { useAuth } from '../../../state/auth';
import { mmkv, STORAGE_KEYS } from '../../storage';
import type { AccountType, UserRow } from '../../../types/database';

const NOW = Date.parse('2026-11-02T18:00:00Z');

function signIn(kind: AccountType): void {
  useAuth.setState({
    profile: { id: 'user-1', account_type: kind } as unknown as UserRow,
  } as never);
}

function bpRow(i: number, source = 'watch'): Row {
  return {
    measured_at: new Date(NOW - i * 3_600_000).toISOString(),
    systolic: 120 + (i % 5),
    diastolic: 80,
    pulse: 70,
    source,
  };
}

function stepsRow(i: number): Row {
  return {
    id: `s${i}`,
    family_id: 'fam-own',
    device_id: null,
    vital_type: 'steps_day',
    measured_at: new Date(NOW - i * 86_400_000).toISOString(),
    value_int: 5000 + i,
    value_jsonb: { day_local: '2026-11-01' },
  };
}

const originalOS = Platform.OS;

beforeEach(() => {
  (Platform as { OS: string }).OS = 'android';
  queries.length = 0;
  tables = {};
  ownFamily = 'fam-own';
  resetMockAdapter();
  __setAdapterForTest(mockAdapter);
  resetToggles();
  __resetBackfillForTest();
  mmkv.remove(STORAGE_KEYS.pairedDevice);
  useAuth.setState({ profile: null } as never);
});

afterAll(() => {
  (Platform as { OS: string }).OS = originalOS;
  __resetAdapterForTest();
});

it('does nothing while Health Connect is off', async () => {
  signIn('self_buyer');
  tables.readings = [bpRow(1)];
  await backfillHealthPlatform(NOW);
  expect(queries).toHaveLength(0);
  expect(useHealthBackfill.getState().status).toBe('idle');
});

it('copies every page of BP from the OWN circle and records completion', async () => {
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('bp', true);
  tables.readings = Array.from({ length: 1500 }, (_, i) => bpRow(i));

  await backfillHealthPlatform(NOW);

  expect(__getWritten().bp).toHaveLength(1500);
  const membership = queries.find((q) => q.table === 'family_members');
  expect(membership?.filters).toContainEqual(['eq', 'role', 'family_owner']);
  const bpQueries = queries.filter((q) => q.table === 'readings');
  expect(bpQueries).toHaveLength(2); // 1000 + 500
  expect(bpQueries[0].filters).toContainEqual(['eq', 'family_id', 'fam-own']);
  expect(useHealthBackfill.getState()).toMatchObject({
    status: 'done',
    copied: 1500,
    lastCompletedAt: NOW,
  });
  expect(mmkv.getNumber(STORAGE_KEYS.healthPlatformBackfillAt)).toBe(NOW);
});

it('only copies vitals whose share toggle is on', async () => {
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('steps', true);
  tables.readings = [bpRow(1)];
  tables['vitals_other:steps_day'] = [stepsRow(1), stepsRow(2)];

  await backfillHealthPlatform(NOW);

  expect(__getWritten().bp).toHaveLength(0);
  expect(__getWritten().steps).toHaveLength(2);
  expect(queries.some((q) => q.table === 'readings')).toBe(false);
});

it('limits heart rate to the last 30 days', async () => {
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('hr', true);
  await backfillHealthPlatform(NOW);
  const hr = queries.find((q) => q.filters.some((f) => f[1] === 'vital_type' && f[2] === 'hr'));
  const since = hr?.filters.find((f) => f[0] === 'gte')?.[2] as string;
  expect(Date.parse(since)).toBe(NOW - 30 * 86_400_000);
});

it("a caregiver with their own watch copies only their watch BP", async () => {
  signIn('caregiver');
  mmkv.set(STORAGE_KEYS.pairedDevice, JSON.stringify({ bleId: 'AA:BB' }));
  setMaster(true);
  setWriteVital('bp', true);
  tables.readings = [bpRow(1, 'watch'), bpRow(2, 'manual'), bpRow(3, 'watch')];

  await backfillHealthPlatform(NOW);

  expect(__getWritten().bp).toHaveLength(2);
});

it('a caregiver without a watch never copies anything', async () => {
  signIn('caregiver');
  setMaster(true);
  setWriteVital('bp', true);
  tables.readings = [bpRow(1)];
  await backfillHealthPlatform(NOW);
  expect(queries).toHaveLength(0);
});

it('stops quietly when the user owns no circle', async () => {
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('bp', true);
  ownFamily = null;
  await backfillHealthPlatform(NOW);
  expect(useHealthBackfill.getState().status).toBe('idle');
  expect(__getWritten().bp).toHaveLength(0);
});

it('is Android-only for now (HealthKit writes have no sync ids yet)', async () => {
  (Platform as { OS: string }).OS = 'ios';
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('bp', true);
  await backfillHealthPlatform(NOW);
  expect(queries).toHaveLength(0);
});

it('includes rows whose hidden flag is unset (null), not only false', async () => {
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('steps', true);
  await backfillHealthPlatform(NOW);
  const q = queries.find((x) => x.table === 'vitals_other');
  expect(q?.filters).toContainEqual(['or', 'hidden.is.null,hidden.eq.false', undefined]);
});

it('resting heart rate alone reads HR history but writes only resting values', async () => {
  signIn('self_buyer');
  setMaster(true);
  setWriteVital('resting_hr', true);
  const night = ['2026-10-31T03:00:00Z', '2026-10-31T03:05:00Z', '2026-10-31T04:00:00Z'].map(
    (iso, i) => ({
      id: `h${i}`,
      family_id: 'fam-own',
      device_id: null,
      vital_type: 'hr',
      measured_at: iso,
      value_int: 55 + i,
      value_jsonb: { sample_window_sec: 300 },
    }),
  );
  tables['vitals_other:hr'] = night;
  useAuth.setState({
    profile: { id: 'user-1', account_type: 'self_buyer', timezone: 'UTC' } as unknown as UserRow,
  } as never);

  await backfillHealthPlatform(NOW);

  expect(__getWritten().hr).toHaveLength(0);
  expect(__getWritten().restingHr).toEqual([
    expect.objectContaining({ nightKey: '2026-10-31', bpm: 56, sampleCount: 3 }),
  ]);
});
