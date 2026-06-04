// vitalHistory — pure mappers + paging contract (ADR-0008 follow-up).

import {
  HISTORY_PAGE_SIZE,
  activityHistoryRow,
  bpHistoryRow,
  fetchVitalHistoryPage,
  historyFromIso,
  sleepHistoryRow,
  spo2HistoryRow,
} from '../vitalHistory';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const AT = '2026-06-02T12:34:16.000Z';
const AT_SEC = Math.floor(Date.parse(AT) / 1000);

describe('row mappers', () => {
  it('bp: value "sys/dia", detail carries pulse when present', () => {
    const row = bpHistoryRow({
      id: 'r1', measured_at: AT, systolic: 144, diastolic: 91, pulse: 78,
    });
    expect(row).toEqual({
      id: 'r1', measuredAtSec: AT_SEC, value: '144/91', detail: 'Pulse 78',
    });
    expect(
      bpHistoryRow({ id: 'r2', measured_at: AT, systolic: 120, diastolic: 80, pulse: null })
        .detail,
    ).toBeNull();
  });

  it('spo2: percent value; low detail only when the window-min dips below the avg', () => {
    const dip = spo2HistoryRow({
      id: 's1', measured_at: AT, value_int: 97, value_int_2: 99, value_int_3: 93,
    });
    expect(dip.value).toBe('97%');
    expect(dip.detail).toBe('low 93%');
    const flat = spo2HistoryRow({
      id: 's2', measured_at: AT, value_int: 97, value_int_2: 97, value_int_3: 97,
    });
    expect(flat.detail).toBeNull();
  });

  it('sleep: h:mm duration + deep detail', () => {
    const row = sleepHistoryRow({
      id: 'n1', measured_at: AT, value_int: 322, value_int_2: 54, value_int_3: 0,
    });
    expect(row.value).toBe('5:22 slept');
    expect(row.detail).toBe('Deep 0:54');
  });

  it('activity: localised step count', () => {
    const row = activityHistoryRow({
      id: 'd1', measured_at: AT, value_int: 6800, value_int_2: null, value_int_3: null,
    });
    expect(row.value).toBe('6,800 steps');
    expect(row.detail).toBeNull();
  });
});

describe('historyFromIso', () => {
  it('anchors the window start N days back', () => {
    const nowMs = Date.parse('2026-06-03T12:00:00Z');
    expect(historyFromIso('7d', nowMs)).toBe('2026-05-27T12:00:00.000Z');
    expect(historyFromIso('90d', nowMs)).toBe('2026-03-05T12:00:00.000Z');
  });
});

describe('fetchVitalHistoryPage', () => {
  function fakeClient(captured: Record<string, unknown>) {
    const chain: Record<string, unknown> = {};
    const make = (name: string) =>
      ((...args: unknown[]) => {
        captured[name] = args;
        return chain;
      }) as unknown;
    chain.select = make('select');
    chain.eq = ((col: string, val: unknown) => {
      (captured.eq as unknown[][]) = [
        ...((captured.eq as unknown[][]) ?? []),
        [col, val],
      ];
      return chain;
    }) as unknown;
    chain.gte = make('gte');
    chain.order = make('order');
    chain.range = ((from: number, to: number) => {
      captured.range = [from, to];
      return Promise.resolve({ data: [], error: null, count: 7 });
    }) as unknown;
    return {
      from: (table: string) => {
        captured.table = table;
        return chain;
      },
    } as unknown as SupabaseClient<Database>;
  }

  it('requests an exact count on page 0 and pages by HISTORY_PAGE_SIZE', async () => {
    const captured: Record<string, unknown> = {};
    const page = await fetchVitalHistoryPage(
      fakeClient(captured), 'bp', 'fam-1', '2026-05-27T00:00:00Z', 0,
    );
    expect(captured.table).toBe('readings');
    expect((captured.select as unknown[])[1]).toEqual({ count: 'exact' });
    expect(captured.range).toEqual([0, HISTORY_PAGE_SIZE - 1]);
    expect(page.totalCount).toBe(7);
  });

  it('skips the count on later pages and routes vitals kinds to vitals_other', async () => {
    const captured: Record<string, unknown> = {};
    const page = await fetchVitalHistoryPage(
      fakeClient(captured), 'sleep', 'fam-1', '2026-05-27T00:00:00Z', 2,
    );
    expect(captured.table).toBe('vitals_other');
    expect((captured.select as unknown[])[1]).toEqual({ count: undefined });
    expect(captured.eq).toContainEqual(['vital_type', 'sleep_session']);
    expect(captured.range).toEqual([2 * HISTORY_PAGE_SIZE, 3 * HISTORY_PAGE_SIZE - 1]);
    expect(page.totalCount).toBeNull();
  });
});
