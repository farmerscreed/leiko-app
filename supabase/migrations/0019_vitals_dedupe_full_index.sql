-- 0019_vitals_dedupe_full_index.sql
--
-- Sprint 16.5c — fix the multi-vitals ingest path's silent failure.
--
-- The original `vitals_dedupe` index from 0001_initial.sql was created
-- partial:
--   CREATE UNIQUE INDEX vitals_dedupe
--     ON vitals_other (device_id, vital_type, measured_at)
--     WHERE device_id IS NOT NULL;
--
-- That made it impossible for the /sync Edge Function's
--   .upsert(rows, {
--     onConflict: 'device_id,vital_type,measured_at',
--     ignoreDuplicates: true,
--   })
-- call to succeed: Postgres's ON CONFLICT inference cannot use a partial
-- unique index unless the INSERT statement repeats the same WHERE
-- predicate, and supabase-js's `onConflict` parameter has no way to pass
-- that predicate through. Every multi-vitals upsert returned the
-- Postgres error "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification", which the function reported as HTTP
-- 500 (first failure point: spo2_insert_failed).
--
-- Net effect since Sprint 7.5 introduced multi-vitals: HR / SpO2 / Sleep
-- / Activity / Calories never inserted via this path. The mobile
-- pending arrays grew without bound and the server only ever received
-- the legacy single-BP-reading POSTs (which use .insert() + 23505 catch,
-- avoiding ON CONFLICT entirely).
--
-- Fix: drop the WHERE clause. All vitals_other rows are device-sourced
-- (the partial WHERE was vestigial), so the unique semantics for real
-- data don't change — only ON CONFLICT inference is unblocked. Manual
-- vitals entry has never been a path; if it ever ships, it goes through
-- a separate ingest route with its own dedup story.

DROP INDEX IF EXISTS public.vitals_dedupe;
CREATE UNIQUE INDEX vitals_dedupe
  ON public.vitals_other (device_id, vital_type, measured_at);
