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
> **⚠️ CONFIDENTIALITY — read §5a before writing any FDA/manufacturer copy.** The
> device's manufacturer identity and its specific FDA numbers are a **trade secret**.
> They are intentionally absent from this document and must never appear on the sites.
>
> **How to use it:** this is a *briefing + contract + roadmap*, **not** a build order
> for a blank slate. The websites already exist and some work is already done. Your
> **first job is a gap analysis** (Section 8): inventory what's there, confirm it
> against this contract, keep what's already correct, and only change what's wrong.

---

## 1. The picture — two products, two domains, one company

| | What it is | Domain | Regulatory footing |
|---|---|---|---|
| **The watch** | A wristwatch with a *real inflating BP cuff*. Hardware (OEM-built). | **leiko.health** — sells/reserves the watch | FDA-listed **Class II** device; clearance held by the **device manufacturer** (identity **confidential** — §5a). |
| **The app** | Leiko — a companion app that displays/logs readings from the watch and keeps families connected. | **leiko.app** — app showcase + legal/technical anchor | Positioned as a **non-device companion**, *not* an independently-cleared medical device. |

- **Legal entity / publisher:** **LawOne Cloud LLC** (the Google Play *Organization* account holder + D-U-N-S registrant). "Leiko" is the **brand**; LawOne Cloud LLC is the company.
- **The manufacturer:** the watch is produced under a **confidential production contract**. The manufacturer's name is a **trade secret — never name them anywhere** (§5a).
- **Go-to-market now:** cold ads → **leiko.health/reserve** → **$50 refundable deposit** (tiered pricing, §4).
- **Status:** Google Play **identity verification pending** (async; blocks nothing on the web side). App is at **near-final 1.0**.

**Why the two-site split is right (not cosmetic):** *regulatory containment.* `leiko.health` sells the regulated **hardware** and may reference the **device's** FDA *status* (never its numbers/maker). `leiko.app` is the **non-device app's** home and stays in the no-medical-claims voice (§5). Keep them linked but distinct.

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
| App-store support URL | `https://leiko.app/support` (redirects to leiko.health/support — §9) |

### `.well-known` files the website MUST host on `leiko.app`

- `https://leiko.app/.well-known/assetlinks.json`
- `https://leiko.app/.well-known/apple-app-site-association`
- If `pair.leiko.app` must verify App Links, it needs its **own** copies on that subdomain.

**`assetlinks.json` — host exactly this** (upload-key fingerprint is real; the Play one is filled after the first AAB upload — §9):

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

### Verify after hosting
- Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://leiko.app&relation=delegate_permission/common.handle_all_urls`
- iOS: `swcutil dl -d leiko.app` from a Mac.

---

## 3. The exact URL contract (paths the app already points users to)

Each URL is referenced **in shipped app code**. The website must serve a sensible page at each — including deep-link paths, because a user *without* the app lands on the web URL and needs a graceful fallback. **Never display health values to the public on these pages.**

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
| `https://pair.leiko.app/` and `…/family-…` | Watch-pairing handoff | Pairing flow entry. |

In-app `leiko://` deep-link routes (so web fallbacks mirror them): `home`, `weekly`, `reading/{id}`, `vital/{kind}`, `settings/devices`, `family`, `settings/subscription`.

---

## 4. The reserve funnel + analytics rules

**Funnel:** `leiko.health/reserve` captures a **$50 refundable deposit** with tiered pricing. Two variants: **Leiko** (base) and **Leiko Pro** (premium). Pricing snapshot (dated 2026-06-02 — **confirm current numbers with the founder before publishing**):

| Tier | Slots | Leiko | Leiko Pro | Deposit | Balance at ship |
|---|---|---|---|---|---|
| Founders' Edition | first 30 | $149 | $199 | $50 | $99 / $149 |
| Early Reservation | next 1,000 | $179 | $229 | $50 | $129 / $179 |
| Reservation | thereafter | $200 | $250 | $50 | $150 / $200 |

Funnel must handle: deposit capture, refund logic, tier/slot tracking, confirmation email, balance-at-ship billing.

**Analytics = event names ONLY, never health/personal values** (hard rule; PostHog). Emit names like `reserve_view`, `reserve_started`, `deposit_paid` — never a reading value, email, or other personal datum in a property.

**Closed-test funnel may be obsolete.** A prior plan recruited Play *closed testers* (needed only because *individual* Play accounts created after Nov 2023 must run a 20-tester/14-day closed test). **Organization accounts are generally exempt.** Confirm in Play Console (§9); if exempt, point `leiko.app` at the production install path instead.

