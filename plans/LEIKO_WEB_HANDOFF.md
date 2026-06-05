# Leiko Web Handoff — backend/app session → `farmerscreed/leiko` (websites)

> **Who this is for:** a Claude Code session working in **`farmerscreed/leiko`** (the
> repo holding `leiko.health` + `leiko.app`). Written by a session in
> **`farmerscreed/leiko-app`** (the mobile app + Supabase backend).
>
> **⚠️ READ THIS FIRST — you cannot see the `leiko-app` repo.** This document is
> **self-contained**: everything you need to act is inlined below. Where you see a
> path like `leiko-app:docs/…`, that is **provenance only** — a note of where the fact
> came from, *not* a file you can open. If you need the full original of a named file,
> ask the founder to paste it. Do not assume you can read it.
>
> **How to use it:** this is a *briefing + contract + roadmap*, **not** a build order
> for a blank slate. The websites already exist and some work is already done. Your
> **first job is a gap analysis** (Section 8): inventory what's there, confirm it
> against this contract, keep what's already correct, and only change what's actually
> wrong. Build against the gaps.

---

## 1. The picture — two products, two domains, one company

| | What it is | Domain | Regulatory footing |
|---|---|---|---|
| **The watch** | A wristwatch with a *real inflating BP cuff* (Urion U16 family). Hardware. | **leiko.health** — sells/reserves the watch | FDA-listed **Class II** device; clearance belongs to the **manufacturer (Urion)**. See §5. |
| **The app** | Leiko — a companion app that displays/logs readings from the watch and keeps families connected. | **leiko.app** — app showcase + legal/technical anchor | Positioned as a **non-device companion**, *not* an independently-cleared medical device. |

- **Legal entity / publisher:** **LawOne Cloud LLC** (the Google Play *Organization* account holder + D-U-N-S registrant). "Leiko" is the **brand**; LawOne Cloud LLC is the company. Urion is the **device manufacturer** (separate company).
- **Go-to-market now:** cold ads → **leiko.health/reserve** → **$50 refundable deposit** (tiered pricing, §4). The app needn't be in users' hands for the reservation funnel to run.
- **Status:** Google Play **identity verification pending** (async; blocks nothing on the web side). App is at **near-final 1.0**.

**Why the two-site split is right (not cosmetic):** *regulatory containment.* `leiko.health` sells the regulated **hardware** and may reference the **device's** real FDA status. `leiko.app` is the **non-device app's** home and stays in the no-medical-claims voice (§5). Keep them linked but distinct.

---

## 2. Identity & integration contract (NON-NEGOTIABLE — the app already ships these)

If the website doesn't match these, **deep links and install flows break**. The site conforms to the app, not the reverse.

| Thing | Value |
|---|---|
| Android package | `com.leiko.app` |
| iOS bundle id | `com.leiko.app` |
| Custom URL scheme | `leiko://` |
| App Link / Universal Link hosts | **`leiko.app`** and **`pair.leiko.app`** (Android `autoVerify`, iOS Associated Domains) |
| App-store marketing URL | `https://leiko.app` |
| App-store support URL | `https://leiko.app/support` (see §9 decision — redirects to leiko.health/support) |

### `.well-known` files the website MUST host on `leiko.app`

- `https://leiko.app/.well-known/assetlinks.json`
- `https://leiko.app/.well-known/apple-app-site-association`
- If `pair.leiko.app` must verify App Links, it needs its **own** copies on that subdomain.

**`assetlinks.json` — host exactly this** (the upload-key fingerprint is real; the Play one is filled in after the first AAB upload — see §9):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.leiko.app",
      "sha256_cert_fingerprints": [
        "REPLACE_WITH_PLAY_APP_SIGNING_SHA256",
        "84:13:9B:AF:8B:C0:4D:B4:25:91:F4:F3:2D:B2:81:F2:D0:2F:4C:74:04:F5:D5:21:22:1B:B6:72:FE:22:27:28"
      ]
    }
  }
]
```

**`apple-app-site-association` — host JSON (no extension, `Content-Type: application/json`), replacing `TEAMID` with the Apple Developer Team ID:**

```json
{
  "applinks": {
    "apps": [],
    "details": [
      { "appID": "TEAMID.com.leiko.app", "paths": ["/join", "/reading/*", "/vital/*", "/support"] }
    ]
  }
}
```
*(Confirm the exact path list with the founder if needed; it must cover the deep-link paths in §3.)*

### Verify after hosting
- Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://leiko.app&relation=delegate_permission/common.handle_all_urls`
- iOS: `swcutil dl -d leiko.app` from a Mac.

---

