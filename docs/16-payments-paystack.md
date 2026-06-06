# D16 — Paystack payment verification (web orders)

Status: shipped 2026-06-06 (Finance Sprint, Paystack phase).
Code: `supabase/functions/paystack-webhook/` · Schema: migrations `0036` + `0037`.

The server-side source of truth for LEIKO web payments. The leiko.health
frontend collects payment with **Paystack Inline v2**; its browser
`onSuccess` callback is never trusted and never fulfils an order. An
order exists only after the webhook has verified the signature,
re-verified the transaction against the Paystack API, and validated the
amount.

This is the **NGN/Paystack phase**. USD/Stripe is a later phase and gets
its own webhook + doc when it lands.

## 1. Flow

```
Paystack ──POST──▶ /functions/v1/paystack-webhook
  1. HMAC-SHA512(raw body, PAYSTACK_SECRET_KEY) ≟ x-paystack-signature
     └─ mismatch → 401, stop
  2. event ≠ charge.success → 200, ignore
     (refund.processed → mark order refunded + buyer email, then 200)
  3. GET api.paystack.co/transaction/verify/{reference}   ← independent
     └─ unreachable/5xx → 503 (Paystack retries)
  4. status=success ∧ currency=NGN ∧ amount matches order_type+sku
     └─ mismatch → save status='flagged', internal alert ONLY, 200
  5. INSERT public.orders (UNIQUE paystack_reference, ignoreDuplicates)
     └─ duplicate delivery → 200, no row, no email
  6. Resend: buyer confirmation + internal alert (best-effort —
     a failed email never rolls back the order)
  7. 200
```

## 2. Amount rules (kobo; ₦1 = 100 kobo)

| order_type + sku | Price | Expected `data.amount` |
|---|---|---|
| `full` + `u16h` (LEIKO Watch) | ₦250,000 | 25,000,000 |
| `full` + `u19m` (LEIKO Watch Pro) | ₦300,000 | 30,000,000 |
| `reservation` (either SKU) | ₦50,000 | 5,000,000 |

Anything else → `flagged`. Reservations: deposit counts toward the
total; balance due at ship is ₦200,000 (u16h) / ₦250,000 (u19m);
refundable before the unit ships. Prices live in
`paystack-webhook/helpers.ts` (`PRICE_NAIRA`, `DEPOSIT_NAIRA`) — change
them there and only there.

## 3. Frontend metadata contract

The Inline v2 call must send `metadata` containing: `order_type`
(`full` | `reservation`), `sku` (`u16h` | `u19m`), `sku_name`,
`full_price_naira`, `amount_paid_naira`, `balance_due_naira`,
`refundable`, and a `custom_fields` array carrying full name, phone,
delivery address, product, order type (Paystack
`{ display_name, variable_name, value }` shape; the webhook matches
`full_name`, `phone`, `delivery_address` variable names first, display
names as fallback).

The web flow must NOT pre-insert order rows — the webhook is the sole
writer (2026-06-06 decision). The old pending-row pattern in the
leiko.health codebase must be removed before go-live.

## 4. Orders table

`public.orders` (migration 0036, relaxed by 0037): RLS enabled with
**no policies** — service_role only, no client reads or writes by
design. `sku`/`order_type` are deliberately unconstrained so flagged
payments with unrecognized values still save for review; `status` is
constrained to `paid | reserved | flagged | refunded` because only our
code sets it. `raw_metadata` stores the full verified metadata + a
verification snapshot + `flag_reason` for audit.

## 5. Secrets (Supabase function secrets — never frontend, never git)

```
supabase secrets set PAYSTACK_SECRET_KEY=sk_...      # signature + verify API
supabase secrets set ORDER_ALERT_EMAIL=<operator@..> # internal alerts
# Already set (shared with invite emails):
#   RESEND_API_KEY, RESEND_FROM_EMAIL
# Auto-provided by the platform:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

Missing `PAYSTACK_SECRET_KEY` → the function 503s every request (fail
closed). Missing Resend/alert secrets → orders still save; sends are
logged as `resend_not_configured` / `alert_email_not_configured`.

## 6. Operator setup checklist

1. `supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...` (test key first).
2. `supabase secrets set ORDER_ALERT_EMAIL=...`.
3. Confirm the `RESEND_FROM_EMAIL` domain is verified in Resend.
4. Paystack dashboard → Settings → API Keys & Webhooks → Webhook URL:
   `https://kqnzxjrpnjnczhgdwdqg.supabase.co/functions/v1/paystack-webhook`
5. Run the §7 acceptance pass **in Paystack test mode**.
6. Swap to `sk_live_...` and repeat 4 on the live-mode webhook settings.

Redeploys must keep `verify_jwt = false` (pinned in
`supabase/config.toml`; pass `--no-verify-jwt` when deploying via CLI).

## 7. Acceptance tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Valid `charge.success`, correct amount | order saved (`paid`/`reserved`), buyer email + internal alert, once |
| 2 | Tampered/invalid signature | 401, nothing saved, no email |
| 3 | Same reference delivered twice | one row, one set of emails, second delivery → 200 `duplicate:true` |
| 4 | Amount ≠ order type | row saved `flagged`, internal alert only, no buyer email |
| 5 | Non-`charge.success` event | 200, ignored |
| 6 | Resend down/failing | order still saved, 200, `resend_failed` in logs |
| 7 | Log + response hygiene | no `sk_`/Resend key in any response or log line |

Test-mode walkthrough: pay with Paystack's test card
(4084 0840 8408 4081, any future expiry, CVV 408) against the test-mode
Inline checkout; replay deliveries from Paystack dashboard → Webhooks to
cover #3. For #2, curl the URL with a junk `x-paystack-signature`.

## 8. Follow-ups (deliberately not built)

- Collecting the reservation balance at fulfilment (invoice/payment link).
- Refund initiation (dashboard or Refund API; `refund.processed` is
  already consumed → status `refunded` + buyer notice).
- USD/Stripe phase.
- leiko.health: remove the pending-row pre-insert (§3).
