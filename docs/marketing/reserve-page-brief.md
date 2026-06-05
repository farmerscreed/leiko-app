# Brief — leiko.health/reserve page (v2 with tiered pricing)

> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

**For the agent maintaining leiko.health. Self-contained — everything you need to execute is below.**

> 🔒 **CONFIDENTIALITY — supplier identity is a trade secret.** Never publish the
> manufacturer's name, the FDA establishment-registration number, the 510(k) number,
> any EUDAMED/UDI identifier, or "verifiable links" to the FDA/EUDAMED/ISO public
> records — **each one resolves to the manufacturer** in a public database. State the
> regulatory *status* generically ("FDA-listed Class II, cleared via the 510(k)
> process"; "EU MDR Class IIa"; "ISO 13485 manufacturing"). Substantiation numbers are
> held privately by the founder and provided off the public record only if an ad
> platform or regulator asks. Also: "cleared", never "approved" (Class II is cleared).

---

## TL;DR

Add a high-conversion `/reserve` page to leiko.health that captures $50 refundable deposits for the Leiko watch from cold ad traffic, with **three tiered pricing levels** to reward early commitment:

| Tier | Slots | Leiko price | Leiko Pro price | Deposit | Balance at ship |
|---|---|---|---|---|---|
| **Founders' Edition** | First 30 (in-stock) | **$149** (was $200) | **$199** (was $250) | $50 | $99 / $149 |
| **Early Reservation** | Next 1,000 | **$179** (was $200) | **$229** (was $250) | $50 | $129 / $179 |
| **Reservation** | Open from there | **$200** | **$250** | $50 | $150 / $200 |

Same $50 deposit across all tiers — simpler ops, cleaner messaging. The remaining balance varies by tier.

This is the single most important conversion surface in the entire Leiko go-to-market for the next 60 days. The Ads Playbook (in the leiko-app repo at `docs/marketing/leiko-ads-playbook.md`) targets this page exclusively. Every choice optimises for conversion.

---

## What Leiko is — for context

A wristwatch with a real inflating blood-pressure cuff (vs the optical "estimate" most smartwatches use). An FDA-listed Class II blood-pressure device, cleared through the FDA 510(k) process. EU MDR Class IIa. ISO 13485 certified manufacturing. *(State these generically — never the underlying numbers or maker; see the confidentiality note above.)*

The watch + a companion app that shows the user how their daily activities (walk, sleep, stress) affect their blood pressure. Pairs with a Family Circle so adult children can watch over elderly parents' readings remotely.

Two variants:
- **Leiko** — base sensors, family circle, full app
- **Leiko Pro** — premium band, expanded sensor accuracy, priority support

---

## Why tiered pricing

People who pay a deposit months in advance deserve a reward over people who buy after the product is proven. This is the Kickstarter playbook:

- **Tier 1 — Founders' Edition** rewards the highest-trust buyers (cold-traffic conversions on a brand new product) with a meaningful $51 discount. 30 slots only — sells out fast, builds urgency, creates social proof for everyone else
- **Tier 2 — Early Reservation** rewards the bulk of Phase 1 reservers with a $21 discount. 1,000 slots large enough to fund a real production run while staying scarce
- **Tier 3 — Reservation** holds at full price after early-reservation slots fill. Protects margin for late-comers while honoring early adopters

Same $50 deposit means: one deposit amount in DB, one refund logic, one ad CTA. The variable is what's owed at ship.

---

## Page structure (top to bottom)

### 1. Hero (above the fold on a 360 × 640 mobile)

**Left side (desktop) / top (mobile)**:
- Product photograph: the Leiko watch on a real wrist, the fabric cuff visible. If you don't have real product photography yet, use the AI placeholder from `docs/marketing/leiko-ads-playbook.md` Part 7.1 (Midjourney Real-Cuff prompt) until real photos exist
- Optional: 4-second silent looping video of the cuff inflating + deflating

**Right side (desktop) / below product (mobile)**:
- Eyebrow line: small text, copper accent — `Founders' Edition · only 30 slots`
- Headline: **"A real cuff. A real number."** (Instrument Serif italic for "real number")
- Subhead: "The only consumer wristwatch that measures blood pressure with an actual inflating cuff — the same method as the cuff at your doctor's office."
- **Price banner (the visual anchor)**:
  ```
  Reserve for $50 today.
  Founders' Edition: $149 (was $200)  ← strikethrough on $200
  4 of 30 slots remaining             ← live counter
  ```
- Primary CTA button: **"Reserve my Leiko"** — scrolls to form OR opens form modal

When Tier 1 fills, the hero auto-updates to Tier 2 messaging:
```
Early Reservation: $179 (was $200)
847 of 1,000 slots remaining
```

When Tier 2 fills, hero auto-updates to:
```
Reserve from $200
Locks in your spot in the next batch
```

### 2. Trust strip (immediately after hero)

Three small badges side by side — **status claims only, NOT links to public records.**
Do **not** link to the FDA database lookup, the EUDAMED entry, or an ISO facility page:
each reveals the manufacturer (a trade secret — see the confidentiality note up top).
- "FDA-listed Class II device"
- "EU MDR Class IIa"
- "ISO 13485 manufacturing"

If a visitor or platform wants proof, route them to a "Verified — details on request"
note; the founder supplies substantiation privately, off the public page.

Below the badges, one line of body text:
"Most BP smartwatches are sports trackers in disguise. Leiko is the real thing."

### 3. Demand counter (live)

A single horizontal stripe:

**"1,247 people have reserved their Leiko."**

Number reads live from `select count(*) from reservations where status not in ('cancelled', 'refunded')`. Updates every 30 seconds via Supabase Realtime or polling.

Below the number: "Reservations are converting to ship slots in the order received. Reserve early to lock in your batch."

### 4. The five pillars

Each pillar gets its own card with an illustration and a 30-50 word description. In this order:

1. **A real cuff, not an estimate** — Most BP smartwatches optically estimate from your pulse. Leiko inflates a real micro-cuff, the same oscillometric method as a doctor's office. The result is a number you can trust.

2. **See how your day shows up in your numbers** — An hour-long walk. Eight hours of sleep. A stressful meeting. Each one moves your blood pressure. Leiko's app shows you exactly how much, so you can change what matters with evidence instead of guesses.

3. **Five vitals, one calm view** — Blood pressure, heart rate, oxygen saturation, sleep with stages, and daily activity. All in one place, with plain-language context for what each number means.

4. **Watch over the people you care for** — Invite up to five family members to your Family Circle. Adult children, partners, personal nurses — they see readings as they arrive and can leave a short note, no phone call required.

5. **One-tap doctor PDF** — Generate a clean clinical summary your doctor wants to see. Save it, email it, or hand it over at your next appointment.

### 5. Pricing comparison (NEW — between pillars and form)

A clean horizontal card layout showing all three tiers at a glance. The currently-active tier is highlighted; sold-out tiers are dimmed with a "SOLD OUT" overlay.

```
┌────────────────────────┬────────────────────────┬────────────────────────┐
│  FOUNDERS' EDITION     │  EARLY RESERVATION     │  RESERVATION           │
│  Save $51              │  Save $21              │  Standard pricing      │
│                        │                        │                        │
│  Leiko       $149      │  Leiko       $179      │  Leiko       $200      │
│  Leiko Pro   $199      │  Leiko Pro   $229      │  Leiko Pro   $250      │
│                        │                        │                        │
│  Ships in 1-2 weeks    │  Ships batch 1         │  Ships batch 2+        │
│  ⓘ 26 of 30 left       │  available             │  available             │
│                        │                        │                        │
│  [active highlight]    │                        │                        │
└────────────────────────┴────────────────────────┴────────────────────────┘
```

The current tier is selected by default — the user can click into another tier if they prefer (e.g., if Founders' is sold out they automatically land on Early Reservation).

Below the comparison, a subtle line: "Same $50 deposit on every tier. Tiers fill in order — your reservation locks the next available slot."

### 6. Variant selector + reservation form

A clean two-column layout (single column on mobile):

**Left — Variant selector (radio buttons with visual cards)**:

```
[ ] Leiko — $149 (Founders' Edition price; $200 standard)
    Real cuff, 5 vitals, Family Circle, plain-language insights.
    Reserve for $50 today, $99 due at ship.

[•] Leiko Pro — $199 (Founders' Edition price; $250 standard)
    Everything in Leiko, plus a premium band, expanded sensor
    accuracy, and priority support.
    Reserve for $50 today, $149 due at ship.
```

(Numbers above shown for Founders' Edition tier. They update dynamically based on the currently-active tier.)

**Right — Reservation form (minimal fields, single page)**:

```
Full name *                  [_________________]
Email *                      [_________________]
Country (shipping) *         [▼ dropdown]
Phone (optional)             [_________________]
```

Below the form fields:
- A clear summary box: "Reserve **Leiko Pro · Founders' Edition** for $50 today. $149 due when your watch ships. Fully refundable any time before shipment."
- A single big button: **"Pay $50 and Reserve"**
- A small line under the button: "Secured by Stripe (USD payments) / Paystack (NGN payments). Your card is authorized today but only charged when your watch is ready to ship."

### 7. How reservation works (FAQ-style, four cards)

| Q | A |
|---|---|
| What happens after I reserve? | We authorize your $50 deposit and email a reservation number. You'll get progress updates as we move toward your ship date. The deposit is captured only when your watch ships. |
| When will my watch ship? | Founders' Edition ships in 1-2 weeks (already in stock). Early Reservation batch 1 ships in 4-8 weeks. Subsequent batches every 6-8 weeks. Your reservation order determines your batch. |
| What if I want to cancel? | Cancel any time before your batch ships from your account page. Full $50 refund within 5 business days. |
| What about international shipping? | We ship to any country. Shipping cost calculated at checkout when your batch is released; expect $15-40 depending on destination. |

### 8. Testimonials (skip if you don't have real ones)

If you don't have real customer quotes yet: skip this section entirely. Don't fake them. Instead, a short paragraph from the founder explaining why Leiko exists, with a real photo of Lawrence. Trust comes from authenticity.

### 9. Footer

Standard leiko.health footer. Add a small line:

"Questions? Email **support@leiko.app**. Read our [Privacy](/privacy) and [Terms](/terms)."

---

## Backend / database

### New Supabase table: `reservations`

```sql
create table reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_number serial not null,                  -- public-facing #1247 etc.
  full_name text not null,
  email text not null,
  country_code text not null,                          -- ISO 3166-1 alpha-2
  phone text,
  variant text not null check (variant in ('leiko', 'leiko_pro')),

  -- Tier pricing
  tier text not null check (tier in ('founders', 'early', 'open')),
  tier_slot_number integer,                            -- 1-30 for founders, 1-1000 for early, null for open
  price_total_cents integer not null,                  -- 14900, 17900, 19900, 22900, 19999, 22999, 24999 etc.
  deposit_cents integer not null default 5000,        -- $50 flat across tiers
  currency text not null check (currency in ('USD', 'NGN')),

  -- Payment tracking
  stripe_payment_intent_id text,
  paystack_reference text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'authorized', 'captured', 'failed', 'refunded')),
  authorized_at timestamptz,
  captured_at timestamptz,
  refunded_at timestamptz,

  -- Lifecycle
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'refunded', 'shipped', 'fulfilled')),
  batch_number integer,                                 -- assigned at ship time
  ship_window_start date,
  ship_window_end date,

  -- Attribution
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,

  -- Audit
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_email_idx on reservations(email);
create index reservations_status_idx on reservations(status);
create index reservations_tier_idx on reservations(tier);

-- One reservation per email (prevents fake-email arbitrage on Founders' tier)
create unique index reservations_email_active_uniq on reservations(email)
  where status = 'active';

-- Unique slot per tier (atomic allocation — prevents two users from grabbing slot 30 simultaneously)
create unique index reservations_tier_slot_uniq
  on reservations(tier, tier_slot_number)
  where tier_slot_number is not null and status = 'active';
```

### Atomic tier-slot allocation logic

When a reservation comes in, the server must atomically:

1. Determine the user's currently-eligible tier (Founders' if any slots remain, else Early if any, else Open)
2. Assign the next available `tier_slot_number` within that tier
3. Insert the row with the correct `price_total_cents` for the tier + variant

Use a transaction with `serializable` isolation OR a Postgres function that does the assignment in a single statement. Example function:

```sql
create or replace function allocate_reservation(
  p_full_name text,
  p_email text,
  p_country_code text,
  p_variant text,
  p_currency text
) returns reservations
language plpgsql
as $$
declare
  v_tier text;
  v_slot integer;
  v_price_cents integer;
  v_row reservations;
begin
  -- Lock the reservations table briefly to avoid race
  lock table reservations in share row exclusive mode;

  -- Determine tier and next slot
  select count(*) into v_slot from reservations
    where tier = 'founders' and status = 'active';
  if v_slot < 30 then
    v_tier := 'founders';
    v_slot := v_slot + 1;
    v_price_cents := case when p_variant = 'leiko' then 14900 else 19900 end;
  else
    select count(*) into v_slot from reservations
      where tier = 'early' and status = 'active';
    if v_slot < 1000 then
      v_tier := 'early';
      v_slot := v_slot + 1;
      v_price_cents := case when p_variant = 'leiko' then 17900 else 22900 end;
    else
      v_tier := 'open';
      v_slot := null;
      v_price_cents := case when p_variant = 'leiko' then 20000 else 25000 end;
    end if;
  end if;

  insert into reservations (
    full_name, email, country_code, variant, tier, tier_slot_number,
    price_total_cents, deposit_cents, currency
  ) values (
    p_full_name, p_email, p_country_code, p_variant, v_tier, v_slot,
    v_price_cents, 5000, p_currency
  ) returning * into v_row;

  return v_row;
end;
$$;
```

RLS: server-only writes (anon role cannot insert). The `/api/reserve` endpoint calls this function with the service role.

### Stripe integration (US, UK, EU)

Use **manual capture mode**. Authorize $50 today; capture only when the watch ships (or release if reservation is cancelled).

```javascript
const intent = await stripe.paymentIntents.create({
  amount: 5000,                       // $50 in cents
  currency: 'usd',
  capture_method: 'manual',           // critical
  payment_method: pmId,
  confirm: true,
  metadata: {
    reservation_id,
    tier,                              // 'founders' / 'early' / 'open'
    variant,
    full_price_cents,                 // 14900, 17900, etc.
  },
});
```

When the watch ships, capture:
```javascript
await stripe.paymentIntents.capture(intentId);
```

When the user cancels:
```javascript
await stripe.paymentIntents.cancel(intentId);   // releases authorization
```

When the batch ships and the remaining balance is due, create a SECOND PaymentIntent for the balance amount (`full_price_cents - deposit_cents`) and email the customer a payment link.

### Paystack integration (NG)

Use **transaction.initialize** + **transaction.charge_authorization** for the deposit-now-charge-later pattern:

```javascript
const tx = await paystack.transaction.initialize({
  email,
  amount: nairaAmount,                // e.g. 75000 kobo if $50 ≈ ₦75,000
  callback_url: 'https://leiko.health/reserve/confirm',
  metadata: { reservation_id, tier, variant },
});
```

For batch shipping, capture via `transaction.charge_authorization` with the saved authorization code.

### Pixel events to fire

On `/reserve` page load:
- **Meta Pixel**: `fbq('track', 'ViewContent', { content_name: 'Reservation Page' })`
- **Google Tag**: `gtag('event', 'view_item', { items: [{ item_id: 'leiko' }] })`
- **TikTok Pixel**: `ttq.track('ViewContent')`

On form submit (before payment):
- **Meta Pixel**: `fbq('track', 'InitiateCheckout', { value: 50, currency: 'USD', content_name: tier })`

On successful payment (server-side via webhook + client-side on thank-you page):
- **Meta Pixel** (browser): `fbq('track', 'Purchase', { value: 50, currency: 'USD', content_name: tier })`
- **Meta CAPI** (server, via Stripe/Paystack webhook): mirror the same event with hashed email + IP
- **Google Tag**: `gtag('event', 'conversion', { send_to: 'AW-XXX/YYY', value: 50, currency: 'USD' })`
- **TikTok Pixel**: `ttq.track('CompleteRegistration')`

The pixel IDs (Meta Pixel ID, Google conversion ID, TikTok Pixel ID) will be provided after ad accounts are set up. Use env vars so they're swappable.

---

## Email sequence (use Resend, which is already wired)

### Email 1 — Confirmation (immediate, tier-aware)

**Subject lines** by tier:
- Founders': `"You're a Leiko Founder. Reservation #1247 confirmed."`
- Early Reservation: `"Leiko reservation #1247 confirmed — Early Reservation"`
- Open: `"Leiko reservation #1247 confirmed"`

**Body** (Founders' variant):
```
Welcome to the first 30, [Name].

You're holding Founders' Edition slot {tier_slot_number} of 30. Your
Leiko {variant} ships in 1-2 weeks from our current stock.

Your reservation: #{reservation_number}
Today: $50 authorized (not yet charged)
At ship: $99 ($149 - $50)

What happens next:
1. We'll email when your Leiko ships, with a payment link for $99.
2. After you complete checkout, your watch ships within 2 business days.
3. Your card is charged only when the watch is on its way.

Cancel anytime: [link to /reservations/manage]
Questions: support@leiko.app

Lawrence
Founder, Leiko
```

Variants for Early Reservation + Open similar with their respective numbers.

### Email 2 — While you wait (day 7)

Subject: `"How the Leiko cuff actually works"`

Body: short educational content about oscillometric measurement, 3 paragraphs, founder voice. Builds trust between reservation and ship date.

### Email 3 — Social proof (day 21)

Subject: `"2,300 people have now reserved their Leiko"`

Body: updated count, brief story of one early Founder (with consent), reinforce upcoming ship window. Make Founders' feel rare.

### Email 4 — Ship-ready (manual trigger when batch ships)

Subject: `"Your Leiko is ready — complete your purchase"`

Body: remaining balance due (varies by tier), payment link, ship-to address confirmation, expected delivery date.

---

## Refund flow

User can click "Cancel reservation" on the confirmation page or in their account section. Flow:

1. Confirmation modal: "Are you sure? You'll lose your tier slot — if Founders' Edition is sold out, you'll re-enter at the currently active tier."
2. If confirmed: server cancels Stripe PaymentIntent OR Paystack auth
3. DB: set `status = 'refunded'`, set `refunded_at = now()`
4. The freed tier slot is NOT re-assigned (it's an unrecoverable cancellation, the original slot stays vacant) — keeps tier counts conservative
5. Email: "Your reservation has been cancelled. The $50 authorization will release within 5 business days."

Refund button is available until 24 hours before their batch ships. After that, refund minus a $5 fee (manufacturing is committed).

---

## What changes from the ads

The tier system makes the ad CTAs significantly more powerful. Examples:

- Founders' tier active: `"Reserve for $50 — save $51. Only 30 Founders' slots."`
- Early Reservation tier active: `"Reserve for $50 — save $21. Limited Early Reservation."`
- Open tier active: `"Reserve for $50. Lock in your batch."`

CPA likely drops 15-25% from the same audiences just because of this messaging change. As Founders' fills, ads auto-switch to Early Reservation messaging via the dynamic count.

---

## Acceptance criteria

- [ ] `/reserve` renders cleanly on mobile (≥360 px), tablet, desktop
- [ ] Hero is fully visible above the fold on a 360×640 phone
- [ ] CTA "Reserve my Leiko" is tappable above the fold
- [ ] Trust badges all link to verifiable sources (no dead links)
- [ ] Live demand counter updates without page refresh (Supabase realtime or 30s polling)
- [ ] **Live tier-slot counters** update without page refresh
- [ ] Form requires only 3 fields (name, email, country) plus variant
- [ ] Country dropdown auto-detects from IP and pre-selects on load
- [ ] **Tier auto-selects to the user's currently-eligible tier**
- [ ] $50 deposit charges via Stripe in USD for US/UK/EU countries
- [ ] $50 deposit charges via Paystack in NGN for Nigeria
- [ ] Confirmation page shows reservation number, tier, expected ship window, share buttons
- [ ] Email 1 fires immediately on successful payment with tier-aware copy
- [ ] All three pixels fire on the thank-you page
- [ ] CAPI server-side mirror fires on the Stripe/Paystack webhook
- [ ] Refund flow works end-to-end on a test reservation
- [ ] Reservation row visible in Supabase Studio after a test payment
- [ ] **Race condition test**: two concurrent reservations for Founders' slot 30 → exactly one wins, the other lands in Early Reservation slot 1**
- [ ] All voice rules pass: no "patient", "diagnose", "treat", "cure", "lower your BP", "silent killer", "before it's too late", "medical advice", "dangerous level", "critical level"

---

## Voice and tone rules (non-negotiable)

This page is read by anxious caregivers and curious adults. The tone must be calm, dignified, trustworthy. Never alarmist.

Forbidden words/phrases:
- "patient" → use "you" / "the person you care for" / "your parent"
- "diagnose", "diagnostic", "diagnosis" → use "see", "measure", "track"
- "treat", "treatment", "cure" → use "track", "watch over"
- "predict" / "prevent" applied to disease
- "silent killer", "ticking time bomb", "before it's too late"
- "medical advice" → use "Talk to your doctor"
- "dangerous level", "critical level"
- "lower your blood pressure", "reduce your BP" (outcome promises)

Use the existing privacy and terms pages on leiko.health as the voice reference. The /reserve page should feel like the same brand.

---

## Timeline

This page should ship within 5-7 days. It is the single biggest blocker between the Leiko ads strategy and any reservations starting to flow.

---

## Out of scope (handle later, not for v1 of this page)

- A/B testing infrastructure (iterate after launch)
- Wishlist / gift-a-reservation flow (Phase 2)
- Multi-language support (Phase 2; v1 is English only)
- Referral codes (Phase 2)
- Account management UI (just an email link to cancel for v1)
- Tier upgrade flow (e.g., user in Early Reservation paying $30 to upgrade to a Founders' slot — too complex for v1)

---

## Files to add or modify

- New: `src/routes/reserve/+page.svelte` (or equivalent for your stack)
- New: `src/routes/reserve/confirm/+page.svelte`
- New: `src/routes/api/reservations/+server.ts` (POST handler, calls `allocate_reservation` Postgres function)
- New: `src/routes/api/reservations/cancel/+server.ts`
- New: `src/routes/api/reservations/tier-status/+server.ts` (GET — returns current tier + slots remaining for the live counter)
- New: `src/routes/api/stripe-webhook/+server.ts` (existing? extend)
- New: `src/routes/api/paystack-webhook/+server.ts`
- New: `supabase/migrations/00XX_create_reservations.sql` (table + tier-allocation function)
- Modify: site footer to add "Reserve" nav link
- Modify: privacy policy to mention the reservation deposit

Any questions, ask. This page is the linchpin of the next 60 days.

— End of brief —
