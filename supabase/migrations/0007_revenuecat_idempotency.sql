-- 0007_revenuecat_idempotency.sql — Sprint 10a webhook idempotency.
-- Sourced from docs/09-paywall-and-iap.md §4 ("Idempotent: same event ID
-- processed twice produces the same outcome").
--
-- The /revenuecat-webhook Edge Function lands in this sprint. Per
-- docs/01-data-model.md the subscriptions table already has user_id (PK),
-- rc_app_user_id, status, etc. What it doesn't have is a per-event
-- dedup marker — without one, a RevenueCat retry would produce two
-- audit-log entries and a redundant write to families.subscription_status.
--
-- We add `last_event_id` and short-circuit the webhook when the event_id
-- of the incoming payload matches the row's last_event_id. RC events
-- include `event.id` (uuid string).

alter table public.subscriptions
  add column if not exists last_event_id text;

-- Audit-log action vocabulary used by the new webhook. These are simple
-- string constants — audit_log.action is `text not null`, no enum — but
-- enumerating them here keeps the value space discoverable from the
-- migrations directory.
--
--   subscription.activated      | first transition to plus / plus_trial / plus_grace
--   subscription.renewed        | RENEWAL or PRODUCT_CHANGE that keeps Plus
--   subscription.lapsed         | transition to free or past_due
--   subscription.event_replayed | duplicate event_id seen, no state change
--
-- (No DDL — the audit_log table accepts any text action.)
