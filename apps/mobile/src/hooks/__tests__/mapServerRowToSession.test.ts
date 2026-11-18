import { mapServerRowToSession, type ServerSleepRow } from '../useHydrateSleepFromServer';

// Shape the sync edge function writes (mapSleepSessions): measured_at is
// the night's END, session_{start,end}_local carry the epochs.
const row: ServerSleepRow = {
  measured_at: '2026-11-12T08:00:00+00:00',
  value_int: 510,
  value_int_2: 112,
  value_int_3: 0,
  value_jsonb: {
    session_start_local: '2026-11-11T23:30:00.000Z',
    session_end_local: '2026-11-12T08:00:00.000Z',
    light_minutes: 380,
    sleep_score: 98,
  },
} as ServerSleepRow;

describe('mapServerRowToSession', () => {
  it('reads measured_at as the session end, not the start', () => {
    const s = mapServerRowToSession(row);
    expect(s.sessionEndSec).toBe(Date.parse('2026-11-12T08:00:00Z') / 1000);
    expect(s.sessionStartSec).toBe(Date.parse('2026-11-11T23:30:00Z') / 1000);
    expect(s.sessionEndSec - s.sessionStartSec).toBe(510 * 60);
  });

  it('derives start from end − total when the jsonb start is missing', () => {
    const s = mapServerRowToSession({ ...row, value_jsonb: { sleep_score: 98 } } as ServerSleepRow);
    expect(s.sessionEndSec - s.sessionStartSec).toBe(510 * 60);
  });
});
