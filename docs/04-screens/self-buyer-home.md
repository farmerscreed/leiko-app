# Screen — Self-Buyer Home / Your Readings

**SUPERSEDES** D8 §4.5 (Home / Family Circle) for the self-buyer track only. Sourced from D8a §6.

> The single most consequential UI change in D8a. The Family Circle metaphor is replaced by a single-protagonist layout: your latest reading at the top, your trend immediately below, your weekly snapshot below that. **No cards-per-parent. No "Add a family member" primary affordance.**

---

## Audience
Self-buyer (`account_type = 'self_buyer'`). Default tab on app launch (Tab Bar position 1).

## Purpose
Show the user their own most-recent BP reading and trend at a glance. Designed for someone reckoning with a new diagnosis who wants to actually understand what's happening — not a dashboard.

---

## Layout (D8a §6.1)

| Element | Spec |
| --- | --- |
| Header bar | App title ("Kena") on the left, settings gear icon on the right |
| Anomaly Banner (conditional) | If active: full-bleed banner per `docs/10-anomaly-logic.md` §5 — **self-framed copy variant** per D8a §12.1 |
| **Hero card** | Latest reading. Larger than the equivalent caregiver Reading Card. Uses `type.numeric-xl` (56pt) for BP value. Range chip below. Timestamp. |
| Trend mini-chart | Last 7 days, BP only, sparkline-style (NOT the full BP Trend Chart). Tap-through to full Trends screen. |
| Weekly snapshot row | Three small stat tiles: **"Average"**, **"In-range %"**, **"Readings this week"**. Each is a `list.row.data` variant. |
| Compact Learn card | One contextual education item based on the latest reading (per `docs/08-learn-module.md`). Auto-rotates daily. Single tap opens Learn. |
| Floating action button (FAB) | **"Take a Reading"** — `button.accent`, bottom-right above tab bar. Triggers the manual-reading walkthrough. |
| Tab bar | Visible — Home tab active |

---

## Hero card (D8a §6.2)

| Region | Content | Token use |
| --- | --- | --- |
| Surface | — | `color.surface.subtle` (cream subtle), `radius.m`, padding `spacing.xl` |
| Top label | "Latest reading" or "Your morning reading" / "Your evening reading" (time-of-day aware) | `type.label`, `color.text.secondary` |
| BP value | e.g. `128/82` | `type.numeric-xl` (56pt), `color.text.primary`, tabular monospace |
| Unit | `mmHg` | `type.body-m`, `color.text.secondary`, inline trailing the value |
| Status chip | In range / Elevated / High (per `docs/10-anomaly-logic.md`) | `pill.success` / `pill.accent` / `pill.urgent` |
| Timestamp | "This morning at 7:42" / "Today, 4:15 pm" / relative format >24h | `type.caption`, `color.text.secondary` |
| HR + SpO2 mini stats | e.g. `HR 72 bpm • SpO₂ 97%` | `type.body-s`, `color.text.secondary` |

---

## Hero card states (D8a §6.2.1)

| State | Trigger | Visual |
| --- | --- | --- |
| `fresh` | Reading <12h old, in normal range | Default. Status chip = `pill.success` "In range" |
| `fresh-elevated` | Reading <12h old, classifies as Elevated | Status chip = `pill.accent` "Elevated". Single-line educational nudge below. |
| `stale` | Reading 12–72h old | Timestamp uses `color.text.secondary`; subtle "Time for a new reading?" caption with FAB-equivalent inline link |
| `silent` | No reading in >72h | Hero card replaced by an empty-state card with prompt to take a reading |
| `anomaly-noted` | Reading triggers anomaly logic | Anomaly banner above replaces inline nudge. Status chip = `pill.accent`. |
| `confirmed-urgent` | ≥180/120 OR three consecutive ≥160/100 | **Crimson** left-edge stripe (4pt). Status chip = `pill.urgent`. **The only place crimson appears in self-buyer home.** |
| `watch-pending` | No watch paired yet, order is being shipped | Hero card replaced by friendly waiting state showing tracking number if available |

---

## Verified copy per state (D8a §6.3)

| State | Top label | Status chip | Inline nudge / context |
| --- | --- | --- | --- |
| fresh (morning) | "Your morning reading" | "In range" | (none) |
| fresh (evening) | "Your evening reading" | "In range" | (none) |
| fresh-elevated | "Latest reading" | "Elevated" | "Worth keeping an eye on." |
| stale | "Latest reading" | — | "Time for a new reading? Tap below." |
| silent | "Welcome back" | — | "It's been a few days. Want to take a reading now?" |
| anomaly-noted | "Latest reading" | "Elevated" | (banner above takes the message; no inline nudge) |
| confirmed-urgent | "Latest reading" | "High" | "These last few readings are unusually high. We recommend talking to your doctor today." |
| watch-pending | "Welcome" | — | "Your watch is on its way. We'll let you know when it arrives." |

