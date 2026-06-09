# Leiko Production Readiness Checklist

**Generated:** 2026-05-14 Lagos · Sprint 16.5i audit
**Last verified:** 2026-06-02 — after the ADR-0006/0007 unified-model pivot
merged to `main` as PR #8 (`3c1dba7`).
**Status legend:** 🔴 P0 blocker · 🟡 P1 risk · 🟢 P2 polish · ✅ done

> **2026-06-02 status note.** Since this audit was generated, Sprint 18
> engineering (incl. SEC-1 MMKV encryption-at-rest) closed and the
> ADR-0006/0007 unified caregiver/self-buyer model + Connect invites
> shipped to `main`. The **code-side** blockers below are resolved; the
> remaining P0s are the external **founder-ops** items (OPS-1..12) — they
> require Apple/Google/RevenueCat dashboards and prod infra the engineer
> can't reach. This document stays the source of truth for "what ships at
> v1.0." Two locked-but-unbuilt stack items (WatermelonDB, AI Tier-A on
> Ollama) await a founder planned-vs-abandoned call — see
> `NEXT_SESSION_START_HERE.md`.

This document is the launch-gating checklist. Every item is sized and
labelled so the founder can decide what ships and what waits. The
audit that produced it covered five dimensions in parallel:

1. Code quality + risk surface (TODOs, console.log, type casts, etc.)
2. Security + PHI + secrets + auth boundaries
3. Build + deploy + platform configuration
4. UX + voice + accessibility + persona parity
5. Reconciliation of every deferred item from prior sprint close-outs

---

## 🔴 P0 — LAUNCH BLOCKERS

Each of these items prevents the app from being submitted, signed,
served, or running correctly in production. **Cannot ship until all
are resolved.**

### Founder ops (external dependencies)

| ID | Item | Why | Owner | Time |
|----|------|-----|-------|------|
| **OPS-1** | Push DB migration `0019_vitals_dedupe_full_index.sql` to prod | Multi-vitals sync 500s at first SpO2 insert without this. HR/SpO2/sleep/activity invisible server-side. | Founder ops | 5 min |
| **OPS-2** | Set `pg_cron` GUCs in prod Supabase: `app.settings.functions_base_url` + `app.settings.service_role_key` | Three crons silently failing (compute-correlations, weekly summary, monthly baseline, anomaly detection). Trends correlation cards stay empty. | Founder ops | 5 min |
| **OPS-3** | Run `npx expo prebuild --platform ios` | `apps/mobile/ios/` doesn't exist. Cannot generate iOS build. | Founder + dev env | 10 min |
| **OPS-4** | Apple Developer account: enable HealthKit entitlement on `com.leiko.care` | App.json declares plugin + usage strings, but the entitlement flag must be flipped on the Dev account before App Store review. | Founder | 10 min |
| **OPS-5** | Generate Android release keystore + configure EAS signing | `android/app/build.gradle:113` still uses `debug.keystore`. Play Store rejects debug-signed releases. | Founder | 30 min |
| **OPS-6** | Configure iOS distribution certificate + provisioning profile in EAS | `eas.json` production profile has no `ios.certificateSource` / team ID. EAS cannot sign without it. | Founder | 30 min |
| **OPS-7** | Provision APNs `.p8` signing key + FCM service-account JSON | Sprint 15 anomaly push ships in "sandbox-only" mode until these are wired into Expo credentials. No real device will receive alerts. | Founder | 1 hr |
| **OPS-8** | Provision RevenueCat keys + webhook secret + IAP product IDs (iOS + Android) | Plus tier unreachable without these. Trends 30D/90D/1Y, doctor-PDF export, Tier-B AI quota all gated. | Founder | 2 hr |
| **OPS-9** | Host `leiko.app` + `pair.leiko.app` with valid AASA + assetlinks.json | Templates at `apps/mobile/well-known/` still have `TEAMID` / `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` placeholders. Deep links broken. | Founder | 1 hr |
| **OPS-10** | App Store demo account credentials + privacy policy URL | `docs/_reference/app-store-healthkit-justification.md` is empty of these. App Store review will reject. | Founder | 30 min |
| **OPS-11** | Deploy all Edge Function env vars to prod Supabase (`ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`, etc.) | Edge Functions 500 in prod without these. | Founder ops | 30 min |
| **OPS-12** | Set prod Supabase URL in EAS production profile env (`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`) | The build ships pointing at `localhost:54321` otherwise. | Founder + me | 10 min |

