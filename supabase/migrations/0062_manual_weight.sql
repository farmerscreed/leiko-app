-- 0062_manual_weight.sql — weight log + target (2026-11-18).
--
-- Weight is one of the biggest levers on blood pressure, so Leiko now
-- lets the wearer log it and set a target, to sit next to their BP in
-- the story. Entries reuse public.external_vitals (same shape as a
-- scale reading pulled from Apple Health / Health Connect) under a new
-- platform value, written by the same service-role /sync-external-vitals
-- function:
--
--   source_platform = 'leiko_manual'
--   source_origin   = 'com.leiko.care.manual'
--   vital_type      = 'weight', value_unit = 'kg'
--
-- The target lives on the user row.

alter type public.external_vital_platform add value if not exists 'leiko_manual';

alter table public.users
  add column if not exists weight_target_kg numeric
    check (weight_target_kg is null or (weight_target_kg >= 20 and weight_target_kg <= 400));

comment on column public.users.weight_target_kg is
  'Weight the wearer is working towards, kg. Null = no target. Set from the Weight screen (2026-11-18).';