## 3. The exact URL contract (paths the app already points users to)

Each URL is referenced **in shipped app code**. The website must serve a sensible page at each — including deep-link paths, because a user *without* the app lands on the web URL and needs a graceful fallback ("Get Leiko" + context). **Never display health values to the public on these pages.**

| URL | Purpose | Page must do |
|---|---|---|
| `https://leiko.app/join` | Family-circle invite | With app → deep-links in. Without → "Get Leiko + how to accept the invite." |
| `https://leiko.app/reading/{id}` | Anomaly/notification deep link | Deep-links to Reading Detail in-app. Web fallback: "open in app / get the app." |
| `https://leiko.app/vital/{kind}` | Notification deep link | Deep-links to Vital Detail. Same fallback. |
| `https://leiko.app/support` | App-store support URL | Support page (redirect → leiko.health/support, §9). |
| `https://leiko.app` | App-store marketing URL | App marketing home. |
| `https://leiko.health/privacy` | App Settings → legal | **Privacy policy** (content in §6). |
| `https://leiko.health/terms` | App Settings → legal | **Terms** (incl. reservation/deposit terms). |
| `https://leiko.health/support` | App Settings → support | **Canonical support page** (§9). |
| `https://pair.leiko.app/` and `…/family-…` | Watch-pairing handoff | Pairing flow entry (e.g. opening pairing on a parent's phone). |

In-app `leiko://` deep-link routes (so web fallbacks mirror them): `home`, `weekly`, `reading/{id}`, `vital/{kind}`, `settings/devices`, `family`, `settings/subscription`.

---

## 4. The reserve funnel + analytics rules

**Funnel:** `leiko.health/reserve` captures a **$50 refundable deposit** with tiered pricing. Two variants: **Leiko** (base) and **Leiko Pro** (premium band, priority support). Pricing snapshot (from the reserve brief, dated 2026-06-02 — **confirm current numbers with the founder before publishing**):

| Tier | Slots | Leiko price | Leiko Pro | Deposit | Balance at ship |
|---|---|---|---|---|---|
| Founders' Edition | first 30 | $149 | $199 | $50 | $99 / $149 |
| Early Reservation | next 1,000 | $179 | $229 | $50 | $129 / $179 |
| Reservation | thereafter | $200 | $250 | $50 | $150 / $200 |

Same $50 deposit across tiers; only the balance-at-ship varies. The funnel must handle: deposit capture, refund logic, tier/slot tracking, confirmation email, and "balance at ship" billing.

**Analytics = event names ONLY, never health/personal values** (hard project rule; tool is PostHog). For the funnel, emit names like `reserve_view`, `reserve_started`, `deposit_paid` — never a reading value, email, or other personal datum in a property.

**Closed-test funnel may be obsolete.** There exists a prior plan (`leiko-app:plans/beta-landing-funnel.md`) to recruit Play *closed testers*, which only matters because *individual* Play accounts created after Nov 2023 must run a 20-tester / 14-day closed test. **Organization accounts are generally exempt.** Confirm in Play Console (§9); if exempt, do **not** build a tester-recruitment funnel — point `leiko.app` at the production install path instead.

---

## 5. Claims & voice law (governs EVERY word on both sites + all ad creative)

The app enforces this in CI; the websites and ads are **not** exempt.

### 5a. The watch's real FDA status (confirmed from the FDA Establishment Registration & Device Listing database)

- **Manufacturer:** SHENZHEN URION TECHNOLOGY CO., LTD. (China).
- **FDA Establishment Registration #:** `3011654863` (current reg year 2025). Owner/Operator # `10049394`.
- **Device listed:** "Wrist Watch Electronic Blood Pressure Monitor" — models **U16H, U16L, U16P, U16W** (and U19R/S/T).
- **Classification:** *System, Measurement, Blood-Pressure, Non-Invasive* · **Product Code DXN** · **Device Class II** · Cardiovascular.
- **510(k) Premarket Submission #:** **K141683**.

**You MAY say (accurate, defensible):**
- "An **FDA-listed Class II** blood-pressure device" / "built on the FDA-cleared Urion U16 platform."
- "**510(k)-cleared** (K141683)" — *once K141683 is verified* (see cautions).
- Mechanism claims: "a **real inflating cuff**," "a real number," "the same *kind* of measurement as the cuff at your doctor's office" (it's oscillometric, non-invasive — the same product class as clinical arm cuffs). The existing hero **"A real cuff. A real number."** is fine.

**You must NOT (hard rules):**
- ❌ **"FDA approved."** Class II devices are **cleared** (510(k)), never "approved" (approval = Class III PMA). "Approved" here is false and an FTC/ad-policy violation.
- ❌ Leading with just the **establishment registration number** as if it's a credential — registration ≠ clearance. Use "Class II, 510(k)-cleared (K141683)" as the credential instead.
- ❌ Implying the **app** is FDA-cleared. The clearance is the **watch's** (Urion's). The app stays a non-device companion. Never let FDA language bleed onto the app.
- ❌ Implying **LawOne Cloud LLC** holds an FDA clearance. It's the brand/reseller; Urion holds the registration/clearance. Truthful framing: "built on the FDA-cleared Urion device."
- **Verify K141683** in the FDA 510(k) database (accessdata.fda.gov → 510(k)) for holder + scope before "510(k)-cleared" goes in paid ads. The listing referencing it is strong evidence; confirm it covers these models. Ad platforms may ask for substantiation.

### 5b. Forbidden words/phrases (legal/regulatory risk — apply to ALL copy & ads)

- `diagnose / diagnosis / diagnostic`, `treat / treatment / cure`, `predict` / `prevent` (disease context), `medical advice`.
- Fear language: `silent killer`, `ticking time bomb`, `before it's too late`, `dangerous level`, `critical level`.
- Outcome promises: anything implying it *will* lower BP, prevent disease, or extend life.
- `continuous blood pressure monitoring` (BP is on-demand), `medical-grade SpO2` / `clinical SpO2` (SpO2 is wellness-only here).
- `replaces your doctor` → "supplement, never replace."
- **Do NOT reuse Urion's original marketing** — `AI Pulse Diagnosis`, `TCM diagnosis`, etc. are outside the cleared use and forbidden.
- `smartwatch` as the primary product noun → use "watch", "wristwatch", "the device", or just "Leiko."
- `patient` → "Mum" / "Dad" / "your parent" / "you". `loved one` → a specific relationship.

### 5c. Voice (every string)
Warm · Calm · Proactive · Dignified. Lead with the answer; plain language before clinical terms; "Talk to your doctor" (not "consult a healthcare provider"); sentence case; personal pronouns ("you", "your"); verb-object CTAs ("Pair watch", "Reserve yours"). No `!!`, no ALL CAPS, no fear, no urgency-in-onboarding.

> Ad platforms (Meta, Google) apply **extra scrutiny to BP/health-device ads** regardless of claims, and restrict health-condition targeting. Get copy clean *before* spending or risk disapprovals and account strikes.

---

## 6. Legal content (privacy / terms) — facts to base the pages on

`leiko.health/privacy` must match what the app actually does. Ground truth (from a literal read of the app source):

- **Collected:** email (sign-in/invites); optional display name; **health & fitness vitals** (BP, HR, SpO2, sleep, steps, active energy) from the Urion U16 watch; purchase history (RevenueCat + Google Play Billing); per-install device UUID; optional product-analytics events (no PHI); crash logs (PHI-scrubbed).
- **NOT collected:** location (a capped legacy BLE permission only, `maxSdkVersion=30`), microphone, camera, photos, contacts, calendar, messages.
- **Encryption:** in transit (HTTPS to Supabase; BLE link is local-only) and at rest on device.
- **Deletion:** Settings → Privacy and data → Delete my account.
- **Third parties:** Supabase (backend, hosted on Hetzner), RevenueCat, Sentry, PostHog, Expo Push, Google Play Billing.
- **Posture:** consumer/DTC, **not** a HIPAA covered entity; "patient" data is **not** collected.

`leiko.health/terms` should also cover the reservation/deposit terms (refundability, balance-at-ship, tier conditions) — confirm with the founder.

*(If you need the verbatim Play Data Safety mapping, ask the founder to paste `leiko-app:docs/release/play-console-data-safety.md`.)*

---

## 7. Launch roadmap (sequence matters)

**Phase 0 — Foundations (proceed now; Play verification not required):**
1. Gap analysis of both sites (§8).
2. Claims/voice clean-up of all live copy + ad creative (§5) — *gates safe ad spend*.
3. Legal pages live + consistent: `leiko.health/privacy`, `/terms`, `/support` (§6).
4. Reserve funnel verified end-to-end (deposit, refund, tiers, confirmation, analytics-events-only).
5. `leiko.app`: app showcase + `/join`, `/reading/{id}`, `/vital/{kind}`, `/support` pages + host the two `.well-known` files (placeholders noted until fillable).

**Phase 1 — Play publish (when verification clears):**
6. First AAB upload → grab **Play App Signing SHA-256** → update `leiko.app/.well-known/assetlinks.json` → re-verify.
7. Org account likely skips closed testing (§9) → publish. Wire real Play listing URL (`store/apps/details?id=com.leiko.app`) into `leiko.app`.

**Phase 2 — Demand on (when 0–1 solid):**
8. Ads → `leiko.health/reserve`. Watch ad-account health + funnel conversion.

---

## 8. YOUR FIRST TASK — gap analysis (confirm what's done; change only what's wrong)

The sites already exist and some work is done. Posture: **keep what's already correct; only recommend/make a change when something is actually wrong.** Method:

1. **Inventory** every page, route, and asset in the repo for *both* sites; note stack, hosting, deploy method.
2. **Confirm against this contract** — mark ✅ correct / ⚠️ present-but-wrong / ❌ missing:
   - [ ] `leiko.app/.well-known/assetlinks.json` + `apple-app-site-association` hosted (with placeholder status, §2)
   - [ ] `pair.leiko.app` App-Link assets (if it must verify)
   - [ ] Every §3 URL resolves to a sensible page (graceful no-app fallback; no public health values)
   - [ ] `leiko.health/privacy`, `/terms`, `/support` exist + match §6
   - [ ] `leiko.app/support` redirects to `leiko.health/support` (§9)
   - [ ] `leiko.health/reserve` funnel: deposit, tiers, refund, confirmation, analytics-events-only
   - [ ] All copy + ad creative passes §5 (esp. FDA "cleared not approved", no forbidden verbs)
   - [ ] `.health` ↔ `.app` cross-links present and correct
   - [ ] Analytics emits event names only, no PHI
3. **Severity-rank** gaps (launch-blocking vs. nice-to-have).
4. **Execute** against the gaps. For anything already shipped and acceptable, confirm and move on — don't rebuild it.

---

## 9. Decisions (already made — go with these) + externally-gated items

**Decisions — resolved; implement as stated (these follow what's already shipped):**
- **D1 — Legal/support page ownership → `leiko.health`.** The app already links privacy/terms/support to `leiko.health`. Keep that. The only mismatch is the app-store `supportUrl = leiko.app/support`; resolve it **website-side only** by making `leiko.app/support` **301-redirect to `leiko.health/support`** (or serve identical content). **No app change needed.** Net: `leiko.health` owns privacy/terms/support; `leiko.app` owns app showcase + `/join` + deep-link fallbacks + `.well-known` + a support redirect.
- **D2 — FDA wording → use "FDA-listed Class II, 510(k)-cleared (K141683)", never "approved".** Per §5a. Treat K141683 verification (below) as the one open check.

**Externally-gated — not blockers for Phase 0, resolve when available:**
- **K141683 verification** — confirm holder/scope in the FDA 510(k) database before "510(k)-cleared" runs in paid ads.
- **Play App Signing SHA-256** for `assetlinks.json` — exists only *after* the first AAB upload.
- **Apple Team ID** for `apple-app-site-association`.
- **Org-account closed-test exemption** — 5-min Play Console check; decides whether `leiko.app` needs any tester funnel (§4).
- **App 1.0 freeze** — two fixes (sleep score; doctor-PDF file share + preview) still landing on the app side; don't announce the app as "shipped" until frozen + published. *Doesn't block web work.*
- **Payment infrastructure** for the deposit (Stripe/Paystack + refund logic) — confirm it's actually live.

---

## 10. Provenance map (these files live in `leiko-app` — you CANNOT open them)

The essentials above are inlined, so you shouldn't need these. If you want a verbatim original, **ask the founder to paste it**:

| Topic | File in `farmerscreed/leiko-app` (provenance only) |
|---|---|
| Full voice & claims canon | `docs/05-voice-and-claims.md` |
| Play Data Safety mapping | `docs/release/play-console-data-safety.md` |
| Deep-link routes + App-Link hosting | `docs/11-push-notifications.md` §3 |
| App-Link asset templates | `apps/mobile/well-known/` |
| App identity (package/scheme/domains/URLs) | `apps/mobile/app.json` |
| Reserve page spec (watch) | `docs/marketing/reserve-page-brief.md` |
| Ads playbook | `docs/marketing/leiko-ads-playbook.md` |
| Operating manual / conventions | `CLAUDE.md` |

> When a brief and a *shipped* app behavior disagree, the app wins — but you can't see the app, so when in doubt, **ask the founder** rather than guessing.

---

*Self-contained handoff from `farmerscreed/leiko-app`. FDA facts confirmed against the FDA Establishment Registration & Device Listing database (Shenzhen Urion, reg 3011654863, product code DXN, Class II, 510(k) K141683). Decisions in §9 follow what the app already ships; change only what's actually wrong.*