### Code-side (✅ resolved in 16.5i)

| ID | Item | Status | Commit |
|----|------|--------|--------|
| **CODE-1** | App version `0.0.0` → `1.0.0` | ✅ | `97bc8f9` |
| **CODE-2** | Unhandled promise in `useReducedMotion` (cold-start crash risk) | ✅ | `97bc8f9` |
| **CODE-3** | Unhandled `.catch()` in `AskLeikoBody` (frozen UI on AI runtime error) | ✅ | `97bc8f9` |
| **CODE-4** | Hardcoded `'#FFFFFF'` color fallback in lock chips (invisible-text risk) | ✅ | `97bc8f9` |
| **CODE-5** | `CaregiverHome` missing all 5 server-hydration hooks (primary persona saw stale data) | ✅ | `a2b6bbc` |
| **CODE-6** | Hardcoded `'en-US'` locale in 4 screens (breaks Nigeria market) | ✅ | `1129bff` |

### Founder decision required

| ID | Item | Why |
|----|------|-----|
| **DEC-1** | The doctor-PDF cover line "It is not a diagnosis" | `docs/05-voice-and-claims.md` mandates this exact phrase for the medical-device disclaimer. CLAUDE.md voice rules forbid the word "diagnosis". The two specs are in tension. **Founder must pick:** keep the exact mandated phrase (overrides voice lint for that one string with a comment) OR reframe ("This report is general information. Talk to your doctor about what it means.") |

---

## 🟡 P1 — HIGH-RISK, SHOULD-FIX-BEFORE-LAUNCH

Items that won't block submission but degrade user trust, miss
features the brand promises, or surface fragility.

### Security hardening

| ID | Item | Why | Effort |
|----|------|-----|--------|
| **SEC-1** | MMKV not encrypted at rest | `apps/mobile/src/services/storage.ts:15` creates MMKV without an `encryptionKey`. CLAUDE.md mandates "encrypt at rest + transit". This is a non-trivial refactor: MMKV is synchronous; OS keychain reads are async — needs a "bootstrap-then-init" boot flow (App.tsx awaits keychain before mounting any consumer). Half-secure approaches (deriving from a fixed string) would be theatre. | 1-2 days |

### Functional gaps

| ID | Item | Why | Effort |
|----|------|-----|--------|
| **FUN-1** | SMTP / email transport for family invites | `send-family-invite/index.ts:19-22` documents that the caregiver currently sees the 6-digit code in-app and shares manually. Brand promise is "caregiver invites parent via email". Wire Resend or SendGrid. | 2 hr |
| **FUN-2** | Hard-delete cron + 30-day SLA for `delete-account` | GDPR/CCPA requires data deletion within 30 days. `delete-account/index.ts:1-14` only soft-deletes. Add `0020_pg_cron_hard_delete.sql`. | 1 hr |
| **FUN-3** | Caregiver per-parent AI narration is hardcoded placeholder | `caregiverPerson.ts:21` confirms "deterministic placeholder until Sprint 12.5 wires AI". Caregiver is the primary persona; they currently get a worse experience than self-buyer. | Half-day |
| **FUN-4** | `expo-notifications.scheduleNotificationAsync` never wired | Sprint 12.5 ships the learned-time-reminder engine (`reminders/learnedTime.ts`) but no dispatcher ever calls `Notifications.scheduleNotificationAsync()`. Feature is dead. | 2 hr |
| **FUN-5** | Doctor-prep AI Edge Function exists but never wired into PDF | `generate-doctor-prep-ai/` runs but never reaches `generate-doctor-pdf`. The `coverNote` field (Sprint 16.5h) was the first connector; the AI sections still aren't threaded. | Half-day |
| **FUN-6** | PDF rasterizer vendor not picked (`PDF_RASTERIZER_URL` empty) | `generate-doctor-pdf/index.ts:128` reads the env; without it, every prod doctor-PDF request 500s. PDFShift starter ~$9/mo or similar. | 30 min (vendor pick) |
| **FUN-7** | `applyDeviceConfig` not on-device verified | Force-flag wired (Sprint 12.5.2) but the operational verification ("does setUserParams actually push?") never re-ran post-Sprint 16.5a. Risk: silent HR/sleep quality degradation. | 1 hr bench |
| **FUN-8** | Background-fetch on-device verification incomplete | `services/sync/backgroundSync.ts` + `app.json` all wired; the "leave app closed 30 min, see if it fired" walk was cut short at Sprint 10. | 1 hr bench |

