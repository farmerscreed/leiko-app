# Sprint 16 — State Matrix

Working index for offline / error / loading / empty / stale wiring.
Source-of-truth for what each screen renders in each branch, and what
Sprint 16 owes it. Per-cell entries are one of:

| Symbol | Meaning |
|---|---|
| ✅ | Already shipped before Sprint 16 — verify only |
| 🟡 | Partial — needs harmonising with shared component |
| 🔴 | Missing — Sprint 16 builds |
| — | Not applicable for this surface |

Voice gate per `docs/05-voice-and-claims.md` + D11 §3 + `services/voice/voiceLint.ts`
applies to every cell.

---

## 1. Cross-cutting primitives

| Primitive | State | Note |
|---|---|---|
| Shared `<EmptyState />` | 🔴 | New. Replaces inline empty branches in BP/HR/SpO2/Sleep/Activity detail + Trends. Single voice-clean copy surface. |
| Shared `<ErrorState />` | 🔴 | New. Title + body + Try again CTA. Replaces inline `ChartError` in Trends and the ad-hoc strings on Reading / Settings. |
| Shared `<LoadingState />` | 🔴 | New. ActivityIndicator + calm caption. Replaces inline `ChartLoading`. |
| `useNetworkStatus()` hook | 🔴 | Wraps `@react-native-community/netinfo` (to install). 5s debounce on offline→online edges. |
| `<OfflineBanner />` mounted in `RootNavigator` | 🔴 | Renders only when `useNetworkStatus().offline === true`. |
| `withFallThrough()` AI wrapper | 🔴 | Tier-B → Tier-A → deterministic; PostHog `ai_degraded_fall_through { surface, stage }`. |
| Sync conflict policy module (`services/sync/conflict.ts`) | 🔴 | Server-wins for `vitals_*` rows; client-wins for `users.*` + `families.*` prefs; `vitals_other` dedup by `(user_id, ts_utc_sec, kind)`. |
| Per-vital exponential backoff cursor state | 🟡 | Per-vital cursors exist (Sprint 7.5). Add `failureCountByVital` + `nextRetryAt` so one failing vital doesn't stall the rest. |
| `lastSyncFailedAt` persisted in MMKV | 🔴 | New STORAGE_KEY. Set on the FIRST consecutive failure; cleared on success. Drives the 24h reassurance banner. |
| `<SyncReassuranceBanner />` (24h failed sync) | 🔴 | Calm copy: *"Your readings are saved. They'll sync when you're back online."* Mounted on Home (both modes). |

Stale-classifier is already shipped: `checkStaleness()` in
`utils/classification.ts:411`, thresholds verified by
`__tests__/classification-multi-vital.test.ts`. `VitalRing` and
`VitalTile` already render the stale visual treatment (opacity / "—"
fallback). Sprint 16's job is the **caption** ("last sync 4h ago") on
each vital detail screen + Daily Pulse tile.

---

## 2. Screen × state coverage

Caregiver and self-buyer share most screens; differences are in the
**default user-facing copy**, never in the cell semantics. Where copy
varies by mode (eg. "your parent" vs "you"), the shared
`<EmptyState>` accepts a `mode` prop and resolves through the
existing `useAuth().profile.account_type` selector.

