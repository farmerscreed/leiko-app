# D15 — Affiliate & Editorial Commerce Strategy

> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

**Premium Editorial Commerce · Picks · Telemedicine · Pharmacy · Insurance**
*Prepared: 2026-05-09 · Status: Draft for founder sign-off · v0.1*

---

## Document Metadata

| Field | Value |
|---|---|
| **Deliverable** | D15 — Affiliate & Editorial Commerce Strategy |
| **Project** | Leiko health-wearable platform |
| **Predecessor docs** | D2 (Unit Economics) · D5 (Brand — superseded by D11) · D9 (Editorial) · D11 (Brand Repositioning) |
| **Sister docs** | None — D15 is a new strategic axis |
| **Authority** | When D15 conflicts with D11 voice rules, **D11 wins**. When D15 conflicts with D3 regulatory scope, **D3 wins**. D15 cannot expand the regulatory or voice surface; it must operate inside the existing constraints. |
| **Implementation gate** | Earliest implementation: **post-Sprint 17 (launch)**. Foundation work (Picks data model, click events) can be sprinted between launch and v1.1. |
| **Status** | Drafted from a 2026-05-09 brainstorm. Captures the full idea space for future implementation; no code or sprint is open against this document yet. |

---

## Executive Summary

D15 captures Leiko's secondary revenue strategy: **premium editorial commerce.** The brand position from D11 ("Aesop sales associate, not a fitness bro") forbids the entire vocabulary of conventional affiliate marketing — no fear hooks, no outcome promises, no gamified offers, no banner ads, no pushy notifications. That constraint is the moat. Anyone can run banner ads; almost no one can run editorial-quality commerce inside a healthcare app.

The recommendation: a single curated commerce surface called **"Picks"** at v1.0 launch (or shortly after), housing 8–15 hand-curated items per region with editorial-tone blurbs. Expand in v1.1 with the three high-revenue partnerships (telemedicine, pharmacy refill in Nigeria, micro-insurance for elders) that move the actual financial needle. v1.2 adds remittance partnerships, cultural shopping integrations, and a direct brand store.

The economics: at small scale (1k–10k users), affiliate commerce is editorial table-stakes — single hundreds to single thousands of dollars per month. The *real* revenue lines are partnership-based (telemedicine $20–$80/booking; insurance $5–$25/signup + trail; pharmacy $1–$5/refill recurring), where 100 monthly conversions translate to $2k–$8k/month. The Picks section makes those partnerships discoverable in a brand-coherent way without ever being pushy.

This document represents the locked v0.1 strategy. Founder sign-off promotes it to v1.0 and unlocks the implementation sprint (target post-launch).

---

## §1. Strategic Position

### 1.1 The position

> **Leiko's commerce is editorial, never advertorial. Every recommendation passes the Aesop test.**

The user opens Picks the way they'd open a magazine's product page: trusting the curator, expecting a small selection, expecting *taste* — not a search engine, not an aisle of options.

### 1.2 Why this fits Leiko (and only Leiko)

Three reasons.

1. **Audience.** Caregivers and self-buyers managing real conditions, not optimisers. They actively seek good information. They will reward a brand that recommends thoughtfully and punish one that hard-sells.
2. **Voice.** D11's premium-precise voice is already the voice of the best product-recommendation magazines (*Kinfolk, Cereal, Aesop's editorial*). Translating it to commerce costs nothing.
3. **Regulatory headroom.** We're not a covered entity (D3 — DTC path). We can carry editorial commerce in adjacent categories (kitchen, elder safety, books, second cuffs) without expanding our regulatory surface, *as long as we never recommend medication or supplement-as-cure.*

### 1.3 What this is not

- Not advertising — no third-party brands paying for placement or banner space.
- Not a marketplace — we don't fulfill, we don't hold inventory at v1.0.
- Not gamified — no points, no streaks, no "earn rewards by trying X."
- Not behavioural — we do not target picks based on the user's reading values. *"Mum's BP was high — try this!"* is forbidden. Picks are surfaced by region and by editorial schedule, not by health state.

---

## §2. Brand & Regulatory Constraints

These are non-negotiable. Any Picks copy or partnership must pass every gate.