### Quality / fragility

| ID | Item | Why | Effort |
|----|------|-----|--------|
| **QUA-1** | BP value mismatch (intermittent firmware race after `0x73 0x02`) | Sprint 16.5c bugs table. Caregiver could see a wrong BP value if they happen to look during the race window. Vote-on-retry or settling-delay fix. Low frequency, high trust impact. | 2 hr |
| **QUA-2** | HR sample interval fallback still 30min hardcoded (real is 5min) | `syncMultiVitals.ts:104` `HR_FALLBACK_WINDOW_SEC = 30 * 60`. Partial fix landed (per-call interval now read from index packet); verify the read path works + remove the fallback. | 30 min bench |
| **QUA-3** | iOS `UIBackgroundModes` includes `bluetooth-central` but Android `FOREGROUND_SERVICE_TYPES` doesn't declare `connectedDevice` explicitly | Spot-check on Android 14+ if BLE service runs. App.json declares the permission; verify the Expo plugin generates the right manifest entries. | 30 min |
| **QUA-4** | No CI deploy workflow for mobile builds or DB migrations | `.github/workflows/ci.yml` runs lint/typecheck/test but no `eas build` or `supabase db push`. Releases are manual + error-prone. | Half-day |
| **QUA-5** | iOS `PrivacyInfo.xcprivacy` not declared | iOS 17+ requires a privacy manifest in the bundle declaring data collection. Expo can generate it with the right plugin (`expo-apple-app-privacy`) + entries. | 1 hr |
| **QUA-6** | 9 npm vulnerabilities (4 moderate — postcss XSS chain via expo-metro-config) | Block CI dependency scan + may slow App Store review. Upgrade Expo SDK 54 → 55 if compatible. | Half-day |
| **QUA-7** | App Store / Play Store metadata stubs | `app.json` lacks `description`, `privacy`, `supportUrl`, `marketingUrl`. Both stores require these for submission. | 1 hr (with assets) |
| **QUA-8** | Help / Support link missing from Settings | Audit found no path from Settings to FAQ / contact support. New screen needed OR external URL row. | 2 hr |

---

## 🟢 P2 — ACCEPTABLE TO SHIP WITHOUT (KNOWN GAPS)

Document but do not block launch.

### Feature gaps

| ID | Item | Sprint origin |
|----|------|---------------|
| **GAP-1** | Sleep REM stages + transitions stubbed (only deep / light) | 7.5 |
| **GAP-2** | Activity hourly distribution all-zeros (not surfaced in current UI; verified safe) | 7.5 |
| **GAP-3** | Sports records ingest missing | 16.5a |
| **GAP-4** | Deep BP backfill > 50 readings (Phase-2 walk-back gated off) | 16.5c |
| **GAP-5** | Embeddings build script for Tier-B card-citation | 13 |
| **GAP-6** | DAILY + CULTURAL Learn article clusters (only 31 of expected articles) | 13 |
| **GAP-7** | Photo upload in Profile + display-name editor | 10 |
| **GAP-8** | In-app theme toggle UI (auto-mode only ships) | 12.5 |
| **GAP-9** | Full light-mode polish beyond amber-contrast fix | 12.5 |
| **GAP-10** | Parent (large-text read-only) persona — route exists, placeholder content | 5 / 17 |
| **GAP-11** | Live jailbreak red-team CI runner (80 fixtures shipped as static tests) | 17 |
| **GAP-12** | Holistic E2E test pass (Maestro) | 17 |
| **GAP-13** | Trends inline chart loading/error/empty state harmonisation | 16 |
| **GAP-14** | `runSingleStringCascade` adoption for daily-narration + reading-paragraph | 16 |
| **GAP-15** | Clinical-review-queue ambient-surface sampling | 12.5 |

