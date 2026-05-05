# Screen — Settings

Sourced from D8 §4.11 + D6 US-78 / US-82 / US-84 / US-87 / US-88, with **AMENDS** per D8a §10 for the self-buyer track. The hub for every preference, every data control, every account-management action.

---

## Audience
Both (different sub-sets per persona).

## Purpose
- Profile management
- Notification preferences (per-category + quiet hours)
- Accessibility (large-text mode, reduced-motion override)
- Subscription (Plus status, billing portal deep link)
- Privacy (export data, delete account, view audit log)
- About (version, terms, privacy policy)

---

## Layout

A single scroll view of `ListRow` components grouped by section. Each section header is `type.label` Bold, `color.text.secondary`, `spacing.l` above + `spacing.s` below.

### Profile section
- `ListRow` `data` — Name (display_name from `public.users`)
- `ListRow` `data` — Photo
- `ListRow` `data` — Timezone (IANA, auto-detected, override-able)
- `ListRow` `data` — **Year of birth** (self-buyer mode per D8a §10.1 — editable here; in caregiver mode this field belongs to the parent record)
- `ListRow` `toggle` (3-state) — **"Diagnosed with hypertension?"** (self-buyer only, per D8a §10.1) — Yes / No / Prefer not to say. Captured optionally in onboarding (D6 US-7); editable here.

### Notifications section (D6 US-78)
- `ListRow` `toggle` — Daily summary
- `ListRow` `toggle` — Weekly summary (Plus)
- `ListRow` `toggle` — Anomaly notifications (Plus)
- `ListRow` `toggle` — Watch status
- `ListRow` `toggle` — Family activity
- `ListRow` `toggle` — Subscription / account
- `ListRow` `toggle` — Marketing (default OFF)
- `ListRow` `navigation` — Quiet hours → opens sheet with start/end time pickers (default 22:00–07:00 caregiver-local)
- Note: per `docs/11-push-notifications.md`, Anomaly + Medication can be set to bypass quiet hours; explained in-line.

### Accessibility section
- `ListRow` `toggle` — Large-text mode (parent profile)
- `ListRow` `toggle` — Reduced motion override (forces reduced-motion behaviour even if OS setting is off)
- `ListRow` `toggle` — Audio readout for readings (self-buyer / parent only)

### Subscription section (D6 US-71)
- `ListRow` `data` — Current plan ("Free" / "Plus monthly" / "Plus annual" / "Plus trial")
- `ListRow` `data` — Next billing date (Plus only)
- `ListRow` `navigation` — "Manage subscription" → deep-links to OS subscription settings (Apple / Google)
- `ListRow` `navigation` — "Switch to annual" (monthly subscribers only) — RevenueCat swap

### Family section

**Caregiver mode** — family management primarily lives on the home screen; this section is supplementary:
- `ListRow` `navigation` — "Family members" → opens family list with invite / role / remove actions
- `ListRow` `data` — Capacity ("3 of 5 caregivers" — Plus = 5; Free = 1)
- `ListRow` `action` — "Invite a caregiver" → opens invite sheet with email + 6-digit code generation (per CLAUDE.md "Family invites use email + 6-digit code, never URL tokens")

**Self-buyer mode (ADDS per D8a §10.2)** — family management lives ONLY in Settings:
- `ListRow` `data` — **"Family members"**: shows count of invited caregivers — *"None yet"* / *"1 person follows your readings"* / *"Sarah, John follow your readings"*
- `ListRow` `action` — **"Invite a family member"** → opens the invite-flow bottom sheet (D8a §10.3, below)
- `ListRow` `navigation` — **"Manage who sees my readings"** (visible only when at least one caregiver is invited) → list of caregivers with per-caregiver toggles for "share readings" and "share notes"

#### Invite-flow bottom sheet (D8a §10.3, self-buyer only)

| Element | Spec |
| --- | --- |
| Surface | `BottomSheet` (D8 §3.7), `color.surface.elevated` |
| Headline | "Invite someone to follow your readings" |
| Body | "They'll see your readings and trends. They won't see your private notes or your subscription." |
| Inputs | `input.text` "Their first name" + `input.text` or `input.email` "Their email or phone" |
| Permission level chip group | "Can see readings" (default) / "Can see readings and add notes" — single-select chips |
| Primary CTA | `button.primary` "Send invite" |
| Secondary | `button.ghost` "Cancel" |