### 2.1 D11 voice rules apply in full

The full forbidden vocabulary from D11 §3.2 + §3.3 + CLAUDE.md applies to every blurb, every CTA, every notification:

- No "patient," "diagnose," "treat," "predict," "prevent," "cure"
- No "silent killer," "ticking time bomb," "before it's too late"
- No outcome promises ("will lower your BP," "will help you live longer")
- No gamification ("streak," "level up," "achievement unlocked")
- No quantified-self language ("biohack," "performance," "potential," "optimise")
- No "smart [feature]," no "wellness" used as adjective
- No exclamation points in body copy

### 2.2 D9 editorial principles apply

- Observation, never prescription. *"People who switch to low-sodium stock often see…"* — never *"You should buy this stock."*
- Cite the source where one is meaningful. Editorial blurbs about salt or sleep reference AHA/ACC, NICE, or WHO if they make a numeric claim.
- Cultural specificity over generic universalism — Picks for Nigeria and Picks for US/UK are *separate sets,* not a single global list.

### 2.3 D3 regulatory boundaries

- **No medication recommendations.** No prescription drugs, no OTC symptom medication, no supplements positioned as treatment. (Calcium-low recipes okay; "calcium supplements lower BP" not.)
- **No cuff brands positioned as "more accurate than Leiko."** We sell against medical-method oscillometric BP; an affiliate-driven downsell to a cheaper cuff would be self-cannibalising and clinically suspect.
- **No NHIS-substitute claims.** Insurance partnerships are explicitly non-substitutes for actual medical insurance.

### 2.4 Privacy & PHI boundaries

- No reading values or vital states feed Pick selection. Region and editorial schedule only.
- Pick clicks log a `pick_clicked` event with `item_id` and `region` — no PHI.
- Affiliate vendor postbacks happen on the vendor side; Leiko receives only aggregate conversion counts via the vendor dashboard.
- No third-party tracking pixels or vendor-injected JS in the app.

### 2.5 The Aesop test

D11 §3.5: *Would an Aesop sales associate say this?* Every blurb runs through that test. If the answer is no — too excited, too anxious, too pushy — rewrite or kill.

---

## §3. The Eleven Ideas

Sorted by brand fit and revenue potential.

### Tier 1 — Strong fit, ship at v1.0 or v1.1

#### Idea 1 — "Picks" curated commerce section

A single dedicated section reachable from Settings → Picks (or as a v1.1 promotion to a bottom-tab when traction justifies). Editorial-first: every item carries a 2–3 sentence Leiko-voice blurb explaining *why this, why now.* You (or a hired writer) approve every item.

**Categories at v1.0:**
- A second BP cuff (Omron, Withings) for cross-checking the watch — not a replacement, an *adjunct*
- Low-sodium kitchen — region-specific (Nigeria: low-sodium jollof base, palm-oil alternatives, ofada-friendly seasoning; US/UK: salt substitutes, low-sodium stock, herb blends)
- Elder home safety — grab bars, soft slip-on shoes, walking sticks, non-slip bath mats
- Books and podcasts — premium-restrained list (Eat Drink and Be Healthy by Willett; Salt Sugar Fat by Moss; relevant podcast picks)

**Vendor model:**
- Amazon Associates (US/UK) — ~3–8% commission
- Jumia / Konga affiliate (Nigeria) — ~5–10% commission
- 3–5 direct brand partnerships where the margin is better and the brand is well-aligned (e.g., Withings, a low-sodium NG seasoning brand)

**Typical commission per category:**
- Books: 3–5%
- Kitchen / household: 4–8%
- Cuffs and electronics: 1–4%
- Direct brand partnerships: 8–15%

**Discoverability:**
- Settings → Picks at v1.0 (low-pressure entry)
- Optional: a single "new in Picks this month" surfaced under Daily Pulse on the 1st of each month, *only* for users who have visited Picks before. Never as the first surface for a user.
- No notifications at v1.0.

#### Idea 2 — Telemedicine partnership on the doctor-share flow

When a user taps "Share with doctor" from Trends and they don't have a doctor on file, offer *"Find a hypertension specialist near you."* This is the **single highest revenue-per-user lever** on the list.

