# Backlog

Things deferred from sprints, plus the open technical questions from D7 §14. Track resolution per sprint.

## Open technical questions (D7 §14)

| # | Question | Owner | Target | Default if unanswered |
| --- | --- | --- | --- | --- |
| Q1 | Anthropic BAA signed for Claude API healthcare use? | Founder | Before Week 8 of build | Tier B/C disabled in production until signed; Tier A only available in production |
| Q2 | Brand name LEIKO verified via USPTO TESS, NIPC, .com/.app/.health domains, App Store, Play Store? | Founder | Before Week 2 | Hold app name as code-name "Leiko" but do NOT begin App Store listing prep |
| Q3 | Urion firmware UI customization scope (parallel track) | Founder + Urion (James Lee) | Non-blocking | Watch ships with supplier-default firmware; LawOne customisations land in v1.1 |
| Q4 | 510(k) Letter of Authorisation from K141683 holder | Founder | Before Week 4 | CANNOT ship to US without — escalate to D3 if blocking |
| Q5 | Clinical advisor for AI prompt and copy-lint review | Founder | Before Week 12 | Ship without if unavailable; founder owns review pass; flagged as a risk |
| Q6 | Hetzner read replica in Helsinki — provisioned? | Founder / DevOps | Before launch | Single region (Frankfurt) at launch; replica deferred 60 days |
| Q7 | PostHog self-hosted stack on existing Hetzner — sized correctly? | DevOps | Before Week 6 | Use PostHog Cloud free tier as fallback if Hetzner sizing inadequate |
| Q8 | Pen-test before launch? | Founder | Optional | Defer to post-launch unless MAU > 1,000 (D6 §6.2) |
| Q9 | Twilio account for phone OTP? | Founder | Optional V2 | Skip in v1; email OTP only |
| Q10 | Apple Health / Google Fit — opt-in export at launch? | Founder | Before App Store submission | Defer to v1.1; reduce App Store review surface |
| Q11 | RevenueCat IAP product setup for Sprint 10 | Founder | Before Sprint 10 | Sprint 10 cannot ship without |
| Q12 | AWS Device Farm BLE units — account provisioned? | DevOps | Before Week 8 | Manual device testing only; risk accepted |
| Q13 | PagerDuty / on-call rotation — single-founder MVP? | Founder | Before launch | Founder is on call 24/7 at launch; alerts escalate to personal phone |

> **Sprint-1 go/no-go gate** (D7 §14): Sprint 1 cannot begin until Q2 (brand name verified) and Q4 (510(k) LoA) are resolved. Other questions can defer to their targets.

---

## Open design questions

| # | Question | Source | Sprint to resolve |
| --- | --- | --- | --- |
| Q-D8-1 | Display font: Recoleta vs Fraunces (free fallback) | D8 §2.2.1 | Sprint 2 (depends on Latinotype licensing decision) |
| Q-D8-2 | High-contrast theme variant for parent mode | D8 §10 | v1.1 |
| Q-D8a-1 | Should the welcome fork (D8a §3.1) be skippable for users who arrive via a caregiver invitation link? | D8a §15 | End of Sprint 2 — **default Yes**: invitation link sets `account_type=parent` before fork screen renders |
| Q-D8a-2 | Doctor-ready PDF: ship at v1.0 or v1.1? | D8a §15 | End of Sprint 3 — **default v1.0** (lead paywall lever for self-buyer) |
| Q-D8a-3 | Year-of-birth optional or required? | D8a §15 | End of Sprint 4 (after clinical advisor hire — Q5) — **default optional at v1.0** |
| Q-D8a-4 | Should the home FAB "Take a Reading" appear for caregiver mode if there's a single parent? | D8a §15 | End of Sprint 5 — **default No**: caregivers don't take readings; consistency wins |
| Q-D8a-5 | Hybrid-mode "first-view toast" copy and timing | D8a §15 | End of Sprint 4 — **default**: show only on the very first view from each invited caregiver, never repeat |
| Q-D8a-6 | Self-buyer onboarding 4.2.6 share surface: PDF only, or also shareable link? | D8a §15 | End of Sprint 5 — **default PDF only at v1.0** (deeplink share is V2) |
| Q-D8a-7 | Self-buyer medication tracking feature? | D8a §15 | V2 review — **default No at MVP** (outside cleared IFU) |
| Q-D8a-8 | Self-buyer paywall: lead with PDF export or full-history? | D8a §15 | End of Sprint 3 (test in beta) — **default PDF export leads, full-history second** |
| Q-D9-6 | Cluster A Learn articles — clinical advisor sign-off gate | D9 §10.1 | Blocked on Q5 |

---

## Items deferred from sprints

(Populated as sprints discover items not in their scope. Each item lists: from which sprint, why deferred, target sprint to resolve.)