### Privacy section (D6 US-82 / US-88)
- `ListRow` `navigation` — "Export my data (CSV)" — Plus only; free tier shows paywall trigger
- `ListRow` `navigation` — "What data do you collect?" — opens an in-app explainer (no external link)
- `ListRow` `navigation` — "Audit log" — opens last 90 days of `public.audit_log` for this user
- `ListRow` `action` `destructive` — "Delete account" — opens confirmation flow with 30-day grace explanation

### About section
- `ListRow` `data` — App version (e.g. "1.0.0 (build 42)")
- `ListRow` `navigation` — "Terms of service" — opens in-app webview at `https://kena.app/terms`
- `ListRow` `navigation` — "Privacy policy" — `https://kena.app/privacy`
- `ListRow` `navigation` — "Help" — opens email composer to `support@kena.app`
- `ListRow` `action` — "Sign out" — friendly when irreversible: "Yes, sign me out everywhere"

---

## Voice

Per `docs/05-voice-and-claims.md`:
- **Direct tone** in this section — Settings exists to give the user control.
- Section headers are noun phrases ("Notifications", "Privacy & data").
- Destructive actions explain what will happen, not what is irreversible: *"Delete account — your readings will be removed after 30 days."*
- Quiet-hours explainer: *"During quiet hours, only urgent and medication notifications come through. Everything else waits until morning."*

---

## Behaviour

- All toggles are MMKV-first, then synced to Supabase preferences.
- Quiet-hours selector picks two times via `react-native` time picker; saves on dismiss.
- "Manage subscription" deep links to OS settings (`Linking.openURL('itms-apps://')` on iOS, Play Store equivalent on Android).
- "Delete account" flows: OTP confirmation → 30-day grace → restore-grace screen if the user signs back in within 30 days → permanent delete after 30 days.

---

## Anti-patterns (CLAUDE.md)
- **Cancellation is dignified** (D5 §3.4): no "are you sure?" dark-pattern guilt screens. Just clear copy + confirmation.
- **Don't auto-fill medical data fields based on prior values** — applies to manual reading entry from Settings if exposed there (it isn't currently — manual entry lives in `take-reading.md`).

---

## Accessibility

- Each section header: `accessibilityRole: "header"`.
- Each toggle: `accessibilityRole: "switch"`, `accessibilityState: { checked: boolean }`.
- Destructive actions: `accessibilityHint` describes consequence ("Deletes your account after a 30-day grace period").
- Quiet-hours selector: full screen-reader support for time picker.

---

## Sprint 10 acceptance criteria
- All sections render with correct tokens.
- All toggles persist to MMKV + Supabase.
- Quiet-hours selector saves correctly.
- Subscription state reflects RevenueCat webhook updates within 5s of change (test with sandbox events).
- Family invite generates a valid 6-digit code and email.
- Delete-account flow writes audit log entry and routes to grace screen.
- Voice gate passes.
- Component + integration tests covering at least 5 toggles + the family invite flow + the delete flow.

---

## Removed Settings (self-buyer mode, D8a §10.6)

- **"Watch shipping & tracking"** (D7 ADR-014) appears only briefly during the watch-pending window. Once the user pairs the watch, this disappears — self-buyers don't need a permanent shipping section.
- **"Parent quiet hours"** timezone setting from caregiver Settings is REPLACED by **"My quiet hours"** — the self-buyer manages their own quiet hours, no separate parent timezone.

---

## Subscription section (D8a §10.5)

- **UNCHANGED** structurally
- **AMENDS**: copy lines reflect self-buyer-relevant features (PDF export, full history, plain-language explanations) instead of "share with up to 5 caregivers".

---

## Hybrid-mode behaviour summary (D8a §10.4)

When the self-buyer invites at least one caregiver and the invitation is accepted:

- Home screen **UNCHANGED** — still self-protagonist (`docs/04-screens/self-buyer-home.md` "Hybrid mode").
- Reading detail gains a **second notes channel**: "Family notes" (visible to invited caregivers) alongside the unchanged private "My notes".
- Settings → Family Members count updates.
- Subtle indicator on the home header bar (small `avatar.xs` cluster) shows that other people are following — transparency that surveillance is happening.
- A first-time toast appears the first time a caregiver views the data: *"Sarah just looked at today's reading."* — dismissible, **never repeats** per caregiver.