**Partnerships to explore:**
- **Nigeria:** Mobihealth, Reliance HMO, Tremendoc, Helium Health
- **US:** Ro, Sesame, Plushcare, Hims & Hers (cardiovascular)
- **UK:** Pharmacy2U, LloydsDirect, Push Doctor

**Revenue model:** $20–$80 per qualified consultation booking. Some partners offer recurring trail (5–15% of patient lifetime value).

**Voice constraints:** *"Find a hypertension specialist near you"* — never *"Get diagnosed today!"* No urgency framing. The flow opens the partner's app or a webview to their booking page.

#### Idea 3 — Pharmacy refill — Nigeria-first

If the user manually logs their prescription schedule (opt-in, never auto-detected), the watch's existing reminder infrastructure can surface *"Tap to refill at [partner pharmacy]"* a few days before the bottle runs low. Per-refill kickback or per-dispense affiliate.

**Partners:** Reliance HMO, MedPlus, HealthPlus, May Baker (Nigeria); Walgreens, CVS, Boots (US/UK — already have refill APIs).

**The diaspora caregiver angle:** Adaeze (US/UK diaspora) sends remittances home for Mum's BP medication. *"Refill from [your country], delivered in Lagos in 24 hours"* is a powerful frame. Per D5 §1: 20–40% of diaspora remittances fund healthcare.

**Revenue model:** $1–$5 per refill recurring. For chronic medications (BP medication is forever), this compounds. 500 monthly refills × $3 = ~$1,500/month.

**Voice constraints:** Refill copy is *operational,* not health-claim. *"Mum's lisinopril is running low — tap to refill"* is observational. Never recommend dose changes. The pharmacy handles the actual fulfilment and any clinical questions.

#### Idea 4 — Health micro-insurance — diaspora caregiver lever

Nigeria has huge gaps in elder health insurance, and the diaspora caregiver is the buyer. Reliance HMO, Tangerine, AIICO, and HealthExchange all run micro-policies in the $5–$20/month range that cover hypertension management, GP visits, and basic diagnostics.

**The pitch (caregiver-facing):** *"Cover Mum for $12/month — managed in this app."* Activation flow, monthly billing inside Leiko, claims handled by the insurer.

**Revenue model:** $5–$25 per signup commission + 5–10% of monthly premium recurring trail. A caregiver activating a $15/month policy generates ~$0.75–$1.50/month in trail.

**Strategic value beyond revenue:** Insurance activation deepens the diaspora caregiver's product attachment. Churn drops materially.

### Tier 2 — Decent fit, smaller revenue or v1.1+

#### Idea 5 — Watch accessories

Replacement bands, charging cables, screen protectors. Two models:
- **Affiliate via Urion** — they likely have a partner program; lowest lift
- **Direct (Leiko-branded)** — we hold a small inventory at a 3PL, ship Leiko-branded boxes; higher margin but operational lift

Recommended path: affiliate at v1.0, evaluate direct in v1.1+ if volume justifies.

#### Idea 6 — Sleep and activity gear (contextual but careful)

Once we have sleep + activity data, a *very carefully worded* surfacing pattern is possible: a Picks item appears in the section when the user's recent vital state suggests relevance, **without naming the user's specific state.** *"Some readers asked about sleep environment. Here's what we like."* Borderline territory:

- Must NOT promise outcome ("blackout curtains lower your BP")
- Must NOT fear-bait ("your sleep score has been dropping")
- Must NOT auto-target individual users; must filter at population level (e.g., "users in winter months" not "this user has sleep score < 70")

If voice-lint passes, this is potentially the highest-converting placement because the relevance is real. If we can't make it pass, it's gone. **Defer the call to a Picks-content-policy review before any contextual surfacing ships.**

#### Idea 7 — Books / podcasts shelf

Bookshop.org and Amazon Affiliates carry book commissions of 3–10%. Premium-restrained list (max 5–8 books at a time) in editorial voice. Tiny revenue but reinforces the brand authority — *"Leiko is the kind of company that reads."*

### Tier 3 — Strategic, secondary revenue, v1.2+

#### Idea 8 — Remittance integration

