-- 0033_null_mislabeled_measured_at_local.sql — data-completeness cleanup.
--
-- readings.measured_at_local was populated with the UTC instant + a 'Z'
-- suffix — i.e. a wrong value under a "local" name (the Sprint-7 "wire the
-- parent IANA TZ" TODO never landed). Nothing reads the column (verified:
-- only the type definition references it); render-side localisation happens
-- in the app from measured_at + the wearer's users.timezone.
--
-- Per the founder's rule — rather no data than wrong data — NULL the wrong
-- values and stop writing them (sync mappers now write NULL). The column
-- stays for a future properly tz-wired implementation.

update public.readings
set measured_at_local = null
where measured_at_local is not null;