---

## 5. Claims & voice law (governs EVERY word on both sites + all ad creative)

### 5a. The watch's FDA status — and the CONFIDENTIALITY RULE (read before any FDA copy)

The watch is an **FDA-listed Class II** non-invasive blood-pressure measurement device, **cleared through the FDA 510(k) process**. That status is real and may be referenced — *generically*.

> 🔒 **HARD CONFIDENTIALITY RULE.** The **manufacturer's name** and the **specific FDA
> numbers** (establishment registration number, owner/operator number, 510(k) number)
> are a **trade secret**. They are deliberately **not** in this document. They must
> **NEVER** appear on the website, in ads, in the app, in metadata, or in any public
> artifact — because **each one publicly resolves to the manufacturer's identity** in
> the FDA database, exposing the founder's supplier. Make the FDA claim **generically**.
> If an ad platform or regulator demands substantiation, the **founder supplies the
> numbers privately**, never on the public record.

**You MAY say (accurate + safe):**
- "An **FDA-listed Class II** blood-pressure device" / "**cleared through the FDA 510(k) process**."
- Mechanism claims: "a **real inflating cuff**," "a real number," "the same *kind* of measurement as the cuff at your doctor's office" (oscillometric, non-invasive). The existing hero **"A real cuff. A real number."** is fine.

**You must NOT:**
- ❌ Publish **any FDA number** or **the manufacturer's name** — anywhere (the whole point of this rule).
- ❌ **"FDA approved."** Class II is **cleared** (510(k)), never "approved" (approval = Class III PMA). False + an FTC/ad-policy violation.
- ❌ Imply the **app** is FDA-cleared. The clearance is the **watch's**; the app stays a non-device companion.
- ❌ Imply **LawOne Cloud LLC** holds the clearance. Frame it as the device's status, not the company's.
- ❌ Catalog/model specifics that narrow an FDA search — claim the **capability** ("measures BP with a real cuff"), not a registration.

> **Honest limit (for the founder, not the site):** for a US-sold FDA device the
> manufacturer's registration is inherently public and findable by product category.
> Omitting the numbers/name raises the bar a lot, but isn't airtight. The durable
> protection — own-label/importer registration so *your* entity is the visible record,
> plus NDAs — is a separate regulatory/legal track (see chat notes).

### 5b. Forbidden words/phrases (legal/regulatory risk — ALL copy & ads)

- `diagnose / diagnosis / diagnostic`, `treat / treatment / cure`, `predict` / `prevent` (disease context), `medical advice`.
- Fear language: `silent killer`, `ticking time bomb`, `before it's too late`, `dangerous level`, `critical level`.
- Outcome promises (will lower BP / prevent disease / live longer).
- `continuous blood pressure monitoring` (BP is on-demand), `medical-grade SpO2` / `clinical SpO2` (SpO2 is wellness-only here).
- `replaces your doctor` → "supplement, never replace."
- **Do NOT reuse the manufacturer's original marketing** — e.g. `AI Pulse Diagnosis`, `TCM diagnosis` — outside the cleared use and forbidden.
- `smartwatch` as primary product noun → "watch", "wristwatch", "the device", or "Leiko."
- `patient` → "Mum" / "Dad" / "your parent" / "you". `loved one` → a specific relationship.

### 5c. Voice (every string)
Warm · Calm · Proactive · Dignified. Lead with the answer; plain language before clinical terms; "Talk to your doctor"; sentence case; personal pronouns; verb-object CTAs ("Pair watch", "Reserve yours"). No `!!`, no ALL CAPS, no fear, no urgency-in-onboarding.

> Ad platforms apply **extra scrutiny to BP/health-device ads** and restrict health-condition targeting. Get copy clean *before* spending.

---

## 6. Legal content (privacy / terms) — facts to base the pages on

`leiko.health/privacy` must match what the app actually does:

- **Collected:** email (sign-in/invites); optional display name; **health & fitness vitals** (BP, HR, SpO2, sleep, steps, active energy) from the **Leiko watch**; purchase history (RevenueCat + Google Play Billing); per-install device UUID; optional product-analytics events (no PHI); crash logs (PHI-scrubbed).
- **NOT collected:** location (a capped legacy BLE permission only, `maxSdkVersion=30`), microphone, camera, photos, contacts, calendar, messages.
- **Encryption:** in transit (HTTPS to Supabase; BLE link is local-only) and at rest on device.
- **Deletion:** Settings → Privacy and data → Delete my account.
- **Third parties:** Supabase (backend, on Hetzner), RevenueCat, Sentry, PostHog, Expo Push, Google Play Billing.
- **Posture:** consumer/DTC, **not** a HIPAA covered entity; "patient" data is **not** collected.

