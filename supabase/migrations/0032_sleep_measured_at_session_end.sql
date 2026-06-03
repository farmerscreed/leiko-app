-- 0032_sleep_measured_at_session_end.sql — vitals data-completeness fix.
--
-- Aligns EXISTING sleep_session rows with the new ingestion convention
-- (see _shared/vital-row-mappers.ts): measured_at is the session END (the
-- synthesized ~08:00 wake), a CONSTANT per-night key — not the session
-- start, which drifts whenever the watch re-reports a night with a
-- different total and fragmented one night into many rows.
--
-- The watch's 0x07 reply carries no real bed/wake; end is synthesized at
-- 08:00 and start = end - total. measured_at = end is therefore a stable
-- NIGHT-IDENTITY key (never shown as a real wake — display is HR-inferred
-- only), so re-reads collide and reconcile to one row. value_jsonb keeps
-- the real start/end epochs.
--
-- Read-only of the watch contract; this just re-stamps measured_at and
-- collapses same-night fragments to the fullest (max total).

-- 1. Collapse same-night fragments: keep the largest-total row per
--    (device_id, session_end_local), delete the rest, so re-stamping
--    measured_at to the end can't violate the (device_id, vital_type,
--    measured_at) unique index (vitals_dedupe).
with ranked as (
  select id,
         row_number() over (
           partition by device_id, (value_jsonb->>'session_end_local')
           order by value_int desc nulls last, id
         ) as rn
  from public.vitals_other
  where vital_type = 'sleep_session'
    and value_jsonb ? 'session_end_local'
)
delete from public.vitals_other v
using ranked
where v.id = ranked.id
  and ranked.rn > 1;

-- 2. Re-stamp measured_at to the session end (the new night key).
update public.vitals_other
set measured_at = (value_jsonb->>'session_end_local')::timestamptz
where vital_type = 'sleep_session'
  and value_jsonb ? 'session_end_local'
  and (value_jsonb->>'session_end_local') is not null;
