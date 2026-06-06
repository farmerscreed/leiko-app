# D16 — Paystack payments: the deposit-ladder (web orders)

Status: shipped 2026-06-06 (Finance Sprint, Paystack phase).
Code: `supabase/functions/paystack-webhook/` · Schema: migrations `0036` + `0037` + `0038`.
Frontend: `LeikoWebsite/leiko` repo — `/reserve`, `/reserve/complete`, worker `/api/*`.

The server-side source of truth for LEIKO web payments. The leiko.health
frontend collects payment with **Paystack Inline v2** (popup on the page,
no redirect, no payment-by-email); its browser `onSuccess` callback is
never trusted and never fulfils an order. An order exists only after this
webhook has verified the signature, re-verified the transaction against
the Paystack API, and validated the exact amount.

This is the **NGN/Paystack phase**. USD/Stripe is a later phase and gets
its own webhook + doc when it lands. International visitors join a
waitlist (no payment) until then.

## 1. The deposit-ladder

One conversion action on `/reserve`, the upsell after commitment:

```
Step 1  /reserve            ₦50,000 refundable deposit, inline.
                            Name + email + phone + optional model
                            preference. Order row: status='reserved',
                            sku may be 'undecided'.

Step 2  confirmation email  "Your spot is held" + Founder Edition
                            invitation → personal link to
                            /reserve/complete?ref=<reference>&e=<b64 email>.
                            Waiting is fine — deposit holds the place.

Step 3  /reserve/complete   Choose Leiko Watch (₦200,000 balance) or
                            Pro (₦250,000 balance), give delivery
                            address, pay inline. Webhook UPDATES the
                            reservation row: status='paid', sku set,
                            amounts summed. Completion email + alert.
```

## 2. Webhook flow

```
Paystack ──POST──▶ /functions/v1/paystack-webhook   (verify_jwt=false)
  1. HMAC-SHA512(raw body, PAYSTACK_SECRET_KEY) ≟ x-paystack-signature
     └─ mismatch → 401, stop
  2. event ≠ charge.success → 200, ignore
     (refund.processed → matches deposit OR balance reference →
      status='refunded' + buyer notice, then 200)
  3. GET api.paystack.co/transaction/verify/{reference}   ← independent
     └─ unreachable/5xx → 503 (Paystack retries; deliberate deviation
        from the original brief so a transient outage can't lose a sale)
  4. status=success ∧ currency=NGN ∧ amount matches order_type+sku
     └─ mismatch → save status='flagged', internal alert ONLY, 200
  5. order_type routing:
     · reservation / full → INSERT (UNIQUE paystack_reference,
       ignoreDuplicates → duplicate delivery = 200, no row, no email)
     · balance → conditional UPDATE of the reservation row
       (status='reserved' AND balance_reference IS NULL); UNIQUE
       balance_reference; orphan/invalid balances saved as their own
       flagged rows — a real payment is never silently dropped
  6. Resend emails (best-effort — a failed send never rolls back an
     order): buyer confirmation (reservation email carries the Founder
     Edition CTA + complete-link) + internal alert to ORDER_ALERT_EMAIL.
     Flagged orders: internal alert only, subject "FLAGGED — review".
  7. 200
```

## 3. Amount rules (kobo; ₦1 = 100 kobo)

| order_type + sku | Price | Expected `data.amount` |
|---|---|---|
| `full` + `u16h` (Leiko Watch) | ₦250,000 | 25,000,000 |
| `full` + `u19m` (Leiko Watch Pro) | ₦300,000 | 30,000,000 |
| `reservation` (sku may be `undecided`) | ₦50,000 | 5,000,000 |
| `balance` + `u16h` | ₦200,000 | 20,000,000 |
| `balance` + `u19m` | ₦250,000 | 25,000,000 |

Anything else → `flagged`. `balance` requires a concrete sku;
`reservation` doesn't. Prices live in **two files that must stay in
sync**: `paystack-webhook/helpers.ts` (`PRICE_NAIRA`, `DEPOSIT_NAIRA`)
here, and `src/lib/payments.ts` in the LeikoWebsite repo.

## 4. Frontend metadata contract

**Reservation** (`/reserve` Inline v2 `metadata`): `order_type:
"reservation"`, `sku` (`u16h` | `u19m` | `undecided`), `sku_name`,
`full_price_naira` (null when undecided), `amount_paid_naira: 50000`,
`balance_due_naira` (null when undecided), `refundable: true`, and
`custom_fields` `[{display_name, variable_name, value}]` carrying
`full_name`, `phone`, `model_preference`, `order_type`.

