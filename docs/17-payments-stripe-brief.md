# D17 — Stripe phase build brief (USD / international checkout)

Status: NOT STARTED — this is the ready-to-go brief, written 2026-06-07
at the close of the Paystack phase so the Stripe phase starts seamless.
Prerequisite reading: `docs/16-payments-paystack.md` (the live system
this phase extends — same architecture, second provider).

## 0. Kickoff checklist (answer these FIRST, before any code)

1. **Confirm USD pricing.** The web repo's decisions table says
   **$185 Leiko Watch / $230 Pro / $50 deposit** (Founder Edition
   pricing; $200/$250 was "retail"). Confirm which numbers are current
   before hardcoding cents — the Paystack phase began with three
   conflicting price sets and cost a round-trip.
2. **Stripe account live?** Lawone Cloud LLC (Wyoming) — activate the
   US Stripe account, complete business verification, decide on Stripe
   Tax (US sales tax on hardware varies by state).
3. **Same deposit-ladder?** Default assumption: yes — $50 deposit on
   /reserve, balance ($135 Watch / $180 Pro at Founder pricing) on
   /reserve/complete. Confirm.
4. **Shipping cost handling** — the old FAQ promised "$15–40 calculated
   at checkout". Decide: flat, Stripe Shipping Rates, or folded into
   price. This changes the amount-validation rules.
5. Who flips the waitlist? `contacts` rows with
   `source like 'waitlist_intl%'` have been accumulating since
   2026-06-06 — they were promised "first to know". Plan the
   announcement email as part of launch.

## 1. Architecture — mirror Paystack exactly

One rule made the Paystack phase safe and it carries over verbatim:
**the browser is never trusted; a single server-side webhook is the only
writer of orders.**

```
Browser: Stripe inline payment (Payment Element or embedded Checkout —
         NOT payment links, NOT email round-trips; founder rejected
         payment-by-email explicitly on 2026-06-06)
   │
Stripe ──POST──▶ NEW Supabase Edge Function: stripe-webhook
   1. Verify `stripe-signature` header: parse `t=...,v1=...`, compute
      HMAC-SHA256(secret, `${t}.${rawBody}`), constant-time compare
      against every v1. RAW body — never re-serialize. (Reuse
      constantTimeEqual from paystack-webhook/helpers.ts; the worker's
      DELETED webhooks.ts had a correct parser — see git history
      farmerscreed/leiko @ pre-5baf572 src/email/webhooks.ts.)
   2. Act on checkout.session.completed / payment_intent.succeeded
      (pick ONE based on the integration surface chosen). Everything
      else → 200 ignored. charge.refunded → status='refunded' + buyer
      notice (mirror refund.processed).
   3. Independently retrieve the session/intent from the Stripe API —
      never trust the event payload's amount alone.
   4. Validate currency === 'usd' + exact amount_total in CENTS per
      order_type + sku. Mismatch → status='flagged', internal alert
      only, no buyer email.
   5. reservation/full → idempotent INSERT (Stripe event ids / session
      ids are unique — same UNIQUE-reference pattern);
      balance → conditional UPDATE of the reservation row (same
      balance_reference lock).
   6. Resend emails, best-effort, never roll back an order.
   Response codes: 401 bad signature · 503 secrets missing or Stripe
   API unreachable (so Stripe retries — same deliberate deviation as
   Paystack) · 500 DB write failed · 200 everything else.
```

Deploy with `verify_jwt = false` (pin in `supabase/config.toml` like
`[functions.paystack-webhook]`) — Stripe sends no Supabase JWT.

## 2. Schema decision (the one real design choice)

`public.orders` is currently NGN-shaped: `amount_paid_kobo`,
`full_price_naira`, `balance_due_naira`. Recommended migration:

```sql
alter table public.orders
  add column currency text not null default 'NGN'
    check (currency in ('NGN','USD')),
  add column provider text not null default 'paystack'
    check (provider in ('paystack','stripe'));
-- amount_paid_kobo is reinterpreted as MINOR UNITS (kobo or cents);
-- full_price_naira / balance_due_naira as MAJOR units of `currency`.
-- Renaming to amount_paid_minor / full_price / balance_due is nicer but
-- touches the webhook, /admin, /api/* and emails — do it in the same
-- pass or not at all. Half-renamed is worse than honestly mislabeled.
```

The UNIQUE `paystack_reference` column holds the Stripe session/intent
id for Stripe orders (or rename to `provider_reference` in the same
rename pass). `/admin` financials must then bucket by currency — do NOT
sum kobo and cents into one number.

## 3. Amount rules (CENTS — confirm at kickoff per §0.1)

