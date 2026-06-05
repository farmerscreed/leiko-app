# Leiko Web Handoff — backend/app session → `farmerscreed/leiko` (websites)

> **Who this is for:** a Claude Code session working in the **`farmerscreed/leiko`**
> repo (which holds `leiko.health` and `leiko.app`). It was written by a session
> working in **`farmerscreed/leiko-app`** (the mobile app + Supabase backend), which
> can see the app code but **cannot** see the website repo.
>
> **How to use it:** this is a *briefing + contract + roadmap*, **not** a build order
> for a blank slate. The websites already have content. So your **first job is a gap
> analysis** (Section 8), not construction. Read Sections 1–7, inventory what already
> exists in the repo, compare it against the contract here, produce the gap list, then
> execute against the gaps. Confirm the open decisions in Section 9 with the founder
> before building anything irreversible.

---

## 1. The picture — two products, two domains, one company

| | What it is | Domain | Regulatory footing |
|---|---|---|---|
| **The watch** | A wristwatch with a *real inflating BP cuff* (Urion U16 family). Hardware. | **leiko.health** — sells/reserves the watch | The **device's** clearances belong to the manufacturer (Urion). |
| **The app** | Leiko — a companion app that displays/logs readings from the watch and keeps families connected. | **leiko.app** — showcases the app + legal/technical anchor | Positioned as a **non-device companion**, not an independently-cleared medical device. |

- **Legal entity / publisher:** **LawOne Cloud LLC** (this is the Google Play *Organization* account holder and the D-U-N-S registrant). "Leiko" is the **brand**, not the company.
- **Go-to-market right now:** cold ads → **leiko.health/reserve** → **$50 refundable deposit** (tiered pricing; see `leiko-app:docs/marketing/reserve-page-brief.md`). The app does **not** need to be in users' hands for the reservation funnel to run — it needs the *promise* to be real.
- **Status:** Google Play **identity verification is pending** (async, blocks nothing on the web side). App is at **near-final 1.0** (a couple of fixes still landing — see Section 9).

**Why the two-site split is correct (and not just cosmetic):** it is *regulatory containment*. `leiko.health` sells the regulated **hardware** and may reference the **device's** real clearances. `leiko.app` is the **non-device app's** home and must stay in the no-medical-claims voice (Section 5). Keep them linked but distinct. `leiko.app` should stay tight: app showcase + legal/support pages + the deep-link asset files + an install path. Don't gold-plate it.

---

## 2. Identity & integration contract (NON-NEGOTIABLE — the app hard-codes these)

These are facts the app already ships. If the website does not match them, **deep links and install flows break**. Do not change these to suit the site; the site conforms to these.

| Thing | Value |
|---|---|
| Android package | `com.leiko.app` |
| iOS bundle id | `com.leiko.app` |
| Custom URL scheme | `leiko://` |
| App Link / Universal Link hosts | **`leiko.app`** and **`pair.leiko.app`** (both declared in `app.json` with Android `autoVerify: true` + iOS Associated Domains) |
| Marketing URL (app store metadata) | `https://leiko.app` |
| Support URL (app store metadata) | `https://leiko.app/support` |

### Deep-link / App-Link asset files the website MUST host

The app declares Android App Links + iOS Universal Links. For verification, **leiko.app must serve**:

- `https://leiko.app/.well-known/assetlinks.json`
- `https://leiko.app/.well-known/apple-app-site-association`

Canonical templates live in the **app repo** at `apps/mobile/well-known/` — copy their *content* (not assumptions) when you host them. Two placeholders must be filled before they're valid (Section 9):

- `assetlinks.json` → the **Play App Signing SHA-256** (only available *after the first AAB upload* to Play Console). The upload-key fingerprint (`84:13:9B:…:28`) is already filled; the Play one is still `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`.
- `apple-app-site-association` → the Apple Developer **Team ID** (`TEAMID` placeholder).

> ⚠️ If `pair.leiko.app` is meant to verify App Links too, it needs its **own** `/.well-known/assetlinks.json` and `apple-app-site-association` on that subdomain. Confirm during gap analysis.

---

## 3. The exact URL contract (paths the app already points users to)