---

## Empty home — no readings yet (D8a §6.4)

When the user has paired the watch but has not yet taken a first reading:

| Element | String |
| --- | --- |
| Headline | "Ready when you are." |
| Body | "Press the side button on your watch and stay still for about a minute. We'll show your reading here." |
| CTA | "Show me how" — opens reading walkthrough (per `docs/08-learn-module.md`) |

---

## Removed affordances vs caregiver home (D8a §6.5)

- **No "Add a family member" floating button** — equivalent action lives in Settings (`docs/04-screens/settings.md` §"Family Section").
- **No multi-card scrolling list** — a single hero plus single trend is the entire screen.
- **No avatar in the header** — the user is on their own home, no need to identify whose data.
- **No family-side anomaly aggregation logic** — anomaly is always about the user themselves.

> **Why a "Take a Reading" FAB on home** (D8a §6.5 callout): caregiver home does NOT have this affordance because caregivers don't take readings — the parent does, on the watch. Self-buyers DO take readings (typically twice a day), and the FAB makes that the most accessible action. It triggers the manual-reading walkthrough — it does **not** start a measurement directly (BP measurement starts on the watch, not the phone).

---

## Behaviour

- Pull-to-refresh + auto-refresh on app foreground. TanStack Query handles cache + retries.
- Realtime updates: Supabase Realtime subscription on `public.readings WHERE family_id = (self-buyer's family)`. New readings push into the hero live.
- Hero tap → Reading Detail (`docs/04-screens/reading-detail.md`).
- Trend mini-chart tap → Trends screen (`docs/04-screens/trends.md`).
- FAB tap → Take Reading walkthrough (`docs/04-screens/take-reading.md`).
- Compact Learn card tap → Learn module (`docs/08-learn-module.md`).

---

## Hybrid mode (D8a §10.4)

When the self-buyer invites at least one caregiver and the invitation is accepted:

- Home screen **UNCHANGED** — still "Your readings", still self-protagonist layout. They are not retroactively pushed into the Family Circle metaphor.
- A subtle indicator on the home header bar (small `avatar.xs` cluster, top-right of the hero card) shows that other people are following — transparency that surveillance is happening.
- A **first-time toast** appears the first time a caregiver views the data: *"Sarah just looked at today's reading."* — dismissible, **never repeats** per caregiver (D8a §10.4 toast policy).

> **Toast policy for transparency** (D8a §10.4): D5 §3.4 says "Health is shared, not surveilled." The first-view toast is the single concession to that principle in hybrid mode. It does NOT repeat (no toast every time a caregiver opens the app — that creates anxiety on both sides).

---

## Free vs Plus

Per `docs/09-paywall-and-iap.md`:
- Free tier sees latest reading + last 7 days. Beyond 7 days requires Plus.
- **Latest reading is NEVER paywalled** (D5 §3.4).
- Anomaly banner is suppressed for free tier (free tier shows reading but no proactive alert push).
- Per D8a §2.3: **never up-sell on the home screen.** Paywall fires on the 6th reading, not earlier.

---

## Voice rules (D8a §2.3 + §12.1)

- All self-buyer copy is **second-person**: "your reading", not "Mum's reading".
- Reassuring tone by default. Never countdowns. Never urgency timers.
- Never "patient", never "user", never "you may have", never "we detected".

---

## Anti-patterns (CLAUDE.md + D8a §2.3)
- **Never streaks, badges, progress rings.** Self-buyers churn on apps that turn their condition into a game.
- **No count badges.**
- **No fear-based push.**
- **Don't use red for normal-state UI.** Crimson is only the `confirmed-urgent` left-edge stripe.

---

## Accessibility

- Hero numeric: `accessibilityLabel` reads as a complete sentence including tier ("Your reading: 128/82 mmHg. In range.").
- FAB: `accessibilityLabel: "Take a reading"`, hint "Walks you through taking a reading on your watch".
- VoiceOver order: header → banner (if any) → hero (top label → BP value + chip → timestamp → HR/SpO2) → trend chart → snapshot row → Learn card → FAB.
- Caregiver-cluster avatar (hybrid mode): announced as "X people follow your readings".

---

## Sprint 8 acceptance criteria
- All 7 hero card states render with correct tokens (`fresh`, `fresh-elevated`, `stale`, `silent`, `anomaly-noted`, `confirmed-urgent`, `watch-pending`).
- Verified copy strings exact-match D8a §6.3.
- Realtime new-reading update lands in hero card without manual refresh.
- FAB routes to take-reading walkthrough.
- Voice gate passes.
- Component + integration tests covering all 7 states.
