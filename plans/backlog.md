# Backlog

Things deferred from sprints, plus the open technical questions from D7 §14. Track resolution per sprint.

> **2026-05-07 — Apple-of-Healthcare pivot.** D5 superseded by D11. D8 superseded by D12. New strategic docs D11, D12, D13, D14 in `docs/_reference/`. New sprints inserted: 1.5, 7.5, 7.6, 7.7, 8.5, 9.5, 12.5. See `plans/SPRINT_SEQUENCE.md` for the new ordering. Existing un-done sprints (8–17) updated to consume D11–D14 content.

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
| Q10 | ~~Apple Health / Google Fit — opt-in export at launch?~~ — **RESOLVED 2026-05-07: promoted to v1.0 per D13 §12 + new Sprint 9.5.** Two-way sync; Apple HealthKit + Android Health Connect both ship. App Store review surface accepted in exchange for the Apple-of-Healthcare credibility win. | Founder | Resolved | n/a |
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
| Q-D8a-2 | ~~Doctor-ready PDF: ship at v1.0 or v1.1?~~ — **RESOLVED 2026-05-07: v1.0, Plus only, multi-vital per D13 §10.2 + D14 §8.** | D8a §15 | Resolved |
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
- ~~**Multi-vitals ingest gap (BP-only today)**~~ — **RESOLVED 2026-05-07 by the Apple-of-Healthcare pivot.** Path (a) chosen: Sprint 7.5 funds the plumbing, Sprint 7.6 builds the component primitives, Sprint 7.7 rewrites Caregiver Home, Sprint 8 rewrites Self-Buyer Home, Sprint 8.5 ships the per-vital detail screens. Full multi-vital surface lands across Sprints 7.5 → 8.5. See D13 (Multi-Vitals Constellation Spec) for the implementation contract.

---

## Discrepancies to reconcile

### ~~CLAUDE.md vs D7 §12.2 — E2E tool~~ — RESOLVED 2026-05-05
Reconciled to **Maestro** in Session 0b. CLAUDE.md updated; tech-stack lock and `docs/13-testing-standard.md` already aligned. Decision: D7 §12.2 wins (canonical pin), Maestro is lighter for an app this size, Sprint 17 is the only consumer.

### `_specs/` folder fate
The original spec markdowns in `_specs/` are now duplicated in `docs/_reference/`. `_specs/` is currently in the repo as untracked. Decision needed: delete it, `.gitignore` it, or keep both. Default proposal: `.gitignore _specs/` so the founder retains the originals locally without shipping them to Git history.

---

## Open questions added by D11–D14 (2026-05-07)

### D11 (Brand Repositioning)
| # | Question | Default |
|---|---|---|
| Q-D11-1 | LEIKO trademark cleared (USPTO TESS Classes 9+10 · NIPC · domains · App Store · Play Store)? | Founder verifies before App Store listing prep (was already Q2 in D7 §14) |
| Q-D11-2 | Founder approves Tier 1 line: *"The premium pulse for families managing hypertension across distance — and for the person managing it themselves"*? | Yes — locked in D11 §6.1 |
| Q-D11-3 | Adaeze persona bracket shift to early 30s–early 40s confirmed? | Yes — locked in D11 §2.1.1 |
| Q-D11-4 | LEIKO logotype direction (lowercase wordmark, K-anchored, sans-serif geometric-with-warmth)? | Yes — D11 §4.3 sets direction; designer produces final |
| Q-D11-5 | Photography direction (real African and African-American families, not stock)? | Yes — D11 §5.7 |

### D12 (Visual System v2)
| # | Question | Default |
|---|---|---|
| Q-D12-1 | ~~Final dark canonical neutral hex value (recommended `#0A0F1A`)?~~ — **RESOLVED 2026-05-07: `#0A0F1A` (founder approved engineering default; no external designer engaged). Locked in D12 §2 + §15 + §17.** | Resolved |
| Q-D12-2 | ~~Final accent hex value (recommended `#E8A063`)?~~ — **RESOLVED 2026-05-07: `#E8A063` (founder approved engineering default). Locked in D12 §2 + §15 + §17.** | Resolved |
| Q-D12-3 | ~~Premium typeface licensing budget (Recoleta + Inter free; Söhne / Reckless Neue add ~$1,500–3,000)?~~ — **RESOLVED 2026-05-07: $0 budget. Inter-only (display + body + UI) + JetBrains Mono (numerics). Recoleta and Söhne/Reckless deferred to v1.1. See D12 §3.1.** | Resolved |
| Q-D12-4 | Phosphor as v1.0 iconography (defer custom icon set to v1.1)? | Yes per D12 §10.1 |
| Q-D12-5 | SVG → Skia migration path for VitalRing — ship SVG; profile; migrate if Pixel 6a < 55fps? | Yes per D12 §12.4 |
| Q-D12-6 | `motion.pattern.daily-pulse-reveal` once-per-session behaviour confirmed? | Yes per D12 §7.3 |

### D13 (Multi-Vitals Constellation Spec)
| # | Question | Default |
|---|---|---|
| Q-D13-1 | Default `target_steps` — 6,000 (vs typical 10,000)? | 6,000 — appropriate for hypertensive adults including elders |
| Q-D13-2 | HR samples: roll up to hourly bins server-side? | Yes — keep raw samples in MMKV for 7 days, write hourly aggregates to `vitals_other` |
| Q-D13-3 | Sleep score weighting formula adjustable post-launch? | Use D13 §6.4 formula at v1.0; reweight after 90 days of production data if needed |
| Q-D13-4 | Cross-vital correlation min sample size — 14 too aggressive? | 14 is the floor; first meaningful correlations appear ~2 weeks after activation |
| Q-D13-5 | Sleep hidden by default from caregivers in hybrid mode? | Yes — dignity choice per D13 §13.2 |

### D14 (Ambient AI Architecture)
| # | Question | Default |
|---|---|---|
| Q-D14-1 | Tier-A Llama instance hosting? | Hetzner GPU per `docs/00-tech-stack.md` |
| Q-D14-2 | Monthly baseline as push notification? | No — surfaced in Trends only; push fatigue concern |
| Q-D14-3 | Tier-C weekly summary length — 4 vs 6 sentences? | v1.0 ships 4–6 range; A/B test post-launch |
| Q-D14-4 | Daily narration cache TTL — 4h or 8h? | 4h — feels fresh, won't break user mental model |
| Q-D14-5 | Tier-B Plus quota raised 50 → 100/month? | Yes per D14 §1 |
| Q-D14-6 | Free Tier-B quota: 5/month (vs zero in `docs/07-ai-assistant.md` v1)? | Yes per D14 §1 |
