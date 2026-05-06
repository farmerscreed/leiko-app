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

---

## Discrepancies to reconcile

### ~~CLAUDE.md vs D7 §12.2 — E2E tool~~ — RESOLVED 2026-05-05
Reconciled to **Maestro** in Session 0b. CLAUDE.md updated; tech-stack lock and `docs/13-testing-standard.md` already aligned. Decision: D7 §12.2 wins (canonical pin), Maestro is lighter for an app this size, Sprint 17 is the only consumer.

### `_specs/` folder fate
The original spec markdowns in `_specs/` are now duplicated in `docs/_reference/`. `_specs/` is currently in the repo as untracked. Decision needed: delete it, `.gitignore` it, or keep both. Default proposal: `.gitignore _specs/` so the founder retains the originals locally without shipping them to Git history.
