# Screen — Settings

Sourced from D8 §4.11 + D6 US-78 / US-82 / US-84 / US-87 / US-88, with **AMENDS** per D8a §10 for the self-buyer track. The hub for every preference, every data control, every account-management action.

> **Implementation status**: Sprint 10 ships Settings across three sub-sessions. 10b.1 + 10b.2 + 10b.3 each delivered a vertical slice. The order below matches what's on screen today.

---

## Audience
Both (different sub-sets per persona). Self-buyer carries extra rows (hypertension chip, Apple Health / Health Connect surface). Caregivers do not see the Apple Health / Health Connect section per D13 §12.6.

## Purpose
- Profile management (D8a §10.1)
- Watch state + Forget (Sprint 5 surface, preserved)
- Vital streams + Goals — toggles flushed to the watch via the orchestrator
- Apple Health / Health Connect — master + per-vital read/write toggles (D13 §12.5)
- AI quota + tier explainer (D14 §14.1)
- Notification preferences + quiet hours (D13 §11.3)
- Privacy + data — export, activity log, delete account (D6 US-82, US-88)
- About (version, terms, privacy, help)
- Account (sign out)

---

## Layout

A single scroll view of `<SettingsSection>` blocks, each composed of `<ListRow>` rows (D8 §3.5). Section headers follow `type.label` Bold, `color.text.secondary`, `spacing.l` above + `spacing.s` below.

Sections render in this order:

1. Profile
2. Watch
3. Vital streams
4. Goals
5. Apple Health & Health Connect — *self-buyer only*
6. Notifications
7. Privacy and data
8. AI
9. About
10. Account

### Profile section (Sprint 10b.1)
- `data` — Name (display_name from `public.users`)
- `data` — Photo (placeholder until upload flow lands)
- `data` — Timezone (auto-detected; editable lands in a follow-up)
- `data` — Year of birth
- `select` — **"Diagnosed with hypertension?"** (self-buyer only, per D8a §10.1) — Yes / No / Prefer not to say. Opens a 3-state BottomSheet that writes via `services/users/updateProfile` and refreshes the auth-store `profile`.

> Voice note (Sprint 10b.1): "Diagnosed with hypertension?" is the spec verbatim. The voice-rule forbid-list on `diagnose / diagnosis / diagnostic` targets Leiko-as-diagnostic-tool claims, not user-history questions about an existing doctor diagnosis. If a copy-lint test lands later, this prompt should be explicitly scoped out.

### Watch section (Sprint 5 + 10b.1)
**Paired**:
- `data` — Watch name + mac suffix (subtitle), value="Connected"
- `data` — Last sync (formatted "Just now" / "5 min ago" / "3 h ago" / "2 d ago" from MMKV `lastSyncByDevice`)
- `action` — Pair another watch → navigates to Pairing
- `action` `destructive` — Forget this watch → BottomSheet confirm (preserved from Sprint 5)

**Empty**:
- `data` — "No watch paired yet" + subtitle
- `action` — Pair a watch → navigates to Pairing

