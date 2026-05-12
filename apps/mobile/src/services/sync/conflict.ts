// services/sync/conflict — Sprint 16.
//
// Documents and enforces the conflict-resolution policy from Sprint
// 16's state matrix §4. Two purposes:
//
//   1. As a reference for anyone touching sync — exhaustive table of
//      who wins for which row class.
//   2. As a runtime guard for the one case the mobile client owns:
//      deduping `vitals_other` rows by `(user_id, ts_utc_sec, kind)`.
//
// The other policies are enforced server-side (Edge Functions reject
// stale-client writes for `vitals_*`; the mobile client never writes
// to `vitals_correlations`). Client-wins policies (`users.*` /
// `families.*` / `notification_preferences.*`) need no resolution
// because the owning device is the only writer.

export type ConflictWinner = 'server' | 'client';

export interface ConflictPolicyEntry {
  rowClass: string;
  winner: ConflictWinner;
  reason: string;
}

/**
 * The full policy table. Snapshot for traceability — not consumed by
 * runtime code. If a row class isn't here, the policy is undefined
 * and any new writer must add it.
 */
export const CONFLICT_POLICY: ConflictPolicyEntry[] = [
  {
    rowClass: 'vitals_bp',
    winner: 'server',
    reason:
      'A row that already round-tripped through /sync is authoritative. Local re-uploads dedup by (user_id, raw_ts_sec, kind).',
  },
  {
    rowClass: 'vitals_hr',
    winner: 'server',
    reason: 'Same as vitals_bp — server is authoritative once /sync accepts.',
  },
  {
    rowClass: 'vitals_spo2',
    winner: 'server',
    reason: 'Same as vitals_bp — server is authoritative once /sync accepts.',
  },
  {
    rowClass: 'vitals_sleep',
    winner: 'server',
    reason: 'Same as vitals_bp — server is authoritative once /sync accepts.',
  },
  {
    rowClass: 'vitals_activity',
    winner: 'server',
    reason: 'Same as vitals_bp — server is authoritative once /sync accepts.',
  },
  {
    rowClass: 'vitals_other',
    winner: 'server',
    reason: 'Dedup key (user_id, ts_utc_sec, kind). Last-write-wins on value.',
  },
  {
    rowClass: 'vitals_correlations',
    winner: 'server',
    reason: 'Computed by Edge cron; mobile is read-only.',
  },
  {
    rowClass: 'users.*',
    winner: 'client',
    reason: 'Owning device is the only editor of profile prefs.',
  },
  {
    rowClass: 'families.*',
    winner: 'client',
    reason: 'Owning device is the only editor of family prefs.',
  },
  {
    rowClass: 'notification_preferences.*',
    winner: 'client',
    reason: 'Last-touched-on-device wins for notification toggles.',
  },
];

// ─── vitals_other dedup helper ────────────────────────────────────────

export interface VitalsOtherKeyed {
  userId: string;
  tsUtcSec: number;
  kind: string;
}

/**
 * Dedup a list of `vitals_other` rows by `(user_id, ts_utc_sec, kind)`.
 * Later entries in the input list win — the assumption is that local
 * input is in arrival order, with the freshest copy at the end.
 *
 * The function is generic over rows that satisfy the `VitalsOtherKeyed`
 * shape; the additional fields on the row are preserved unchanged on
 * the winning entry.
 */
export function dedupVitalsOther<T extends VitalsOtherKeyed>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.userId}|${row.tsUtcSec}|${row.kind}`;
    seen.set(key, row);
  }
  return Array.from(seen.values());
}