| order_type + sku | Price (Founder) | Expected amount |
|---|---|---|
| `full` + `u16h` | $185 | 18,500 |
| `full` + `u19m` | $230 | 23,000 |
| `reservation` (sku may be `undecided`) | $50 | 5,000 |
| `balance` + `u16h` | $135 | 13,500 |
| `balance` + `u19m` | $180 | 18,000 |

Plus shipping per §0.4. Keep the same flagged-on-mismatch behavior.
Prices must live in the same two synced files: webhook `helpers.ts`
(add `PRICE_USD`/`DEPOSIT_USD`) and web `src/lib/payments.ts`.

## 4. Metadata contract (carry over unchanged)

Same keys as D16 §4: `order_type` (`full`|`reservation`|`balance`),
`sku`, `sku_name`, `reservation_reference` (balance only), price fields,
and the customer fields. Stripe metadata is flat strings (no
custom_fields array) — put `full_name`, `phone`, `delivery_address`
directly in `metadata`. The buyer email comes from
`customer_details.email` on the session.

## 5. Frontend changes (LeikoWebsite repo)

- **`/reserve`**: the `isNigeria` branch stays Paystack; the waitlist
  branch becomes the Stripe inline deposit for supported countries
  (keep waitlist as the fallback for unsupported ones). Currency-aware
  copy + analytics values (`currency: "USD"`).
- **`/reserve/complete`**: route on the reservation's currency (the
  `/api/reservation` response should gain a `currency` field) so an NGN
  depositor pays an NGN balance and a USD depositor a USD balance —
  never mix.
- **`src/lib/payments.ts`**: add `payWithStripe(...)` beside
  `payWithPaystack(...)`; same `PayResult` shape, same
  `waitForOrder(reference)` polling (it already matches any reference).
- **Worker `/api/config`**: add `stripePublishableKey` (from a
  `STRIPE_PUBLISHABLE_KEY` worker secret — same no-rebuild key-swap
  trick as Paystack).
- **`/api/order-status`**: works as-is; pass the Stripe reference. CAPI
  ping needs the right currency on the GA4/Meta values.
- Homepage/`ReserveCTA` USD display prices finally become payable —
  reconcile that copy at launch (flagged 2026-06-06, founder's call).

## 6. Secrets

| Where | Name | Notes |
|---|---|---|
| Supabase | `STRIPE_SECRET_KEY` | `sk_...` — API retrieval |
| Supabase | `STRIPE_WEBHOOK_SECRET` | `whsec_...` — signature |
| CF worker | `STRIPE_PUBLISHABLE_KEY` | `pk_...` — public |

⚠️ **Never paste sk/whsec keys in chat** (the Paystack test keys had to
be rotation-flagged for this). ⚠️ **PowerShell pipe corrupts wrangler
secrets with a BOM** — always `cmd /c "npx wrangler secret put NAME < file"`
with `[IO.File]::WriteAllText` (no BOM).

## 7. Gotchas bank (paid for once already — don't pay twice)

1. RAW body for HMAC; parse only after the signature passes.
2. `verify_jwt = false` or the gateway 401s Stripe before your code runs.
3. Flagged rows must persist whatever garbage arrived — no check
   constraints on sku/order_type (migration 0037 rationale).
4. Email failure never rolls back an order; missing email config logs
   and continues.
5. Verify-API outage → 5xx so the provider retries; 200 would silently
   eat a real payment.
6. TanStack file routes: `a.b.tsx` nests inside `/a` — use `a_.b.tsx`
   for standalone child paths (the /reserve/complete bug).
7. Test mode and live mode have SEPARATE webhook endpoint settings in
   the provider dashboard — configure both.
8. Stripe events can arrive out of order and duplicated — idempotency
   by unique reference, never by "first delivery wins" assumptions.
9. Webhook + site prices live in two repos — sync them in the same
   sitting, and `/admin` financials must stay currency-segregated.
10. Casing: webhook says "LEIKO Watch", site says "Leiko Watch" —
    pick one at kickoff (open cosmetic from the Paystack phase).

## 8. Acceptance matrix (test mode, card 4242 4242 4242 4242)

Mirror D16 §8 exactly, in USD: clean deposit → `reserved` + emails once
· tampered signature → 401, nothing saved · duplicate event → one row,
one email set · wrong amount → `flagged`, alert only · non-handled
event → 200 ignored · balance → `paid` with address · balance replay →
no double-apply · orphan balance → flagged · Resend down → order
survives · refund → `refunded` + notice · no secrets in logs. Plus two
new ones: **NGN depositor cannot pay a USD balance (and vice versa)** ·
**/admin financials show NGN and USD separately**.

## 9. Definition of done

Same bar as Paystack: webhook + tests green · migration applied + in
repo · frontend live on leiko.health · full acceptance matrix passed in
test mode · waitlist announcement sent · docs updated (this file gets
rewritten as the canonical D17, like D16 was) · both repos pushed.