### Vital streams section (Sprint 10b.2)
- `toggle` — Auto heart rate (wired to `setAutoHR` via the orchestrator's `applyDeviceConfig` step). Default ON.
- `toggle` — Auto oxygen (wired to `setAutoSpO2`). Default OFF (battery).

The store (`state/vitalSetup.ts`) is MMKV-backed with a `dirty` flag; the orchestrator flushes the four BLE setters (`setAutoHR`, `setAutoSpO2`, `setUserParams`, `setGoals`) to the watch on every sync run and clears the flag on success.

### Goals section (Sprint 10b.2)
- `navigation` — Steps target (default 6,000 per Q-D13-1) → BottomSheet picker, 2,000–20,000 in 1,000-step increments.
- `navigation` — Sleep target (default 8h) → BottomSheet picker, 6h–10h in 30-min increments.

Goal writes flow through `setGoals`. `setUserParams` runs in the same orchestrator step using profile demographics (gender, year_of_birth → age, height_cm, weight_kg). When demographics are incomplete, `setUserParams` is skipped — the watch keeps its previous values.

### Apple Health & Health Connect section (Sprint 10b.2)
Self-buyer (and parent / hybrid) only. Per D13 §12.5:
- `toggle` — Master "Connect to your phone's health app". OFF by default (opt-in).
- When ON: per-vital write toggles (BP / HR / SpO2 / Sleep / Steps / Calories) + per-vital read toggles (Weight / Height / Blood glucose).

State lives in the existing `useHealthPlatformToggles` store (Sprint 9.5). Settings is the surfacer; the bridge service writes/reads.

### Notifications section (Sprint 10b.3)
Per D13 §11.3 + the new `notification_preferences` table (migration 0009). Eight rows:

- `toggle` — Daily summary
- `toggle` — Weekly summary (Plus only at runtime — toggle is settable but the routing layer skips for free)
- `toggle` — Anomaly notifications (Plus only at runtime)
- `toggle` — Watch status
- `toggle` — Family activity
- `toggle` — Subscription and account
- `toggle` — Marketing (default OFF — opt-in per D6)
- `toggle` — Quiet hours (default ON, 22:00–07:00 caregiver-local)

When quiet hours are ON, an additional `navigation` row exposes the quiet window. Tapping opens a BottomSheet with five preset windows (10 PM–7 AM, 10 PM–8 AM, 11 PM–6 AM, 9 PM–7 AM, midnight–8 AM). Custom windows defer until a date-picker library is added.

Anomaly + medication notifications can override quiet hours. The Settings copy explains this inline; the override flag lives on the `notification_preferences` row (`anomaly_bypass_quiet`, `medication_bypass_quiet`).

All toggles are MMKV-first (offline source of truth) and best-effort sync to `public.notification_preferences` on every change.

### Privacy and data section (Sprint 10b.3)
- `action` — **Export my data** — Plus-gated. Free users see the paywall (`csv_export` trigger). Plus users invoke `/export-data` Edge Function which returns a CSV; the client opens the native Share sheet so the user can email / save / AirDrop. Native file save (via expo-file-system) is a polish follow-up.
- `navigation` — **Activity log** → opens `AuditLogScreen`, the last 90 days of `public.audit_log` for the actor (RLS-permitted self read).
- `action` `destructive` — **Delete my account** — opens a BottomSheet that requires the user to type their email. Calls `/delete-account` Edge Function which sets `users.deleted_at = now()` and writes an audit-log entry, then signs the user out.

> **Hardening deferred to Sprint 17**: full OTP reauthentication (the spec calls for it), restore-grace screen for the 30-day window, and the hard-delete cron that purges expired soft-deletes. The 30-day grace exists on paper today; a row is just orphaned until the cron lands.

### AI section (Sprint 10b.2)
- `data` — Questions this month — count + tier limit, e.g. "0 of 5" (free) or "12 of 100" (Plus). Resets on the 1st. Backed by `services/ai/quotaCounter.ts` which queries `audit_log` for `ai.user_question` rows in the calendar month, MMKV-cached + monotone within month.
- `data` — Your tier — explainer copy varies by free vs Plus. Reads `usePlusEntitlement().tier`.

The counter sits at zero until AI Tier-B ships in Sprint 11.

### About section (Sprint 10b.1)
- `data` — App version
- `navigation` — Terms of service → `Linking.openURL('https://leiko.app/terms')`
- `navigation` — Privacy policy → `Linking.openURL('https://leiko.app/privacy')`
- `action` — Help → `Linking.openURL('mailto:support@leiko.app')`

### Account section (Sprint 10b.1)
- `action` `destructive` — Sign out → BottomSheet confirm → `useAuth.signOut()` (which also calls `logoutPurchaser` per Sprint 10a).

---

## Family management

Family invite flow + hybrid-mode "Manage who sees my readings" lands in **10c**, not in this screen. Sprint 10c will add a Family section above About:

- Caregiver mode: family member list, invite caregiver action.
- Self-buyer mode (D8a §10.2-§10.3): "Family members" data row, "Invite a family member" action, "Manage who sees my readings" navigation when at least one caregiver is invited.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- **Direct tone** in this section — Settings exists to give the user control.
- Section headers are noun phrases ("Profile", "Notifications", "Privacy and data").
- Destructive actions explain what will happen, not what is irreversible: *"Your readings will be removed after 30 days."*
- Cancellation is dignified — Forget watch sheet, sign-out sheet, and delete sheet all preserve "Maybe later" / "Stay signed in" / "Keep my account" escape hatches.

---

## Behaviour

- All toggles are MMKV-first (synchronous read for instant render) and best-effort sync to Supabase.
- Watch-bound settings (HR / SpO2 toggles, goal targets, demographics) flush on the next sync run via the orchestrator's `applyDeviceConfig` step.
- Quiet-hours selector picks from preset windows; saves on dismiss.
- Subscription state syncs from `families.subscription_status` via the live `usePlusEntitlement` hook (Sprint 10a).

---

## Anti-patterns (CLAUDE.md)
- **Cancellation is dignified** (D5 §3.4): no "are you sure?" dark-pattern guilt screens.
- **Don't auto-fill medical data fields based on prior values** — applies to manual reading entry from Settings if exposed there (currently it isn't — manual entry lives in `take-reading.md`).

---

## Accessibility

- Each section header carries `accessibilityRole="header"`.
- Each toggle: `accessibilityRole="switch"`, `accessibilityState: { checked: boolean }`.
- Destructive actions: `accessibilityHint` describes consequence ("Deletes your account after a 30-day grace period").
- Quiet-hours selector: full screen-reader support for time picker.

---

## Sprint 10 acceptance state

| Criterion | State (as of 10b.3) |
| --- | --- |
| Settings shows all sections per the new spec, in both modes | ✅ except the Family section (10c) |
| Per-vital toggles change state on watch + Health Platform | ✅ orchestrator flushes via `applyDeviceConfig` |
| Sleep-hidden-by-default for hybrid-mode caregiver visibility | ❌ — 10c |
| AI quota counter accurate against `audit_log` egress events | ✅ infrastructure complete; sits at 0 until Tier-B ships |
| Voice gate passes on every authored string | ✅ (with the documented "Diagnosed" hypertension scope) |

---

## Removed Settings (self-buyer mode, D8a §10.6)

- **"Watch shipping & tracking"** (D7 ADR-014) appears only briefly during the watch-pending window. Once the user pairs the watch, this disappears — self-buyers don't need a permanent shipping section.
- **"Parent quiet hours"** timezone setting from caregiver Settings is REPLACED by **"Quiet hours"** — the user manages their own quiet hours, no separate parent timezone.
