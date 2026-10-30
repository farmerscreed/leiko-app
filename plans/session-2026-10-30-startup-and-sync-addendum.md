# 2026-10-30 addendum — home card + Trends copy, verified on device

Build from fd45239 installed on the Pixel 8 (`adb install -r`, data kept).

- Home (bird's-eye + cards): wearer "Lawrence" → pill **BP reading due**,
  headline **Last BP 31 days ago** (HR syncing every ~15 min, last cuff
  reading 31 d). Mom / Ibifi (no watch data in 12 h) → unchanged
  **No recent reading** — correct.
- Trends "Your story": **Your weekly summary will appear here once it's
  ready.** (was "Weekly summary not yet available — Tier-C is gated in this
  environment.").
- `compute-weekly-summary` and `compute-monthly-baseline` deployed by the
  founder 2026-10-30 ~12:15 PDT: new placeholder copy; cached placeholders
  are regenerated once Tier-C is enabled.
- Settings → Watch → Last sync: "Just now".

Ready for: merge PR #30 → `npm run release:android:aab` with the upload
key (LEIKO_VERSION_CODE=21) → verify signer + versionName 1.1.0 → Play
Internal testing. Follow-ups listed in
`plans/session-2026-10-27-startup-and-sync.md` (2026-10-30 section).