- ~~**Bundle ID mismatch**~~ — RESOLVED 2026-05-06 in Sprint 0 closer. Ran `npx expo prebuild --clean`; android/ regenerated with `applicationId 'com.leiko.app'` and package source tree at `com/leiko/app/`. Verified with a clean install on Pixel 8 — `adb shell pm list packages | grep leiko` shows `com.leiko.app`, app launches and renders App.tsx content. iOS folder was wiped by --clean; whoever picks up iOS work on a Mac will run `npx expo prebuild --platform ios` to regenerate it (normal Expo flow).
- **Augment `scripts/install-toolchain.ps1` with Android tooling** — the script currently installs only Node, Supabase CLI, GitHub CLI. A fresh machine also needs JDK 17 (Temurin), Android Studio, and Windows Long Path Support enabled (`HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1`) before `npx expo run:android` works. **Long Path Support is non-obvious and silently breaks NDK extraction**. Add elevated-pass winget installs for `EclipseAdoptium.Temurin.17.JDK` + `Google.AndroidStudio` and a `Set-ItemProperty` for the long-paths registry key. Target: **Sprint 17** (launch prep), so any fresh-machine onboarding before submission has a one-shot setup script. *(From Sprint 0 simulator setup, 2026-05-06.)*
- **Icon library — Phosphor (or alternative)**. Sprint 1 deferred all Phosphor icons because no icon library is in the locked stack. Current placeholders: `›` (U+203A) chevron in ListRow navigation, `✓` (U+2713) check in ListRow select, `×` close button in BottomSheet, `<ActivityIndicator>` swap for the Phosphor `CircleNotch` loading spinner in Button, and a colour-only flip on Pill `selected` (the spec wants a 12pt Phosphor `Check`). Pick a library (`@expo/vector-icons` is Expo-blessed and ships Phosphor among others, or `phosphor-react-native` direct), pin in `docs/00-tech-stack.md`, then swap the four placeholder sites in one PR. Target: **Sprint 7** (caregiver-home) or earlier if a real screen lands first. *(From Sprint 1, 2026-05-06.)*
- **`expo-system-ui` package**. `npx expo prebuild` warns: *"android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature."* `app.json` has `userInterfaceStyle: "automatic"` but the package isn't installed, so Android can't honour it. Low risk now (we're not respecting OS dark mode anyway), but Sprint 2 onboarding is the natural moment to add it: `npx expo install expo-system-ui` then re-run prebuild. *(From Sprint 1, 2026-05-06.)*
- **Card and Button — animated press feedback**. Spec calls for "scale 0.98 over `motion.fast`" on Card press and Button press. Sprint 1 shipped both with **static** transforms via `Pressable`'s `({pressed})` callback because no animation library was in the stack at the time. ADR-0004 added `react-native-reanimated`, so the upgrade path is now a one-file change per component: drive the scale from a `useSharedValue` + `withTiming(0.98, { duration: theme.duration('fast') })`. Target: **Sprint 11** (AI Tier B polish) or whichever sprint first complains about press jank. *(From Sprint 1, 2026-05-06.)*
- **BottomSheet polish backlog** — three deferred behaviours from Sprint 1: (a) `'full'` sizing variant (Sprint 1 chose to defer per spec note "prefer a navigation push"), (b) drag-UP-to-expand to 90/95% on `default`/`tall` sizes, (c) `'swipeable'` Card variant (needs gesture-handler usage on Card). Group these for a **dedicated polish PR** when the first real BottomSheet consumer (Inline Explainer in Sprint 11+) lands and reveals which are actually needed. *(From Sprint 1, 2026-05-06.)*
- **"Watch already paired to another phone" UX** — Sprint 7 architecture intent §6.1 calls out this edge case (BLE 1:1 means a second pairing attempt loses with `AUTH_FAIL`; we should surface "This watch is already paired to {other_user_name}'s phone"). Deferred from Sprint 7 because it requires a `devices` row look-up by MAC during the failed-pair flow, and the canonical write of `devices.paired_by_user_id` happens in `/sync` Edge Function — wiring the read-side without a clean pairing-time write is brittle. Resolve once the device-row write is moved into the pairing handshake (likely alongside the parent-side install flow when scenario 2 from intent §1 ships). *(From Sprint 7, 2026-05-07.)*
- **Server-side timezone reconciliation** — Sprint 6's `WATCH_FIRMWARE_OFFSET_SEC = 8h` lives at the device in `services/sync/syncBacklog.ts` (`watchTimestampToUtcSec`). Sprint 7 intent §5 calls for moving this into the `/sync` Edge Function next to `users.timezone` so it survives the user travelling. Deferred from Sprint 7 because the on-device fix is verified working in Lagos (memory/watch_timestamp_quirk.md) and a server-side rewrite without a focused sprint risks regressing live timestamps. *(From Sprint 7, 2026-05-07.)*
- **Multi-vitals ingest gap (BP-only today)** — the Urion U16 watch captures BP, HR, SpO2, sleep, steps, and calories. `docs/01-data-model.md` `vitals_other` and `docs/06-ble-protocol.md` §3 (14 commands) cover all of these. The current app implements only `readBPHistory` + the BP write path — the other 10 BLE wrappers don't exist, the notify handlers for HR/SpO2/steps/sports are dead code paths, `vitals_other` is empty in production, and `/sync` only accepts a `ReadingPayload`. **No sprint card in 1–17 funds the multi-vitals work.** Founder-flagged 2026-05-07 at Sprint 7 closeout: this gets a dedicated next-session redesign (NOT a Sprint 7 deliverable). Two paths to choose between: (a) "Sprint 7.5 — Multi-vitals ingest plumbing" then Sprint 8 grows to surface the constellation, or (b) maximalist Sprint 7.5 that lands plumbing + UI in one move. Full handoff context in `memory/multi_vitals_gap.md`. *(From Sprint 7, 2026-05-07.)*

---

## Discrepancies to reconcile

### ~~CLAUDE.md vs D7 §12.2 — E2E tool~~ — RESOLVED 2026-05-05
Reconciled to **Maestro** in Session 0b. CLAUDE.md updated; tech-stack lock and `docs/13-testing-standard.md` already aligned. Decision: D7 §12.2 wins (canonical pin), Maestro is lighter for an app this size, Sprint 17 is the only consumer.

### `_specs/` folder fate
The original spec markdowns in `_specs/` are now duplicated in `docs/_reference/`. `_specs/` is currently in the repo as untracked. Decision needed: delete it, `.gitignore` it, or keep both. Default proposal: `.gitignore _specs/` so the founder retains the originals locally without shipping them to Git history.