`leiko.health/terms` should also cover reservation/deposit terms (refundability, balance-at-ship, tier conditions) — confirm with the founder.

---

## 7. Launch roadmap (sequence matters)

**Phase 0 — Foundations (now; Play verification not required):**
1. Gap analysis of both sites (§8).
2. Claims/voice clean-up of all live copy + ad creative (§5) — *gates safe ad spend*; includes scrubbing any manufacturer name / FDA numbers already on the sites.
3. Legal pages live + consistent: `leiko.health/privacy`, `/terms`, `/support` (§6).
4. Reserve funnel verified end-to-end (deposit, refund, tiers, confirmation, analytics-events-only).
5. `leiko.app`: app showcase + `/join`, `/reading/{id}`, `/vital/{kind}`, `/support` + host the two `.well-known` files (placeholders noted until fillable).

**Phase 1 — Play publish (when verification clears):**
6. First AAB upload → grab **Play App Signing SHA-256** → update `assetlinks.json` → re-verify.
7. Org account likely skips closed testing (§9) → publish. Wire real Play listing URL (`store/apps/details?id=com.leiko.app`) into `leiko.app`.

**Phase 2 — Demand on:**
8. Ads → `leiko.health/reserve`. Watch ad-account health + funnel conversion.

---

## 8. YOUR FIRST TASK — gap analysis (confirm what's done; change only what's wrong)

Posture: **keep what's already correct; change only what's actually wrong.** Method:

1. **Inventory** every page, route, and asset in both sites; note stack, hosting, deploy.
2. **Confirm against this contract** — ✅ correct / ⚠️ present-but-wrong / ❌ missing:
   - [ ] `leiko.app/.well-known/assetlinks.json` + `apple-app-site-association` hosted (placeholder status, §2)
   - [ ] `pair.leiko.app` App-Link assets (if it must verify)
   - [ ] Every §3 URL resolves to a sensible page (graceful no-app fallback; no public health values)
   - [ ] `leiko.health/privacy`, `/terms`, `/support` exist + match §6
   - [ ] `leiko.app/support` redirects to `leiko.health/support` (§9)
   - [ ] `leiko.health/reserve` funnel: deposit, tiers, refund, confirmation, analytics-events-only
   - [ ] **No manufacturer name or FDA numbers anywhere on either site** (§5a) — if present, remove
   - [ ] All copy + ad creative passes §5 (FDA "cleared not approved"; no forbidden verbs)
   - [ ] `.health` ↔ `.app` cross-links present and correct
   - [ ] Analytics emits event names only, no PHI
3. **Severity-rank** gaps. 4. **Execute** against them; confirm-and-move-on for anything already correct.

---

## 9. Decisions (made — go with these) + externally-gated items

**Decisions — resolved; implement as stated (follow what's already shipped):**
- **D1 — Legal/support pages → canonical on `leiko.health`.** The app already links privacy/terms/support there. Keep it. The only mismatch is the app-store `supportUrl = leiko.app/support`; fix **website-side only** by making `leiko.app/support` **301-redirect to `leiko.health/support`**. **No app change.**
- **D2 — FDA wording → "FDA-listed Class II, cleared via the 510(k) process," never "approved," never with numbers or the manufacturer's name** (§5a).

**Externally-gated — confirm when available (not Phase-0 blockers):**
- **FDA substantiation** — the founder holds the registration/510(k) numbers privately and confirms scope before paid ads; these are **never** published.
- **Play App Signing SHA-256** for `assetlinks.json` — exists only *after* the first AAB upload.
- **Apple Team ID** for `apple-app-site-association`.
- **Org-account closed-test exemption** — 5-min Play Console check (§4).
- **App 1.0 freeze** — fixes still landing app-side; don't announce the app "shipped" until frozen + published.
- **Payment infrastructure** for the deposit (Stripe/Paystack + refund logic) — confirm live.

---

## 10. Provenance map (these files live in `leiko-app` — you CANNOT open them)

Essentials are inlined; if you need a verbatim original, **ask the founder to paste it** — and note the founder may redact the manufacturer name / FDA numbers first.

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

*Self-contained handoff from `farmerscreed/leiko-app`. The device's FDA status was confirmed privately by the founder against the FDA device-listing database; the specific identifiers and the manufacturer's name are a trade secret, intentionally excluded here, and must never appear on the public sites. Decisions in §9 follow what the app already ships; change only what's actually wrong.*
