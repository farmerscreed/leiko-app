-- 0037_orders_flagged_rows_relax_checks.sql
--
-- 0036 added check constraints on orders.sku and orders.order_type that
-- the webhook brief didn't specify. They break the flagged-order path:
-- a payment arriving with an unrecognized sku or order_type must still
-- be SAVED (status='flagged', raw values intact) so the operator can
-- review it — a check violation would lose the record entirely.
--
-- The status check stays: status is always set by our own code and is
-- never derived from webhook input.

alter table public.orders drop constraint if exists orders_sku_check;
alter table public.orders drop constraint if exists orders_order_type_check;