D5 noted caregivers send $200–$2,000/month home, 20–40% earmarked for healthcare. Partner with Sendwave / Remitly / Lemfi: *"Send healthcare funds to Mum"* with a tagged purpose. Cross-promotion fee per signup ($10–$30) plus possible per-transaction commission.

Strategic alignment: very high. Whether they pay enough is a research call. **Defer to v1.2 partnership discovery.**

#### Idea 9 — Cultural shopping — Nigerian grocery affiliates

The CULTURAL Learn cluster (jollof, ofada, palm oil) is a natural commerce adjacency. Each cultural article surfaces a Picks subsection underneath (NOT inline links per D9 §12) pointing to:

- Pricepally — bulk groceries with delivery
- Foodlocker — Lagos grocery delivery
- Chowdeck — fresh ingredient delivery

Affiliate commission 3–8%. Geographic gating is already a v1.0 requirement — Nigerian users see the NG vendor set; US/UK users see nothing for this category at v1.0.

#### Idea 10 — Direct brand store (leiko.shop)

Higher margin (no affiliate cut), more control, more operational lift. Defer to v1.1+. The "Picks" model first; if it shows traction, graduate the highest-volume items into a direct store with Leiko-branded packaging. Could be a Shopify storefront integrated with the app via a webview wrapper.

### Tier 4 — Don't do these

**Idea 11 — explicitly out of scope:**

- ❌ **Banner ads, interstitials, push promos.** Breaks D11 §10.2 and the entire premium positioning.
- ❌ **Medication or supplement affiliates.** Regulatory mess (D3) and voice rules forbid. Even "natural" supplements positioned as BP-lowering are forbidden.
- ❌ **Gamified affiliate offers** ("earn points for trying X"). D11 §3.3 explicit no.
- ❌ **Affiliate links inside Learn cards.** D9 §12 explicit out-of-scope at v1.0; revisit in v1.2 with a warn-on-leave sheet pattern.
- ❌ **Behavioural retargeting** based on user reading values. PHI-adjacent and creepy.
- ❌ **Lead-gen for non-aligned categories** (life insurance, funeral plans, mortgages — all of which are tempting in a "we have older users" frame and all of which break the trust contract).

---

## §4. Revenue Economics (Realistic)

### 4.1 Affiliate commerce alone — small at every plausible scale

Assume:
- 5% of monthly active users click into Picks
- 20% of clickers purchase
- Average basket: $30
- Blended commission: 5%

| Active users | Monthly affiliate revenue |
|---|---|
| 1,000 | ~$15 |
| 5,000 | ~$75 |
| 10,000 | ~$150 |
| 50,000 | ~$750 |
| 100,000 | ~$1,500 |
| 500,000 | ~$7,500 |

At every plausible scale through v1.1, affiliate commerce is editorial table-stakes — it doesn't move the financial needle.

### 4.2 Where the actual revenue lives

The three partnership lines have an order-of-magnitude better unit economics:

**Telemedicine partnerships:** $20–$80 per qualified booking. At 100 bookings/month: **$2,000–$8,000/month.** Conversion is plausible because the trigger (doctor-share flow) is high-intent.

**Pharmacy refills (recurring):** $1–$5 per refill. At 500 monthly refills × $3 = **$1,500/month, recurring forever** (BP medication is lifetime). Compounds with retention.

**Insurance signups + trail:** $5–$25 per signup + 5–10% of monthly premium. At 50 signups/month + $1.00 average trail × growing base: **$500–$2,500 first month, growing.** Strategic moat: attached customers don't churn.

**Combined at modest scale (5,000 active users, 1% conversion to each partnership type):** ~$3,000–$10,000/month. That's meaningful.

### 4.3 The frame for the founder

> **Picks is the brand surface that makes partnerships look editorial. The partnerships are the revenue.**
>
> Don't optimise Picks for revenue — optimise it for trust. Then the partnerships work because the user already trusts Leiko's recommendations.

---

## §5. Product Surface — "Picks"

### 5.1 Where it lives

**v1.0:** Settings → Picks. Reachable but not prominent. A single ListRow in the Settings hierarchy.

**v1.1:** If engagement justifies, promote to a bottom-tab on the self-buyer mode or a SharedHeader entry on caregiver mode. Decision gate: ≥10% MAU visit Picks at least once per month.

