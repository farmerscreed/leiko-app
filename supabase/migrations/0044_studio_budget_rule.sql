-- 0044_studio_budget_rule.sql
--
-- The Leiko Studio's ad-set daily budget, stored in ops_rules so it's
-- founder-editable from the Studio dashboard and visible to the Operator's
-- spend guardrails. Used when an ad set is created / a creative is pushed (S4).
-- Seeded to ₦10,000/day (≈ $200/mo, the founder-confirmed budget). Idempotent.

insert into public.ops_rules (key, value, kind, editable_by, updated_by, updated_at)
values ('studio_adset_daily_budget_ngn', '10000', 'studio', 'founder', 'founder', now())
on conflict (key) do nothing;
