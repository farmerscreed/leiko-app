-- 0060 — soft-hide time-shifted duplicate watch BP readings (2026-11-03).
--
-- The app converts watch wall-clock times with the phone's CURRENT time
-- zone. Re-pulling the watch's history later from another zone (fresh
-- install, new phone, cursor reset) stored the same physical reading
-- again, shifted by whole hours; the (family_id, measured_at) unique
-- index can't catch that. Read-only prod check 2026-11-03: 49 real
-- readings stored 4x (147 extra rows), offsets 1–10 h, one family; zero
-- same-value pairs at any non-half-hour offset. In every group the
-- FIRST-stored copy was uploaded hours after measurement (median 6 h);
-- the later copies arrived 1–3 months later — so the earliest-created
-- row is the original and the rest are hidden.
--
-- New copies are refused at the source by the /sync guard
-- (supabase/functions/_shared/bp-shift-dedupe.ts, same rule).
--
-- Soft-hide only (hidden = true, reason 'duplicate_reading'): reversible,
-- and every reader already filters hidden rows. Values/times untouched,
-- so readings_immutable_columns is satisfied. Idempotent.

with twins as (
  select distinct b.id
  from public.readings a
  join public.readings b
    on  b.family_id = a.family_id
    and b.id <> a.id
    and b.source = 'watch' and a.source = 'watch'
    and b.systolic = a.systolic
    and b.diastolic = a.diastolic
    and b.pulse is not distinct from a.pulse
    and abs(extract(epoch from (b.measured_at - a.measured_at))) between 1800 and 15 * 3600
    and (abs(extract(epoch from (b.measured_at - a.measured_at)))::bigint % 1800) = 0
    -- keep the earliest-stored copy of each group (id breaks ties)
    and (a.created_at, a.id) < (b.created_at, b.id)
  where a.hidden = false
    and b.hidden = false
)
update public.readings r
set hidden        = true,
    hidden_reason = 'duplicate_reading',
    hidden_at     = now()
from twins
where r.id = twins.id;
