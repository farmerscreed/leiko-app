# Release audit — v1.1.0, 2026-10-30

Founder's ask: *"be extremely sure that all … points I pointed out are fixed
… and go through every feature and ensure it's all intact"* before the
Play Store push. This is the full record: what was checked, what was found,
what was fixed (with PRs), what is deployed, and what is still open.

Device: founder's Pixel 8 over wireless adb (bridge below). Account:
lawonecloud@gmail.com (caregiver + wearer, Plus). Server: Supabase
`kqnzxjrpnjnczhgdwdqg`.

---

## 1. Founder-reported issues — status

| # | Reported | Root cause | Fix | Verified on device |
|---|---|---|---|---|
| 1 | App "keeps loading" at launch | No timeout / no failure branch in auth hydrate; JS thread pegged by cold-start watch sync | PR #30 (`STARTUP_HANG_FIX_2026-10-27.md`) | ✅ no spinner hang; cold start ~0.2 s to first frame |
| 2 | Watch doesn't sync in the background | RN pauses JS timers when the app is backgrounded → supabase-js refresh hung | PR #30 (keep-alive headless task) | ✅ uploads with app closed; Settings "Last sync: Just now" |
| 3 | "Keep readings arriving" sheet hid its button | Sheet content not scrollable, no bottom inset | PR #30 (BottomSheet) | ⚠️ code + tests; not re-seen on device (only shows after pairing) |
| 4 | "Last sync 31 days ago" (Settings + Home) | Settings showed the BP history cursor; Home headline used BP age only | PR #30 (`lastWatchSync`, `bp_due` status) | ✅ Settings "Just now"; Home "BP reading due · Last BP 32 days ago" |
| 5 | Trends showed developer text | Placeholder copy from compute-weekly/monthly | PR #30 + founder deploy | ✅ "Your weekly summary will appear here once it's ready." |
| 6 | Timezone should follow location | Profile tz fixed at onboarding (Africa/Lagos while in LA) | PR #32 — profile tz follows the phone on sign-in + every foreground | ✅ switched to America/Los_Angeles on sign-in |

## 2. Found during the audit — fixed

### Release blockers (PR #31, merged; migration applied)
- **Release AAB had no RevenueCat key** — env name mismatch
  (`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` vs `EXPO_PUBLIC_RC_API_KEY_ANDROID`).
  App reads both; `release-android.js` now *requires* a `goog_` key.
