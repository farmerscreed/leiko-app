-- 0036_orders_paystack.sql
--
-- Recreate public.orders for the Paystack verification webhook.
--
-- The previous public.orders table was created out-of-band by the
-- leiko.health web build (USD/tier/deposit-oriented schema, never in
-- this repo's migrations). It held only founder test rows with no
-- verified payments. Per the 2026-06-06 finance kickoff decision:
-- clean recreate, webhook-insert-only, NGN flat pricing first
-- (USD/Stripe is a later phase).
--
-- Writes come exclusively from the paystack-webhook Edge Function via
-- service_role. RLS is enabled with NO client policies on purpose:
-- anon/authenticated can neither read nor write order rows.

-- 1. Drop the legacy out-of-band table (test data only; confirmed disposable).
drop table if exists public.orders;

-- 2. The brief's schema.
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  paystack_reference  text unique not null,
  email               text not null,
  sku                 text not null check (sku in ('u16h', 'u19m')),
  sku_name            text,
  order_type          text not null check (order_type in ('full', 'reservation')),
  amount_paid_kobo    bigint not null,
  full_price_naira    integer,
  balance_due_naira   integer,        -- 0 for full payments; remaining balance for reservations
  refundable          boolean default false,
  customer_name       text,
  customer_phone      text,
  delivery_address    text,
  status              text not null check (status in ('paid', 'reserved', 'flagged', 'refunded')),
  raw_metadata        jsonb,          -- full verified metadata, kept for audit
  created_at          timestamptz default now()
);

-- 3. Service-role-only posture: RLS on, no policies.
alter table public.orders enable row level security;

comment on table public.orders is
  'Verified Paystack orders. Written only by the paystack-webhook Edge Function (service_role). No client access by design.';