**Balance** (`/reserve/complete`): `order_type: "balance"`, concrete
`sku` + `sku_name`, **`reservation_reference`** (the deposit's Paystack
reference — how the webhook finds the row to complete),
`full_price_naira`, `amount_paid_naira`, `balance_due_naira: 0`, and
`custom_fields` carrying `full_name`, `phone`, **`delivery_address`**,
`product`, `order_type`.

The complete-link is built by THIS function (`buildCompleteUrl`):
`{SITE_BASE_URL}/reserve/complete?ref=<reference>&e=<urlsafe-b64 email>`.
The worker's `/api/reservation` requires ref AND matching email, so a
bare reference can't read anyone's data.

## 5. Orders table

`public.orders` (0036, relaxed by 0037, extended by 0038): RLS enabled
with **no policies** — service_role only, no client reads/writes by
design. `sku`/`order_type` deliberately unconstrained so flagged
payments with unrecognized values still save; `status` constrained to
`paid | reserved | flagged | refunded` (only our code sets it).
`balance_reference` (UNIQUE) + `balance_paid_at` are the step-2
idempotency lock. `raw_metadata` keeps the full verified metadata, a
verification snapshot, `flag_reason`, and (after a balance) a `balance`
sub-object for audit.

## 6. Secrets & config

**Supabase function secrets** (never frontend, never git):
```
supabase secrets set PAYSTACK_SECRET_KEY=sk_...   # signature + verify API
supabase secrets set ORDER_ALERT_EMAIL=<operator>
# optional: SITE_BASE_URL (defaults to https://leiko.health)
# already set (shared with invite emails): RESEND_API_KEY, RESEND_FROM_EMAIL
# auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```
Missing `PAYSTACK_SECRET_KEY` → every request 503s (fail closed).
Missing Resend/alert config → orders still save; sends log
`resend_not_configured` / `alert_email_not_configured`.

**Cloudflare worker vars** (LeikoWebsite repo): `PAYSTACK_PUBLIC_KEY`
(pk_test → pk_live; served to the browser via `/api/config`, so the
test→live swap needs no rebuild), plus existing
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`,
`ADMIN_USER`, `ADMIN_PASSWORD`.

Redeploys of this function must keep `verify_jwt = false` (pinned in
`supabase/config.toml`; `--no-verify-jwt` on CLI deploys).

## 7. Operator setup checklist

1. Supabase secrets (§6) — test keys first.
2. Paystack dashboard → Settings → API Keys & Webhooks → Webhook URL:
   `https://kqnzxjrpnjnczhgdwdqg.supabase.co/functions/v1/paystack-webhook`
3. Cloudflare worker var `PAYSTACK_PUBLIC_KEY` = pk_test, then deploy the
   site (`npm run build && npx wrangler deploy` in the web repo).
4. Confirm the Resend sender domain is verified.
5. Run the §8 acceptance pass **in Paystack test mode**
   (card 4084 0840 8408 4081, any future expiry, CVV 408).
6. Swap both keys to live (`sk_live` secret + `pk_live` worker var) and
   set the live-mode webhook URL in the Paystack dashboard.

## 8. Acceptance tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Deposit on /reserve, correct ₦50,000 | row `reserved`, buyer email (with Founder CTA) + alert, once |
| 2 | Tampered/invalid signature | 401, nothing saved, no email — **verified live 2026-06-06** |
| 3 | Same reference delivered twice (dashboard replay) | one row, one set of emails, replay → 200 `duplicate:true` |
| 4 | Amount ≠ order type | row `flagged`, internal alert only, no buyer email |
| 5 | Non-`charge.success` event | 200, ignored |
| 6 | Balance on /reserve/complete, correct amount | reservation row → `paid`, sku + address recorded, completion email + alert once |
| 7 | Balance replay / second balance attempt | no double-apply (UNIQUE balance_reference); competing payment → flagged row |
| 8 | Orphan balance (unknown reservation_reference) | own row `flagged`, alert only |
| 9 | Resend down | order still saved, 200, `resend_failed` logged |
| 10 | Refund processed (either reference) | order `refunded`, buyer notice |
| 11 | Hygiene | no `sk_`/Resend key in any response or log line |

## 9. Follow-ups (deliberately not built)

- USD/Stripe phase (international checkout; waitlist holds those leads) —
  **ready-to-go build brief: `docs/17-payments-stripe-brief.md`**.
- Refund initiation (dashboard or Refund API; `refund.processed` is consumed).
- Fulfilment statuses beyond `paid` (e.g. shipped) — needs a schema
  decision; /admin currently tracks to `paid`/`refunded`.
- Server-side CAPI Purchase ping lives in the worker
  (`/api/order-status?track=1`) — revisit if polling ever moves.