- **compute-correlations failed per user (23514)** — three matrix types
  (PR #28) never added to the check constraint. Migration
  `0059_correlation_types_matrix.sql` (applied via db-migrate.yml;
  21:00 UTC run clean).

### Stale data shown as current (PR #32)
- Person overview hero: time only ("8:54 PM") for a 32-day-old reading →
  date added after 24 h.
- Vital details "Last sync Mon" → "Last reading …", date after 7 days.
- BP detail: "in your usual range" beside "Learning · 0 of 10" → unit only
  while learning; learning card says "recent readings".
- BP "Recent readings" empty text names the range when older readings exist.
- Trends letter claimed "in your usual range" unconditionally → only when
  the window's BP average is inside the band; else neutral / "Not enough
  blood pressure readings this week…". ✅ seen on device.

### Contradictions / wrong rendering (PR #32)
- HR: overview "Worth a look" vs detail "In your usual range" for the same
  72 bpm → detail uses the same truth-layer verdict (`classifyVital`).
- Movement band "usual 0–7763" → "usual up to 7,763". ✅
- **`theme.type()` tokens used directly as styles** (60+ sites): RN ignored
  `size`/`family`, so text rendered in the system font at 14 sp and could
  clip ("Steady is a finding" lost "too."). Tokens now carry
  `fontSize`/`fontFamily`. ✅ Inter everywhere, clip gone.
- Settings showed literal `\u2019`. ✅
- Person overview flashed "No readings yet" while loading → loading state.
- Take a reading: "Reaching the watch" had no way out → Cancel.
- For your doctor: "6 pages" for a 4-page PDF → "PDF".
- Settings: "Apple Health & Health Connect" → platform-specific.

### AI (PRs #32, #33 — see ADR-0013)
- Ask Leiko + doctor-prep AI died with 546 "CPU Time exceeded" → Layer-2
  cluster vectors precomputed. ✅ ai-tier-b and generate-doctor-prep-ai 200.
- Ask Leiko then refused every question → Layer-2 threshold calibrated
  0.75 → 0.885. ⏳ needs deploy (below).

### Doctor PDF accuracy (PRs #32, #33)
- "2 of 7 nights" in a 30-day report → "only 2 nights observed in this period".
- Cover paragraph described a 32-day-old BP as part of the 30-day report →
  prompt dates the reading and marks one outside the range.
- "Resting 82 bpm" was the mean of daily *median* HR across all samples →
  labelled "Daily median".

### Home (PR #33)
- Centre "YOU" label printed over the wearer's name → moved above the orb.
  ⏳ needs rebuild to see.

## 3. Features walked on device (build from PR #32, Play-key signed)

Sign-in (founder), Home bird's-eye + cards, person overview, BP / HR /
SpO2 / Sleep / Activity details (7d/30d/90d), Trends (story, letter,
evidence, vital switcher), Learn (clusters, article), Ask Leiko, For your
doctor (preview, generate, view), Connect (code minted, sheet buttons
visible), Settings (profile, watch, vital streams, goals, notifications,
accessibility, about links → leiko.health/terms|privacy|support all live),
watch connection + background sync.

**Not exercised:** a fresh BP measurement (watch misbehaving — founder will
use another watch); paywall / purchase (account is already Plus);
offline launch (unit-tested; would need toggling the phone's radios).

## 4. Deploy state

| Component | State |
|---|---|
| main | `661f882` (PR #33 merged) |
| DB migrations | 0001–0056, 0058, 0059 applied |
| Edge functions (PR #32 code) | deployed by founder 2026-10-30 22:40 UTC: ai-tier-b, ai-daily-narration, compute-monthly-baseline, compute-weekly-summary, generate-doctor-prep-ai, generate-doctor-pdf |
| Edge functions (PR #33 code) | **⏳ founder to deploy** the same six (threshold + PDF fixes) |
| Phone | Play-key-signed build of PR #32 (installed after uninstall; founder re-signed in + re-paired) |
| Play | nothing uploaded from this round |

Deploy command (from `D:\APP\kena-app`):
```powershell
npx supabase functions deploy ai-tier-b ai-daily-narration compute-monthly-baseline compute-weekly-summary generate-doctor-prep-ai generate-doctor-pdf --project-ref kqnzxjrpnjnczhgdwdqg
```

## 5. Release steps from here

1. Deploy the six functions (above). Verify on device: Ask Leiko answers
   "Why is my blood pressure higher in the morning?"; a new doctor PDF has
   no out-of-range BP claim and says "Daily median".
2. Build the AAB from main: release env (`leiko-release.ps1`, phc_ PostHog
   key — never the phx_ personal key), `LEIKO_VERSION_CODE=23`,
   `LEIKO_RELEASE_ACK=yes`, `npm run release:android:aab`.
3. Verify the AAB: signer SHA-256 `CF:65:9F:68…78:65`, versionCode 23,
   versionName 1.1.0, bundle contains `goog_` and `phc_` keys and the prod
   Supabase ref.
4. Upload to **Internal testing**; install on the Pixel from Play (it is
   already Play-key signed, so it updates in place); spot-check; promote.

## 6. Still open (not release-blocking unless noted)

- **Security advisor (ERROR level, pre-existing):** RLS disabled on
  `content_slots`, `content_competitors`, `competitor_posts`,
  `content_ideas`, `content_archive`, `audit_log_default`; anon-executable
  SECURITY DEFINER functions incl. `hard_delete_expired_users`,
  `invoke_*_cron`, `ops_daily_deposits`, `families_needing_refresh`; 20
  RLS-enabled tables without policies; mutable `search_path` functions;
  leaked-password protection off. Not touched this round — needs a
  migration the founder approves (check what the content machine uses
  first; enabling RLS could break it). **Recommend before public launch.**
- PostHog: revoke the `phx_` personal key; keep only the `phc_` project key
  in `leiko-release.ps1`.
- Layer-2 margin is thin (ADR-0013) — grow the calibration set.
- "Reaching the watch" can stall when the watch misbehaves (connecting
  also runs config push + backlog sync). Cancel added; root cause not
  investigated.
- First Home load after sign-in: `home.fetchParentSummaries` 3.6 s with
  ~0.8 s JS stalls.
- Earlier follow-ups (`session-2026-10-27-startup-and-sync.md`):
  cold-start deferral bypassed by app_foreground, `mv.hrAcceptChunk` 1.2 s
  for 2 samples, Doze background cadence.
- Copy decisions for the founder: Settings "Diagnosed with hypertension?"
  (copy-lint allowlisted, flagged for review); Trends "this time" for the
  All range; §7.7 learning copy now says "recent readings" (was verbatim
  spec).

## 7. Working notes (how this was done)

- **Phone bridge:** `D:\APP\tools\adb-bridge.bat` loops on
  `D:\APP\tools\bridge\cmd.txt` → `out.txt` (adb commands only). Wireless
  device now advertises as `adb-43230DLJH001YY-UbzUe4._adb-tls-connect._tcp`
  (the ip:port form stopped resolving mid-session).
- **Signing:** a PowerShell window that dot-sourced `leiko-release.ps1`
  makes `assembleRelease` sign with the Play upload key too. The phone now
  carries the Play-key build, so future test APKs must be built the same
  way (or uninstall first).
- **No model access from the cloud container/VM** (huggingface blocked);
  embeddings were produced in the founder's Chrome via the
  `tools/guard-embeddings/*.html` pages.
- Production deploys, prod DB reads and merges need the founder's explicit
  go-ahead in this setup; the founder ran the deploys.
