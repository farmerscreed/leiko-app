// Read the HR-inferred bed / wake times the sync function stores in a
// sleep_session row's value_jsonb (2026-11-18: inferred_start,
// inferred_end as ISO UTC, wake_source). Shared by the own-device
// hydrate and the caregiver fetch so both read them the same way.
// Missing / malformed → empty object, and display falls back as before.

import type { SleepSession } from '../types/vitals';

type InferredFields = Pick<
  SleepSession,
  'inferredSessionStartSec' | 'inferredSessionEndSec' | 'wakeSource'
>;

export function inferredSleepFromJsonb(j: unknown): InferredFields {
  if (!j || typeof j !== 'object') return {};
  const o = j as { inferred_start?: unknown; inferred_end?: unknown; wake_source?: unknown };
  if (typeof o.inferred_start !== 'string' || typeof o.inferred_end !== 'string') return {};
  const start = Math.floor(Date.parse(o.inferred_start) / 1000);
  const end = Math.floor(Date.parse(o.inferred_end) / 1000);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return {};
  const out: InferredFields = { inferredSessionStartSec: start, inferredSessionEndSec: end };
  if (o.wake_source === 'hr_inferred' || o.wake_source === 'fallback') out.wakeSource = o.wake_source;
  return out;
}