### Quality / polish (low impact)

| ID | Item |
|----|------|
| **POL-1** | Hardcoded `90_000ms` watch timeout in `takeReading.ts:69` — make configurable / device-aware |
| **POL-2** | Hardcoded domain URLs (`leiko.app`, `pair.leiko.app`, `mailto:support@leiko.app`) scattered — extract to `config` module |
| **POL-3** | Caret-range dependencies in package.json — pin major.minor for stability |
| **POL-4** | `.gitignore` missing `google-services.json`, `GoogleService-Info.plist`, `expo-env.d.ts` |
| **POL-5** | SQL linting absent from CI |
| **POL-6** | `as unknown as` casts in `phi-scrub.ts` and screen-level navigation casts — type-narrow properly |
| **POL-7** | Sprint 7 TODO: server-side IANA timezone reconciliation |

---

## ✅ VERIFIED RESOLVED (audit confirmed)

These were flagged in prior sprint close-outs but were closed by
subsequent sprints. Verified against current code.

- BP cursor model (`syncBacklog.ts` uses `sinceTimestampSec: 0`) — Sprint 16.5a `b11c13b`
- Multi-vitals server-sync drain — Sprint 16.5c `17bcd93` (migration exists; needs **OPS-1** to deploy)
- HR/SpO2 wall-clock-as-UTC shift — Sprint 16.5d
- SpO2 single-byte parser — Sprint 16.5d
- Sleep page rebuild + server hydration — Sprint 16.5d
- Activity hydration + recent-list cap removal — Sprint 16.5e
- HR + SpO2 server hydration — Sprint 16.5e
- 7d/30d/90d wired on BP / HR / SpO2 / Activity — Sprint 16.5e
- Stale-caption explainer (all 4 detail screens) — Sprint 16.5f
- vitalBaselines utility (your-usual ranges) — Sprint 16.5f
- Auto-SpO2 default flipped to ON — Sprint 16.5b (inline)
- Self-buyer family auto-provision — Sprint 14.5
- Mobile error-mapping in Ask Leiko — Sprint 14.5
- pg_cron schedule for compute-correlations — Sprint 14.5 (migration committed; needs **OPS-2** GUCs)
- D12 light-mode amber contrast token — Sprint 14.5
- Watch timestamp UTC+8 quirk applied consistently — Active
- Trends Tier-C narrative engine — Sprint 16.5g
- Trends focal vital AI-picked + dynamic chart + baseline + Ask Leiko wiring — Sprint 16.5g
- ForYourDoctor: parent name + multi-vital gate + last-generated + offline + baseline — Sprint 16.5h
- ForYourDoctor: cover note wired through to Edge Function request — Sprint 16.5h
- ForYourDoctor: dynamic page count — Sprint 16.5h
- ForYourDoctor: locked-chip lock cue — Sprint 16.5h
- App version bump 0.0.0 → 1.0.0 — Sprint 16.5i `97bc8f9`
- useReducedMotion promise handler — Sprint 16.5i `97bc8f9`
- AskLeikoBody catch handler — Sprint 16.5i `97bc8f9`
- CaregiverHome server-hydration parity — Sprint 16.5i `a2b6bbc`
- Hardcoded en-US locale (4 screens) — Sprint 16.5i `1129bff`

---

## VERIFIED SAFE (audit confirmed nothing to do)

