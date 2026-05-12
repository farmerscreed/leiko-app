-- 0017_anomaly_prefs_per_vital.sql — Sprint 15.
--
-- Extends notification_preferences (0009) with three per-vital
-- anomaly opt-outs and flips the anomaly_bypass_quiet default so
-- new users actively affirm the choice via the onboarding step.
--
-- Three per-vital toggles (BP / HR / SpO2) sit BELOW the umbrella
-- `anomaly_notifications` toggle. The umbrella acts as a global
-- kill-switch: off → no anomaly pushes for any vital, regardless of
-- the per-vital state. The Settings UI surfaces all four toggles.
-- Sleep + Activity have no toggle (D13 §11.1 — they never push).
--
-- Sourced from:
--   plans/sprint-15-push-anomaly.md (deliverable: per-category toggles)
--   docs/_reference/D13-multi-vitals-constellation-spec.md §11.1, §11.3
--   docs/11-push-notifications.md §5
--   docs/04-screens/settings.md (Notifications section)

-- 1. Per-vital anomaly opt-out columns -----------------------------------

alter table public.notification_preferences
  add column if not exists anomaly_bp   boolean not null default true,
  add column if not exists anomaly_hr   boolean not null default true,
  add column if not exists anomaly_spo2 boolean not null default true;

comment on column public.notification_preferences.anomaly_bp is
  'Per-vital opt-out for BP anomaly pushes. The umbrella '
  'anomaly_notifications must also be true for a push to fire.';
comment on column public.notification_preferences.anomaly_hr is
  'Per-vital opt-out for HR anomaly pushes.';
comment on column public.notification_preferences.anomaly_spo2 is
  'Per-vital opt-out for SpO2 anomaly pushes.';

-- 2. Default-flip for anomaly_bypass_quiet --------------------------------
--
-- Per the Sprint 15 onboarding step, new users explicitly answer the
-- quiet-hours-override question. We flip the column default to FALSE
-- so a missing affirmative answer maps to "hold for morning" (the
-- calm-before-clever default).
--
-- Existing rows keep their current value — we do NOT migrate live data.
-- The migration only changes the default for future inserts. Users who
-- already opted in stay opted in.

alter table public.notification_preferences
  alter column anomaly_bypass_quiet set default false;
