# Start here — Sprint 16.6 caregiver session handoff

Last touched: 2026-05-15 Lagos.
Supersedes the 16.5e-era NEXT_SESSION_START_HERE.md.

## 90-second context

Sprint 16.6 (Pre-Launch Validation & Hardening) is **mid-flight**. A
two-phone rig is running and we've been iterating live on real
caregiver-flow issues the founder hits while testing. The branch is
`claude/competent-goldberg-737194`. Latest tip: `09cb9c8` (or newer
— check `git log`).

The bench right now:

- **Phone 1** (Pixel 8, serial `43230DLJH001YY`): self-buyer account
  `biebele@gmail.com`, Watch 1 paired, has real BP history.
- **Phone 2** (OnePlus Nord N30, serial `8fae80bc`): caregiver account
  `TheOne` (`lawonelimited@gmail.com`), no watch, just onboarded via
  the new "Add a watch later" path.
- **PC**: Supabase local stack on `192.168.0.166:54321`, Metro running
  from `apps/mobile/` with `EXPO_NO_METRO_WORKSPACE_ROOT=1` set (this
  env var is **non-negotiable** — see DO/DON'T below).

## What shipped this session

§B P1 hardening (in commit order):

| Commit    | Item                                                          |
|-----------|---------------------------------------------------------------|
| `69a87a6` | §A two-phone test rig (eas.json + build-preview-apk.ps1 + CAREGIVER_TEST_FLOW.md + CAREGIVER_TEST_RESULTS.md) |
| `1dc2670` | QUA-7 + QUA-5: store metadata + iOS PrivacyInfo               |
| `f91ecac` | FUN-2: hard-delete cron migration                             |
| `acf73af` | FUN-1: Resend email transport in send-family-invite           |
| `5e10b53` | QUA-1: 200ms BP settling delay after `0x73 0x02`              |
| `fcba36a` | FUN-4: learned-time reminder dispatcher wired                 |
| `e31c896` | QUA-6: npm audit allowlist + CI threshold                     |
| `f8aafcc` | QUA-4: CI deploy workflows (release.yml + db-migrate.yml)     |

Build-script + Metro plumbing (several iterations to crack the
Expo monorepo / workspace-root trap):

| Commit    | What                                                          |
|-----------|---------------------------------------------------------------|
| `d92a61d` | supabase status stderr → cmd /c                               |
| `cfc22d6` | project-root as positional arg                                |
| `10b1108` | positional arg goes LAST (Expo's reverse-parser)              |
| `3acab17` | drop `--variant release` (pivot to debug variant)             |
| `2b766de` | pick up debug APK output dir                                  |
| `bdad3a4` | drop URL-rewrite, rely on EXPO_NO_METRO_WORKSPACE_ROOT=1      |

Onboarding redesign — all 6 intros + watch-step fix:

| Commit    | What                                                          |
|-----------|---------------------------------------------------------------|
| `d90a425` | `OnboardingHero` component + 6 intros (Caregiver Intro 1/2/3 + Self-Buyer Intro 1/2/3); Phosphor duotone icons, radial-glow halo, displayXl + cinematic entrance |
| `2eea415` | Hero typography tightened to fit Nord (360pt wide)            |
| `83caf5c` | "Add a watch later" third option on Caregiver FamilyWatch (fixes the blocker where remote caregiver had no honest path) |

Caregiver Home — bug + contrast:

| Commit    | What                                                          |
|-----------|---------------------------------------------------------------|
| `221f19c` | Bug: tapping a parent card with a cross-phone reading no longer routes to ReadingDetail (which can't find the local reading). Falls through to ParentReadings. PLUS contrast bumps on PersonCard (vital tiles + sentence + footer). |
| `ea0cfe8` | Contrast bumps on bird's-eye ConstellationLegend + CaregiverActionBar |
| `55fa006` | Bigger/weightier names on PersonOrb (constellation orb labels) |
| `1dfdd99` | Swap orb names from editorial serif to Inter SemiBold (serif at 400-only was rendering thin against dark) |
| `35b311f` | Palette lift: dark-mode `text.primary` cream `#F5F1EA` → pure white `#FFFFFF`; secondary + tertiary similarly lifted |
| `09cb9c8` | Clear halo bleed below orb so names render without clipping   |

## What's mid-flight (not yet verified)

The **caregiver Home contrast pass** is committed but the founder
hasn't visually confirmed on the phone yet. Last screenshot before
the handoff still showed the orb names rendering with what looked
like a blue-grey cool tone instead of crisp white — either:

- the dev-client cached an older bundle and never re-fetched after
  the palette change, OR
- Android screencap is rendering dark content with a cool-tinted
  compression artifact and the user actually sees white on device.

**Pickup test:** plug a phone in, run the build script if not already
installed, open caregiver Home in BIRD'S-EYE view, look at the orb
labels ("Biebele" / "Mome"). They should be **white sans-serif Inter
SemiBold**, fully visible below each orb's halo, same color as
"ALL CLEAR" pill text. If they're still dim/italic/clipped, the
bundle on the phone is stale — uninstall + reinstall the APK (loses
auth state, requires re-sign-in via Mailpit OTP) to force a fresh
bundle.

## Issues the founder raised that are still open

Numbered in priority order:

1. **Invite-code UX for incoming caregivers.** The "I have an invite
   code" entry point is buried in Settings → Family. A non-technical
   caregiver finishing onboarding won't find it. Founder approved
   path: empty-state CTA on caregiver Home + an optional step at the
   end of caregiver onboarding ("Has someone invited you? Enter the
   code now"). Not started.

2. **Settings page colors + caregiver/self-buyer parity.** Founder
   reports the Settings page is hard to read and caregiver Settings
   looks different from self-buyer Settings. Need Phone 2 Settings
   screenshot to diff against Phone 1. Probably the same
   palette-bump + tertiary→secondary pattern from this session, but
   verify before changing.

3. **Phone 1 family-invite call fails.** Error toast "we couldn't
   send invite, try again" when `biebele` tries to invite from
   Phone 1. Edge Function logs show
   `TypeError: Invalid Token or Protected Header formatting` in
   `verifyHybridJWT`. Phone 1's auth token is in a legacy format the
   current edge runtime can't decode. Founder tried sign-out and
   that itself returned "Network request failed" — see issue 4.

4. **Phone 1 sign-out network failure.** Probably a stale bundle
   from when `.env.local` still had `localhost:54321`. Should be
   fixed by force-reloading Phone 1 against the current Metro, but
   we never got back to verify because the contrast iteration took
   over.

5. **DEC-1 (founder decision).** From PRODUCTION_READINESS.md.
   `docs/05-voice-and-claims.md` mandates the exact phrase
   "It is not a diagnosis" on the doctor-PDF cover line. CLAUDE.md
   voice rules forbid the word "diagnosis". Founder needs to pick:
   keep the mandated phrase (exempt with a comment) OR reframe to
   "This report is general information. Talk to your doctor about
   what it means." Five-minute commit either way.

6. **SEC-1 MMKV encryption.** Still deferred from §B. Card budgets
   1-2 days; this is the only multi-day item left in §B. Skipped
   intentionally this session in favour of unblocking the founder
   on real testing.

## Where the docs live

- **`plans/PRODUCTION_READINESS.md`** — launch-gating checklist.
  Every P0 + P1 + P2 item. The "Recommended launch path" at the
  bottom is the current week-by-week plan.
- **`plans/sprint-16-6-pre-launch-validation.md`** — this sprint's
  card. Has §A (test rig), §B (P1 list), §C (founder ops parallel
  track), §D (test execution), §E (DEC-1).
- **`plans/CAREGIVER_TEST_FLOW.md`** — 12-scenario test plan for
  the two-phone bench. Pickup point if you're continuing the
  testing run.
- **`plans/CAREGIVER_TEST_RESULTS.md`** — empty template. Founder
  fills as they go.

## DO / DON'T for picking up

**DO:**
- Start Metro from `apps/mobile/` with the env var:
  `cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client`
- Set `adb reverse tcp:8081 tcp:8081` + `tcp:54321 tcp:54321` on
  any phone before launching the dev-client. The reverses clear on
  USB disconnect; re-apply on replug.
- Build the APK via `scripts/build-preview-apk.ps1` from the
  *main checkout* path
  (`C:\Users\admin\Documents\APP\kena-app`), not from inside the
  `.claude/worktrees/...` subtree. Worktree-path Gradle resolution
  is documented broken for `react-native-purchases` 8.x — see the
  build-script header.
- Commit each logical change separately, push, then
  `git fetch && git checkout origin/claude/competent-goldberg-737194`
  inside the main checkout so Metro picks up the change.

**DON'T:**
- Don't start Metro WITHOUT `EXPO_NO_METRO_WORKSPACE_ROOT=1`. Without
  it, Expo's `getMetroServerRoot` walks up to the workspace root
  and the dev-client's virtual-entry bundle 500s with
  `Unable to resolve module ../../App`.
- Don't `npm audit fix --force`. The only auto-fix is a downgrade
  to Expo 49; the moderate-severity postcss chain is documented as
  build-tooling-only in `docs/_reference/npm-audit-allowlist.md`.
- Don't re-enable the metro.config.js URL rewrite that was deleted
  in `bdad3a4`. With the env var set, serverRoot = projectRoot and
  the rewrite would double-prefix and 404 every bundle request.
- Don't restart the Supabase docker stack while the founder is
  testing. The local anon key changes on restart and every bundle
  needs to be rebuilt with the new key in `.env.local`.

## Memory files to read first

In order of decreasing relevance:

1. **`memory/sprint_16_5e_close_out.md`** — the multi-vitals
   hydration pattern is load-bearing on every detail screen + Home.
2. **`memory/sprint_16_5d_close_out.md`** — the eight hard rules.
3. **`memory/running_on_phone.md`** — USB / Wi-Fi / adb-reverse
   recipes. The MTN-extender trap is real but the founder confirmed
   it's NOT active right now (Phone 2 = `MTN-5G-CD3D3E`, PC =
   different SSID but same router, ping works at 12–25ms).

## Open prompt (what to say to the next session)

> Sprint 16.6 mid-flight on `claude/competent-goldberg-737194`.
> Read `plans/NEXT_SESSION_START_HERE.md` first, then the active
> sprint card `plans/sprint-16-6-pre-launch-validation.md`. The
> founder is bench-testing live on two phones; the most recent
> blocker is contrast/legibility on caregiver Home — last commit
> (`09cb9c8`) is committed but not visually verified on device.
> Pick up by verifying the orb-name render on Phone 2 and routing
> to issue #1 (invite-code UX) or issue #2 (Settings parity) per
> the founder's call.
