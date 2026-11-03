import { assert, assertEquals } from 'jsr:@std/assert@1';
import { isShiftedTwin, splitShiftedTwins, twinSearchWindow } from './bp-shift-dedupe.ts';

const at = (iso: string, sys = 128, dia = 82, pulse: number | null = 71) => ({
  measured_at: iso,
  systolic: sys,
  diastolic: dia,
  pulse,
});

Deno.test('whole-hour and half-hour shifts of the same values are twins', () => {
  const base = at('2026-09-01T08:14:37Z');
  for (const iso of [
    '2026-09-01T09:14:37Z', // +1 h (CDT -> EDT)
    '2026-09-01T16:14:37Z', // +8 h (firmware offset)
    '2026-09-01T02:44:37Z', // -5.5 h (a :30 zone)
  ]) {
    assert(isShiftedTwin(base, at(iso)), iso);
  }
});

Deno.test('not twins: same instant, odd offsets, >15 h, other values', () => {
  const base = at('2026-09-01T08:14:37Z');
  assert(!isShiftedTwin(base, at('2026-09-01T08:14:37Z'))); // unique index handles this
  assert(!isShiftedTwin(base, at('2026-09-01T09:14:38Z'))); // 1 h + 1 s
  assert(!isShiftedTwin(base, at('2026-09-01T08:44:00Z'))); // 29m23s
  assert(!isShiftedTwin(base, at('2026-09-02T00:14:37Z'))); // 16 h
  assert(!isShiftedTwin(base, at('2026-09-01T09:14:37Z', 129))); // other systolic
  assert(!isShiftedTwin(base, at('2026-09-01T09:14:37Z', 128, 82, null))); // pulse differs
});

Deno.test('splitShiftedTwins drops copies of stored rows and of earlier batch rows', () => {
  const stored = [{ id: 'r1', ...at('2026-09-01T08:14:37Z') }];
  const incoming = [
    at('2026-09-01T09:14:37Z'), // copy of r1
    at('2026-09-03T10:00:05Z', 140, 90, 80), // new
    at('2026-09-03T11:00:05Z', 140, 90, 80), // copy of the row above
    at('2026-09-04T07:00:00Z', 118, 76, 64), // new
  ];
  const { fresh, twins } = splitShiftedTwins(incoming, stored);
  assertEquals(fresh.map((r) => r.measured_at), ['2026-09-03T10:00:05Z', '2026-09-04T07:00:00Z']);
  assertEquals(twins.map((t) => t.existingId), ['r1', null]);
});

Deno.test('twinSearchWindow spans the batch +/- 15 h', () => {
  const w = twinSearchWindow([at('2026-09-01T08:00:00Z'), at('2026-09-02T08:00:00Z')]);
  assertEquals(w, { fromIso: '2026-08-31T17:00:00.000Z', toIso: '2026-09-02T23:00:00.000Z' });
  assertEquals(twinSearchWindow([]), null);
});