| Screen | Empty | Loading | Error | Offline visible | Stale per-vital caption |
|---|---|---|---|---|---|
| `Home/SelfBuyerHome` (Daily Pulse hero + tiles + correlation strip) | ✅ (DailyPulseHero "—" branch) | 🟡 (skeleton during MMKV hydrate is silent) | 🔴 (no error path when readings hydrate fails) | 🔴 | 🔴 (tiles need "last sync 4h ago") |
| `Home/CaregiverHome` (constellation OR cards) | ✅ (StatusPill `offline` + PersonOrb dimming) | 🟡 | 🔴 (family fetch error path) | 🔴 | 🔴 |
| `Home/ParentReadingsList` | 🟡 | 🟡 | 🔴 | 🔴 | — |
| `VitalDetail/BPDetail` | ✅ (`isEmpty` branch on BPDetail.tsx:250) | 🟡 | 🔴 | 🔴 | 🔴 |
| `VitalDetail/HRDetail` | 🟡 | 🟡 | 🔴 | 🔴 | 🔴 |
| `VitalDetail/SpO2Detail` | 🟡 | 🟡 | 🔴 | 🔴 | 🔴 |
| `VitalDetail/SleepDetail` | 🟡 | 🟡 | 🔴 | 🔴 | 🔴 |
| `VitalDetail/ActivityDetail` | 🟡 | 🟡 | 🔴 | 🔴 | 🔴 |
| `Trends/Trends` (multi-vital chart + correlations + PDF CTA) | 🟡 (inline `ChartEmpty`) | 🟡 (inline `ChartLoading`) | 🟡 (inline `ChartError`) | 🔴 | 🔴 (correlation card stale caption) |
| `ReadingDetail/ReadingDetailScreen` | ✅ ("Reading not found") | — | 🔴 (paragraph fetch error) | 🔴 | — |
| `AskLeiko/AskLeikoScreen` | ✅ (suggestion chips) | ✅ ("Thinking…") | 🔴 → routes through AI cascade fall-through instead of an error surface | 🔴 (banner only — Ask Leiko itself works offline for Tier-A and queued questions) | — |
| `Learn/LearnScreen` + cluster + article | ✅ | ✅ | 🔴 | 🔴 (articles are pre-compiled offline; show banner but don't block reading) | — |
| `Settings/SettingsScreen` | — | — | 🔴 (toggle write failure → revert + toast) | 🔴 | — |
| `FamilyMembers/FamilyMembersScreen` | ✅ | 🟡 | 🔴 | 🔴 (block invite send; queue locally) | — |
| `CaregiverVisibility` | — | — | 🔴 | 🔴 | — |
| `AuditLog/AuditLogScreen` | ✅ | 🟡 | 🔴 | 🔴 | — |
| `Pairing/PairingScreen` (BLE) | — | ✅ | ✅ (BLE error states preserved from Sprint 5) | 🔴 (banner only; pairing is local-only and works offline) | — |
| `TakeReading/TakeReadingScreen` | — | ✅ | 🟡 (watch-disconnect mid-reading; Sprint 16 adds the **UI surface** — banner + retry — not the BLE protocol fix; sync handles reconnect already per Sprint 12.5.1) | 🟡 (reading captured locally, pending sync indicator) | — |

Onboarding stacks (`AccountTypeFork`, all `Onboarding/*` screens,
`Auth/*`) are **out of scope** for Sprint 16. They run before the
sync orchestrator exists; their error paths were closed in Sprints
2–4. Adding offline UI to onboarding would risk breaking flows that
are working today.

---

## 3. AI fall-through cascade (D14 §12 + sprint card §3.4)

Wraps every Tier-B-consuming surface. Order at each stage; PostHog
event on every step-down.

```
Tier-B call
  ↓ ok                 → render Tier-B body
  ↓ output guard hit ×2 (server) → fall through
  ↓ defer (medication, symptom, pregnancy, paediatric, mh, generic) → render DEFER template (existing)
  ↓ quota_exceeded     → render quota copy (existing) + paywall affordance
  ↓ error              → fall through
Tier-A template path
  ↓ ok                 → render template
  ↓ no matching intent → fall through
Deterministic copy (last resort)
  → render hard-coded calm line per surface
```

The user is **never** shown an AI error. Telemetry:
`ai_degraded_fall_through { surface, from: 'B'|'A', to: 'A'|'deterministic', reason }`.

Surfaces wired (all today consume Tier-B directly or via
placeholder):
- `services/ai/dailyNarration.ts` → home hero narration
- `screens/AskLeiko/AskLeikoScreen.tsx` → user-asked path
- `screens/VitalDetail/*` insight cards (currently use
  `tierBPlaceholder.ts`)
- Weekly summary placeholder card on Trends
- Reading-paragraph generator (`services/ai/readingParagraph.ts`)

---

## 4. Sync conflict policy

| Row class | Conflict winner | Reason |
|---|---|---|
| `vitals_bp` (and the multi-vital tables: `vitals_hr`, `vitals_spo2`, `vitals_sleep`, `vitals_activity`) | server | A row that already round-tripped through `/sync` is authoritative. Local re-uploads de-dup by `(user_id, raw_ts_sec, kind)`. |
| `vitals_other` | server | Same rule. Dedup key `(user_id, ts_utc_sec, kind)`. |
| `users.*` profile prefs (height, weight, units) | client | The owning device is the only place these are edited. |
| `families.*` prefs (anomaly_sensitivity, sensitivity_overrides) | client (owning phone) | Same. |
| `notification_preferences.*` | client | Last-touched-on-device wins. |
| Correlation rows (`vitals_correlations`) | server | Computed by Edge cron; mobile is read-only. |

Per-vital backoff (new): if `syncMultiVitals.{hr,spo2,sleep,activity}`
errors, schedule the next attempt at
`nextRetryAt[vital] = now + min(2^failureCount * 30s, 1h)`. Other
vitals continue at the normal cadence. Cleared on success.

---

## 5. Health Platform offline queue (D13 §12)

Already partly present: `services/health-platform/readExternal.ts`
has a 24h debounce + `healthPlatformLastAttempt` MMKV key. Sprint 16
adds:

- **Write queue.** Apple Health / Health Connect *writes* (BP →
  external) currently fire inline. If the platform is unreachable
  (HKErrorAuthorizationDenied, transient), enqueue the write
  payload to a per-platform pending list in MMKV and replay on next
  foreground when reachable.
- **Silent retry.** A 7-day-failed write continues to retry without
  ever surfacing an error to the user (sprint card line: "After 7
  days of failed Apple Health write: silent retry continues; user
  not nagged").

---

## 6. Watch disconnect mid-reading (sprint card line 34)

In scope (Sprint 16):
- UI: banner + retry CTA when `useTakeReading.phase === 'failure'`
  with `reason === 'disconnected_mid_reading'`.
- Telemetry: emit `reading_failed { reason: 'disconnect_mid' }`.
- State cleanup: ensure no zombie `phase: 'measuring'` entry can
  persist past app relaunch.

Out of scope (deferred to holistic test pass — see
`memory/ble_sync_open_issues.md`):
- The protocol-level "Force Sync doesn't surface new readings" and
  "most-recent BP doesn't reach Home" bugs.
- Watch firmware persistence quirks.

---

## 7. Out-of-scope (deferred / not Sprint 16)

- Onboarding error / offline polish (Sprints 2–4 territory).
- BLE protocol fixes (holistic test pass).
- New AI surfaces / anomaly logic (Sprint 15 just closed).
- Dark-mode polish (v1.1 per `SPRINT_SEQUENCE.md`).
- E2E tests via Maestro (Sprint 17 work).

---

## 8. Acceptance-criteria traceability

| Sprint 16 AC line | Owned by |
|---|---|
| Offline E2E (airplane mode → reading → kill → reopen → restore → sync) | §1 + §4 + §6 |
| Every screen renders correctly in airplane mode in both modes | §2 |
| Every vital detail screen shows stale state correctly per D13 §6.6 | §2 (stale caption column) |
| Failed PDF: shows error with retry | §2 row `Trends` error + `<ErrorState>` |
| Failed AI generation: never shows error to user | §3 |
| Failed push token registration: silently retries on next launch | Settings + RootNavigator: register call already idempotent; Sprint 16 just verifies + logs telemetry |
| Watch disconnect mid-reading: clean error path | §6 |
| 24h failed-sync calm reassurance banner | §1 `<SyncReassuranceBanner />` |
| 7d failed Apple Health write: silent retry, no nag | §5 |
| All error copy passes voice gate | every Sprint 16 string runs through `lintVoiceText()` in tests |

---

*Source of truth for Sprint 16 implementation order. Update as cells
move between 🔴 → 🟡 → ✅.*