### 5.2 The Picks screen

**Layout (design feeds D12):**
- Header: *"Picks"* in display face. Subtitle in body: *"A small, hand-chosen list."*
- 8–15 items, vertically scrolling, generous spacing
- Each item: 240×180 image · 1-line title · 2–3 sentence editorial blurb · "View" CTA

**Item schema:**
```yaml
id: pick-001
title: "A second cuff for cross-checking"
category: "BP monitoring"
region: [US, UK]
vendor: "Withings"
affiliate_url: "https://withings.com/products/bpm-core?ref=leiko"
image: "withings-bpm-core.jpg"
blurb: |
  When the watch feels too good to be true, a clinical cuff confirms.
  We like the BPM Core for its quiet build and the way the readings
  arrive in your app without fuss. Not a replacement for the watch —
  a companion.
active_from: 2026-06-01
active_until: 2026-12-31
clinical_review_required: false
```

**Interaction:**
- Tap "View" → external browser opens vendor URL (with affiliate UTM params)
- Analytics event: `pick_clicked { item_id, region, source }`
- No in-app purchase, no in-app browser at v1.0 (that's v1.2 if engagement justifies)

### 5.3 Editorial discipline

- Maximum 15 items active at any time. Quality over quantity.
- Items rotate quarterly. Stale items demote off the list.
- Every blurb passes voice-lint (the same lint that gates Learn cards and AI templates).
- Every blurb is reviewed by founder before going live. No automation on the editorial side.

### 5.4 Region routing

- User's `country_code` (set during onboarding) determines which Picks set they see.
- Items carry a `region: [...]` array. Multi-region items are valid but rare.
- US/UK and Nigeria run different curated lists at v1.0. France/East Africa expansion in v1.2.

### 5.5 Telemedicine, pharmacy, insurance entry points

These don't live *inside* Picks. They live at the trigger point:

- **Telemedicine entry:** the "Share with doctor" flow on Trends. Inline option below the PDF preview: *"Don't have a doctor on file? Find a hypertension specialist."*
- **Pharmacy refill entry:** appears in the per-prescription detail screen (post-v1.0 medication-tracking feature). *"Refill at [pharmacy]"* CTA.
- **Insurance entry:** Settings → Family → "Cover [parent_name]'s healthcare" — an explicit caregiver action.

Each entry point is opt-in, contextual, and never interruptive. Nothing pushes itself.

---

## §6. Phased Rollout

### 6.1 Phase 0 — Foundation (post-launch sprint, ~1 work-week)

**Sprint label (TBD):** "Picks Foundation"

Deliverables:
- `pick_items` table in Supabase (with region, category, blurb, affiliate_url, vendor, image_url, active dates, clinical_review_required flag)
- `apps/mobile/src/screens/PicksScreen.tsx`
- `apps/mobile/src/components/PickRow.tsx`
- Settings entry → Picks
- Analytics event `pick_clicked`
- Region routing per user `country_code`
- Hand-edited JSON seed for v1.0 (8–15 items)
- Voice-lint runs on every blurb at CI time

Acceptance:
- Picks renders 8–15 items per region
- Tapping an item opens external browser with affiliate URL
- Click event fires
- Voice-lint passes on every blurb
- Region routing verified for both NG and US/UK test accounts

### 6.2 Phase 1 — Telemedicine + pharmacy partnerships (post-Phase 0)

**Sprint label (TBD):** "Telemed & Refill Partnerships"

Deliverables:
- Telemedicine entry on doctor-share flow
- Manual prescription schedule entry (medication + dose + frequency, opt-in)
- Pharmacy refill reminder + CTA
- Partnership integrations: 1 Nigeria pharmacy + 1 US/UK telemedicine partner at minimum
- Revenue dashboard surface (founder-facing, not user-facing)

External dependencies:
- Signed partnership agreements with at least one pharmacy and one telemedicine provider
- Each partner's affiliate / referral API documented

### 6.3 Phase 2 — Insurance + remittance + cultural shopping (v1.2)

Deliverables:
- Health micro-insurance activation flow (Nigeria-first)
- Remittance partnership integration
- Cultural shopping subsections under Learn articles (NG-first)
- Direct brand store evaluation (decision gate: Picks engagement metrics)

---

## §7. Implementation Sketch

### 7.1 Data model (Supabase)

```sql
create table pick_items (
  id text primary key,
  title text not null,
  category text not null,
  region text[] not null check (cardinality(region) > 0),
  vendor text not null,
  affiliate_url text not null,
  image_url text,
  blurb text not null,
  active_from timestamptz not null default now(),
  active_until timestamptz,
  clinical_review_required boolean not null default false,
  clinical_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pick_items_active_region on pick_items (region, active_from, active_until);

-- RLS: read-only for authenticated users; write only via service-role
alter table pick_items enable row level security;
create policy "anyone can read active picks" on pick_items
  for select using (
    auth.role() = 'authenticated'
    and active_from <= now()
    and (active_until is null or active_until > now())
  );
```

### 7.2 Click events (PostHog)

```typescript
analytics.track('pick_clicked', {
  item_id: pick.id,
  region: user.country_code,
  source: 'picks_screen',  // or 'home_pick_of_month' for the v1.1 surfacing
  vendor: pick.vendor,
  category: pick.category,
});
```

No PHI. No reading values. No vital states.

### 7.3 Voice-lint extension

The same voice-lint engine that gates Learn cards and AI templates extends to Pick blurbs. The CI step adds `pick_items.blurb` to its scan list. Forbidden vocabulary blocks publish.

### 7.4 Region routing

```typescript
function getPicksForUser(user: User, picks: PickItem[]): PickItem[] {
  return picks.filter(p => p.region.includes(user.country_code));
}
```

Trivial. The complexity is in the editorial curation, not the routing.

### 7.5 Vendor reconciliation

Affiliate vendors track conversions on their side. Leiko receives:
- Aggregate click counts (from PostHog)
- Aggregate conversion counts (from vendor dashboard, monthly reconciliation)
- Payouts via standard ACH or wire from each vendor

No vendor-side scripts run inside the Leiko app. No vendor cookies, no tracking pixels. The user's privacy posture is identical with and without Picks.

---

## §8. Privacy, Trust, Brand Risk

### 8.1 What the user sees and consents to

- Picks is opt-in by visit (the user actively navigates to Settings → Picks)
- Tapping an item opens an external browser — clear context shift
- No notifications about Picks at v1.0
- Privacy policy adds a section explaining: *"When you tap a Pick, you leave the Leiko app. The vendor's site has its own privacy practices."*

### 8.2 Trust risks and how we mitigate them

| Risk | Mitigation |
|---|---|
| User feels Leiko is "selling them stuff" | Opt-in entry point, editorial voice, no notifications, no behavioural targeting |
| A Pick recommendation backfires (bad product, bad vendor) | Founder reviews every item; post-purchase follow-up survey for top 5 items quarterly |
| Affiliate disclosure compliance (FTC US, ASA UK, NAFDAC NG) | Every Picks screen carries a footer: *"Some links earn Leiko a commission. We only recommend things we'd buy ourselves."* |
| User tracking fears | No third-party scripts. Click event is internal PostHog. Vendor takes over once user leaves the app. |
| Cross-cultural misfit | NG and US/UK Picks lists are separate, not auto-translated. Each region's picks are separately curated. |
| Picks recommendations look like medical advice | Categories are explicitly non-clinical (kitchen, books, home safety). Telemed/pharmacy/insurance live OUTSIDE Picks at contextual entry points. |

### 8.3 Reputation surface

If a Pick goes wrong (vendor ships counterfeits, service is bad), Leiko bears reputation cost even though we don't fulfil. Mitigation:

- Vendor due diligence before listing (read reviews, test the actual purchase flow ourselves)
- Active monitoring of `pick_purchase_complaint` support tickets (we add a category)
- Quarterly purge of underperforming Picks (low click-through, low conversion, bad reviews)

### 8.4 Regulatory disclosures

- **United States:** FTC requires "material connection" disclosures in proximity to affiliate links. Our screen footer satisfies this.
- **United Kingdom:** ASA CAP Code requires similar; same footer satisfies.
- **Nigeria:** NAFDAC governs medical claims; advertising laws are evolving but require honest representation. Our editorial-tone blurbs are conservatively safe.
- **Insurance + telemedicine partnerships** carry additional regulatory requirements per jurisdiction — partnership contracts must specify which party handles user-facing licensing disclosures.

---

## §9. Open Items & Validation Checklist

### 9.1 Founder validation required before Picks Foundation sprint opens

- [ ] Approve "Picks" as the section name (alternatives considered: "Worth a try," "In your kitchen," "Recommended")
- [ ] Approve Settings → Picks as the v1.0 entry point (vs bottom-tab)
- [ ] Approve the four v1.0 categories: BP monitoring, low-sodium kitchen, elder home safety, books/podcasts
- [ ] Approve the FTC/ASA-style footer disclosure copy
- [ ] Decide: own editorial curation, or hire a writer? (Writer cost: ~$500–$1,500 for the v1.0 set + quarterly refresh)
- [ ] Decide: amazon associates account holder — LawOne Cloud LLC or personal?
- [ ] Decide: Jumia / Konga affiliate account — same question

### 9.2 Founder validation required before Phase 1

- [ ] Telemedicine partner shortlist signed (target: 1 NG + 1 US/UK)
- [ ] Pharmacy refill partner signed (target: 1 NG)
- [ ] Manual prescription schedule UI approved (medication name, dose, frequency, opt-in)
- [ ] Revenue dashboard requirements (founder-facing) sketched

### 9.3 Founder validation required before Phase 2

- [ ] Insurance partner signed (target: 1 NG micro-insurer)
- [ ] Remittance partner signed
- [ ] Cultural shopping NG vendor signed (target: 1)
- [ ] Direct brand store evaluation: ship Leiko-branded merch (cuff, accessories) via Shopify?

### 9.4 Open technical questions

| # | Question | Default if unanswered |
|---|---|---|
| Q-D15-1 | Image hosting for Pick images? | Supabase Storage bucket `pick-images`, public read |
| Q-D15-2 | Affiliate URL handling — track clicks before redirect, or pass through? | Pass through (browser fires a `pick_clicked` event, then redirects). No URL shortener. |
| Q-D15-3 | Do clinical Picks (e.g., second BP cuff) require clinical advisor review? | Yes — `clinical_review_required: true` for cuffs and any BP-adjacent device. Defaults to false for kitchen/books/home-safety. |
| Q-D15-4 | Should Picks support multi-language blurbs at v1.0? | No — English only at v1.0, matching Learn cards. Yoruba/Igbo/Hausa in v1.1 alongside Learn localisation. |
| Q-D15-5 | Affiliate revenue accounting — separate Stripe/bank account? | Founder ops decision; default: same LawOne account, separate revenue line in books |
| Q-D15-6 | Do we offer "I bought this" feedback in-app to surface review-style content? | No at v1.0. Adds review surface complexity, potential moderation surface. Revisit v1.2. |

### 9.5 Open partnership questions

- Which telemedicine provider has the cleanest API and the best-aligned voice?
- Which Nigerian pharmacy has nationwide delivery and a usable affiliate program?
- Is there a Reliance/Tangerine product manager interested in a Leiko-distributed micro-policy?
- Does Sendwave / Lemfi want to co-promote with a healthcare-focused brand?
- Withings — direct partnership for cross-cuff bundle? (Likely yes — they sell BPM Core; their app is similar in voice.)

---

## §10. Sign-Off

This document represents the v0.1 affiliate strategy for Leiko. Sign-off promotes to v1.0 and unlocks the Picks Foundation sprint at the next available planning slot (post-launch, post-Sprint 17).

| Role | Name | Sign-off |
|---|---|---|
| Founder / Product Owner | Law (LawOne Cloud LLC) | Pending |
| Brand author | This document | 2026-05-09 |
| Engineering | Implements against this contract once sprint opens | Implementation gate: post-launch |

---

*End of D15 — Affiliate & Editorial Commerce Strategy v0.1.*

*Next document — none in this series. D15 is a strategic side-track, not part of the D11–D14 launch quartet. Implementation triggers the Picks Foundation sprint card, drafted at the same time as the post-launch backlog review.*