- **Secrets management** — zero hardcoded API keys, JWTs, or credentials in committed files. All env-var driven.
- **Hardcoded prod URLs** — none. Supabase URL, LiteLLM URL, all env-var driven.
- **Analytics PHI leakage** — sampled 15 most-common events; none log reading values. Compliant with CLAUDE.md data rule.
- **RLS policies** — every public table has strict RLS (no `USING (true)`). Service-role usage scoped per request.
- **account_type immutability** — DB trigger `users_account_type_immutable()` enforces. No mobile callsite tries to update.
- **Family invites** — email + 6-digit code only. No URL-token path exposed.
- **Edge Function auth** — all 16 functions validate JWT and scope by `auth.uid()` / family_id before any service-role query.
- **Console / logger PHI leaks** — none found. Sync console.log statements are gated by `__DEV__` via `BLE_TRACE`.
- **Data export + delete-account paths** — both implemented (export via OS share sheet; delete via `delete-account` EF with email confirmation + soft-delete).
- **Permission flows** (Bluetooth, notifications, health platforms) — all gated by user consent with rationale strings.
- **App identity consistency** — `com.leiko.care` bundle ID consistent across app.json, AndroidManifest, build.gradle. No leftover "kena" references.
- **Permissions declared** — BLUETOOTH_SCAN/CONNECT, POST_NOTIFICATIONS, all Health Connect read/write, foreground service flags. All present.

---

## RECOMMENDED LAUNCH PATH

**Week 1 — Founder ops (~1 day total):**
- Knock out OPS-1 through OPS-12. All small individually; total ~5-6 hours actual work.
- Resolve DEC-1 (the "diagnosis" string question).

**Week 2 — Engineering hardening:**
- SEC-1 (MMKV encryption) — 1-2 days
- FUN-1 (email transport) — 2 hours
- FUN-2 (hard-delete cron) — 1 hour
- QUA-1 (BP value mismatch fix) — 2 hours
- QUA-4 (CI deploy workflow) — half-day
- QUA-5 (iOS PrivacyInfo) — 1 hour
- QUA-6 (npm vulns) — half-day
- QUA-7 (store metadata) — 1 hour

**Week 3 — On-device validation:**
- FUN-7 (applyDeviceConfig verify) — 1 hour bench
- FUN-8 (background-fetch verify) — 1 hour bench
- Smoke test all 5 detail screens + Trends + For-your-doctor end-to-end on a real Plus account with multi-day server data.
- Submit App Store + Play Store builds.

**Week 4 — Review wait + post-launch monitoring:**
- App Store typically 24-72 hours.
- Play Store similar.
- Monitor crash reports, audit logs, Supabase Edge Function logs.
- Standby on FUN-3 (caregiver AI narration) for the first user-feedback iteration.

**Items explicitly deferred to v1.1:**
GAP-1 through GAP-15, POL-1 through POL-7. All documented; revisit
after launch metrics are in.

---

## SOURCES

- Code quality audit: agent run 2026-05-14 (4 P0 + 7 P1 + 4 P2)
- Security audit: agent run 2026-05-14 (0 P0 + 1 P1 + 0 P2)
- Build/deploy audit: agent run 2026-05-14 (3 P0 + 6 P1 + 5 P2)
- UX/voice/accessibility audit: agent run 2026-05-14 (2 P0 + 5 P1 + 1 P2)
- Deferred-items reconciliation: agent run 2026-05-14 (9 P0 + 10 P1 + 16 P2 + 17 resolved)

Memory references (read first for any follow-up on these items):
- `memory/sprint_16_5a_close_out.md` — BP cursor fix + open bugs queue
- `memory/sprint_16_5c_close_out.md` — multi-vitals partial-index fix
- `memory/sprint_16_5d_close_out.md` — HR/SpO2 timestamp + SpO2 single-byte
- `memory/sprint_16_5e_close_out.md` — multi-vital hydration + 7d/30d/90d
- `memory/sprint_16_5d_close_out.md` lists the 8 hard rules carried forward
- `memory/MEMORY.md` — index

---

*This is the launch-gating document. Update it as items close. Do not let "ready to launch" be vibes; let it be every P0 line crossed off.*
