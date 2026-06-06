-- 0038_orders_balance_payment.sql
--
-- Deposit-ladder flow (2026-06-06 founder decision): /reserve takes only
-- the ₦50,000 deposit; the buyer later picks a watch and pays the
-- remaining balance inline on /reserve/complete. That balance payment is
-- a SECOND Paystack transaction that UPDATES the original reservation
-- row instead of inserting a new order.
--
-- balance_reference is the idempotency lock for the second payment,
-- exactly as paystack_reference is for the first: UNIQUE, and the
-- webhook's conditional update only fires while it is still NULL.

alter table public.orders
  add column balance_reference text unique,
  add column balance_paid_at  timestamptz;

comment on column public.orders.balance_reference is
  'Paystack reference of the balance payment (deposit-ladder step 2). NULL until the balance is paid.';