Every URL below is referenced **in shipped app code**. The website must serve a sensible page at each — even the deep-link paths, because when a user *without* the app taps them, the browser opens the web URL and needs a graceful fallback ("Get the app" + the relevant context).

| URL | Referenced by (app) | What the page must do |
|---|---|---|
| `https://leiko.app/join` | Care/family invite (CareInviteSheet, Settings, deep-link parser) | Family-circle join landing. With app → deep-links in. Without → "Get Leiko + how to accept the invite." |
| `https://leiko.app/reading/{id}` | Anomaly/notification deep link | Deep-links to Reading Detail in-app. Web fallback: generic "open in app / get the app." **Must not display health values to the public.** |
| `https://leiko.app/vital/{kind}` | Notification deep link | Deep-links to Vital Detail. Same fallback rule. |
| `https://leiko.app/support` | App store `supportUrl` | Support / help page for the app. |
| `https://leiko.app` | App store `marketingUrl` | App marketing home. |
| `https://leiko.health/privacy` | Settings → legal | **Privacy policy** (content source in Section 6). |
| `https://leiko.health/terms` | Settings → legal | **Terms of service.** |
| `https://leiko.health/support` | Settings → support | Support page. *(Note the overlap with `leiko.app/support` — see Section 9 decision.)* |
| `https://pair.leiko.app/` and `https://pair.leiko.app/family-…` | Pairing screen | Watch-pairing handoff (e.g. opening the pairing flow on a parent's phone). |

The in-app deep-link route map (for context on what the `leiko://` scheme expects, so web fallbacks mirror it): `home`, `weekly`, `reading/{id}`, `vital/{kind}`, `settings/devices`, `family`, `settings/subscription`. Source: `leiko-app:docs/11-push-notifications.md` §3.

---

## 4. Lead capture & analytics rules (for the reserve funnel)

- **Reservation funnel** lives on `leiko.health/reserve`: $50 refundable deposit, tiered pricing (Founders' / Early / Reservation). Full spec: `leiko-app:docs/marketing/reserve-page-brief.md`. The ads playbook (`leiko-app:docs/marketing/leiko-ads-playbook.md`) targets this page exclusively.
- **Analytics = events only, never health/personal values.** This is a hard project rule (PostHog, no PHI). For the funnel, count event *names* only — e.g. `reserve_view`, `reserve_started`, `deposit_paid`, `join_clicked`, `optin_clicked`, `install_clicked`. **Never** put a reading value, email, or other personal datum into an analytics property.
- **App-side closed-test funnel may be obsolete.** `leiko-app:plans/beta-landing-funnel.md` describes a closed-tester recruitment funnel that existed because *individual* Play accounts created after Nov 2023 must run a 20-tester / 14-day closed test. **Organization accounts may be exempt** from that requirement — **verify in Play Console** (Section 9). If exempt, do **not** build the tester-recruitment funnel; aim `leiko.app` at the production install path instead.

---

## 5. The claims & voice law (governs EVERY word on both sites + all ad creative)

The app enforces this in CI; the websites and ads are **not** exempt. Full canon: `leiko-app:docs/05-voice-and-claims.md`. The high-risk rules for marketing/sales copy:

### Hard-forbidden (legal/regulatory risk, not just tone)
- `diagnose / diagnosis / diagnostic`, `treat / treatment / cure`, `predict` or `prevent` (in a disease context), `medical advice`.
- Fear language: `silent killer`, `ticking time bomb`, `before it's too late`, `dangerous level`, `critical level`.
- Outcome promises: anything implying it *will* lower BP, prevent disease, or extend life.
- `continuous blood pressure monitoring` (BP is on-demand, not continuous), `medical-grade SpO2` / `clinical SpO2` (SpO2 is wellness-only here).
- `replaces your doctor` → use "supplement, never replace."
- **Do not reuse Urion's original marketing** — `AI Pulse Diagnosis`, `TCM diagnosis`, etc. are outside the cleared use and forbidden.
- `smartwatch` as the primary product noun → use "watch", "wristwatch", "the device", or just "Leiko."

### The FDA claim trap (READ THIS before any "FDA" wording goes live)
The reserve brief currently uses **"FDA Establishment Registration #3011654863."**
- An **Establishment Registration is NOT an FDA approval or clearance** — it only means a facility/device is *listed* with the FDA. Presenting it as a badge that *implies* FDA endorsement is a classic **FTC violation** and a fast route to **ad-account suspension** on Meta/Google.
- Separately, the app docs reference a **510(k) clearance (K141683)** as the device's "cleared IFU." A 510(k) clearance *is* a real FDA clearance — materially stronger and more defensible than a registration, **if** it genuinely covers this device/market.
- **Action for the founder + a regulatory reviewer:** confirm exactly which FDA reference applies to the watch being sold, and use it **precisely** — never let "registered" read as "approved/cleared." When in doubt, say less.

### Defensible framing that still sells
- Describe what it **does**: "measures your blood pressure with a real inflating cuff," "shows your numbers clearly," "keeps families close." 
- "A real cuff. A real number." (the existing hero) is fine — it's a factual mechanism claim, not a health-outcome claim.
- "Talk to your doctor," never "consult a healthcare provider" or "medical advice."
- Lead with the answer; plain language before clinical terms; sentence case; warm + calm + dignified.

> Ad platforms (Meta, Google) apply **extra scrutiny to blood-pressure / health-device ads** regardless of claims, and restrict health-condition targeting. Get the copy clean *before* spending, or you risk disapprovals and account strikes.

---

## 6. Legal content source (privacy / terms / data-safety)

The website's `leiko.health/privacy` must match what the app actually does. **Do not invent it** — the ground truth is `leiko-app:docs/release/play-console-data-safety.md`, which is derived from a literal read of the app source. Key facts the privacy policy must reflect:

- **Data collected:** email (sign-in/invites), optional display name, health & fitness vitals (BP, HR, SpO2, sleep, steps, active energy) from the Urion U16 watch, purchase history (via RevenueCat + Google Play Billing), per-install device UUID, optional product-analytics events (no PHI), crash logs (PHI-scrubbed).
- **NOT collected:** location (a capped legacy BLE permission only, `maxSdkVersion=30`), microphone, camera, photos, contacts, calendar, messages.
- **Encryption:** in transit (HTTPS to Supabase; BLE link is local-only) and at rest on device.
- **Deletion:** Settings → Privacy and data → Delete my account.
- **Third parties:** Supabase (backend, on Hetzner), RevenueCat, Sentry, PostHog, Expo Push, Google Play Billing. (Links in the data-safety doc.)
- **Posture:** consumer/DTC, **not** a HIPAA covered entity per the project's regulatory stance; "patient" data is **not** collected.

`leiko.health/terms` should cover the reservation/deposit terms (refundability, balance-at-ship, tier conditions) — confirm against the reserve brief and with the founder.

---

## 7. Launch roadmap (phased — sequence matters)

**Phase 0 — Foundations (can all proceed now; Play verification not required):**
1. Gap analysis of both sites (Section 8).
2. Claims/voice clean-up of all live copy + ad creative (Section 5) — *gates safe ad spend*.
3. Legal pages live and consistent: `leiko.health/privacy`, `/terms`, `/support` (Section 6) — *required by Play, ad platforms, and to take deposits*.
4. Reservation funnel verified end-to-end: deposit capture, refund logic, tier handling, balance-at-ship, confirmation email, analytics events (no PHI).
5. `leiko.app`: app showcase + `/join`, `/reading/{id}`, `/vital/{kind}`, `/support` fallback pages + host the two `.well-known` files (with placeholders noted until fillable).

**Phase 1 — Play publish (when verification clears):**
6. First AAB upload → grab the **Play App Signing SHA-256** → update `leiko.app/.well-known/assetlinks.json` → re-verify App Links.
7. Decide store track (Section 9: org account may skip closed testing). Publish.
8. Wire the real Play listing URLs into `leiko.app` (`store/apps/details?id=com.leiko.app`).

**Phase 2 — Demand on (when 0–1 are solid):**
9. Turn on ads → `leiko.health/reserve`. Watch ad-account health + funnel conversion.

---

## 8. YOUR FIRST TASK — gap analysis (do this before building)

The sites already exist. Produce a gap report, then execute against it. Suggested method:

1. **Inventory.** List every page, route, and asset currently in the repo for *both* `leiko.health` and `leiko.app`. Note the stack/framework, hosting, and how deploys happen.
2. **Compare against the contract.** For each item below, mark ✅ present-and-correct / ⚠️ present-but-wrong / ❌ missing:
   - [ ] `leiko.app/.well-known/assetlinks.json` hosted (+ placeholder status)
   - [ ] `leiko.app/.well-known/apple-app-site-association` hosted (+ TEAMID status)
   - [ ] `pair.leiko.app` App-Link assets (if it must verify)
   - [ ] Every URL in Section 3 resolves to a sensible page (incl. graceful no-app fallback; no public health values)
   - [ ] `leiko.health/privacy`, `/terms`, `/support` exist and match Section 6
   - [ ] `leiko.health/reserve` funnel: deposit, tiers, refund, confirmation, analytics-events-only
   - [ ] All copy + ad creative passes the Section 5 claims/voice law (esp. the FDA trap)
   - [ ] Cross-links: `.health` ↔ `.app` present and pointing the right way
   - [ ] Analytics emits **event names only**, no PHI/personal values
3. **Severity-rank** the gaps (launch-blocking vs. nice-to-have).
4. **Propose the execution plan** from the gaps; confirm Section 9 decisions with the founder; then build.

---

## 9. Open decisions & cross-repo dependencies (confirm with founder)

**Decisions the founder must make:**
- **D1 — Who owns legal/support pages?** The app currently points **privacy/terms → `leiko.health`** but its app-store **supportUrl → `leiko.app/support`**, while in-app Settings support → `leiko.health/support`. That's inconsistent. Pick one canonical home per page and make the sites + (eventually) the app agree. *Recommendation:* keep privacy/terms on **leiko.health** (matches shipped app, minimal app change) and make `leiko.app/support` **redirect to** `leiko.health/support` (or vice-versa) so there's a single support page. Lowest-friction, no app rebuild required.
- **D2 — FDA wording.** Resolve the registration-vs-clearance question (Section 5) with regulatory input before any "FDA" text ships.
- **D3 — Closed testing.** Verify in Play Console whether the **Organization** account is exempt from the 20-tester/14-day closed test. Outcome decides whether `leiko.app` needs a tester funnel at all.

**Dependencies gated on external events (not blockers for Phase 0):**
- **Play App Signing SHA-256** for `assetlinks.json` — only exists *after* first AAB upload.
- **Apple Team ID** for `apple-app-site-association`.
- **App 1.0 freeze** — two fixes (sleep score; doctor-PDF file share + preview) are still landing on `leiko-app:fix/vitals-data-completeness` from another machine; they'll be cherry-picked onto `main`. Doesn't block the web work, but the *app* shouldn't be announced as "shipped" until frozen + published.
- **Payment infrastructure** for the deposit (Stripe/Paystack, refund logic) — confirm it's actually live, not just a brief.

---

## 10. Source-of-truth map (where to look in `leiko-app`)

| Need | File in `farmerscreed/leiko-app` |
|---|---|
| Voice & claims law | `docs/05-voice-and-claims.md` |
| Privacy / data-safety facts | `docs/release/play-console-data-safety.md` |
| Deep-link routes + App-Link hosting | `docs/11-push-notifications.md` §3 |
| App-Link asset templates | `apps/mobile/well-known/` |
| App identity (package/scheme/domains/URLs) | `apps/mobile/app.json` |
| Reserve page spec (watch) | `docs/marketing/reserve-page-brief.md` |
| Ads playbook | `docs/marketing/leiko-ads-playbook.md` |
| Closed-test funnel (may be obsolete) | `plans/beta-landing-funnel.md` |
| Operating manual / conventions | `CLAUDE.md` |

> These briefs live in `leiko-app` but describe the **websites**. Treat them as the **spec** the `leiko` repo implements. When the brief and a *shipped* app behavior disagree, the app + its ADRs win — verify against the app, don't assume the brief is current.

---

*Written from `farmerscreed/leiko-app`. It reflects the app/backend contract as read from source, plus open items the founder must resolve. It does not assume anything about the current state of the website repo — that's the gap analysis in Section 8.*
