-- 0031_readings_device_independent_dedupe.sql — vitals data-completeness fix.
--
-- Root cause (verified against prod, 2026-06-03):
--   A BP reading was deduped on (device_id, measured_at) via the
--   `readings_dedupe` unique index, and the /sync function upserts with
--   onConflict 'device_id,measured_at'. But a reading's real identity is
--   the measurement — (family_id, measured_at) — not the watch that
--   reported it. When a second watch was paired (new MAC / client_device_id
--   → new devices row), the phone re-synced the existing history stamped
--   with the NEW device_id. Because (new_device_id, measured_at) did not
--   collide with (old_device_id, measured_at), the dedup let them through:
--   51 byte-identical BP rows (~34% of the family's readings) were
--   re-inserted, skewing every aggregate (avg / peak / low / baselines /
--   trend chart / doctor's report).
--
-- Verified safe: zero (family_id, measured_at) slots hold *different*
-- systolic/diastolic/pulse values, so collapsing to one row per slot loses
-- no real data. (A person takes one BP reading at a time; two distinct BP
-- values in the same second is not physically possible.)
--
-- NOT applied to vitals_other (HR/SpO2): there, the same (family, time) can
-- legitimately hold different values from two watches sampling concurrently
-- (auto-sampled every 5 min). A device-independent key there would destroy
-- real samples, so that table's dedup is deliberately left unchanged.

-- 1. Remove the re-sync duplicates: keep the earliest-ingested row per
--    logical measurement. created_at ASC keeps the original sync; id breaks
--    ties deterministically.
with ranked as (
  select id,
         row_number() over (
           partition by family_id, measured_at
           order by created_at asc, id asc
         ) as rn
  from public.readings
)
delete from public.readings r
using ranked
where r.id = ranked.id
  and ranked.rn > 1;

-- 2. Swap the device-scoped dedup index for a device-independent one, so a
--    future re-pair / re-sync can never re-import the same reading again.
--    device_id stays on the row as provenance; it is just no longer part of
--    the identity. The new index also covers device_id IS NULL rows (manual
--    entries), which the old partial index did not.
drop index if exists public.readings_dedupe;
create unique index readings_dedupe
  on public.readings (family_id, measured_at);
