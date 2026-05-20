# Launch Artifacts Log

Authoritative record of build artifacts produced for v1.0.0 launch.
Each entry captures: artifact URL, build profile, version code, target
backend, and what it gets used for. Sensitive creds (keystore
password / alias / key password) live in 1Password as
"Leiko Android Release Keystore" — never in this file.

Update this log every time a new build artifact is produced.

---

## Android

### v1.0.0 (versionCode 2) — production `.aab` for Play Console

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/5n4GUMxhcrLa5Z6Cgz9Cqr.aab |
| **EAS profile** | `production` |
| **Build type** | `app-bundle` (Android App Bundle) |
| **versionName** | `1.0.0` |
| **versionCode** | `2` (auto-incremented from `1`) |
| **EAS credentials slot** | `Build Credentials 5ZIwDWM1fJ` (default) |
| **Built** | 2026-05-20 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Anon key (in binary)** | `eyJ...8aSY` (last 4 chars — full key in `eas.json` production env, public by design) |
| **Status** | Awaits upload to Play Console → Internal Testing track |
| **Used for** | Submitting to Play Store via `eas submit` or manual upload. Not directly installable on a phone — `adb install` rejects AAB. |

### v1.0.0 (versionCode 3) — production-apk `.apk` for bench install

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/kQ5uMNfwz7P6517WuvkAbW.apk |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds/a0941b42-c9bf-47ac-b2b7-6c64d59acf0a |
| **EAS profile** | `production-apk` (extends `production`, overrides `buildType: apk`) |
| **Build type** | `apk` (single-file install) |
| **versionName** | `1.0.0` |
| **versionCode** | `3` (auto-incremented after the AAB's `2`) |
| **EAS credentials slot** | Same as the AAB above |
| **Built** | 2026-05-20 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Status** | Built; pending Phone 1 install + smoke test (Block 4) |
| **Used for** | `adb install` on Phone 1 (Pixel 8, `43230DLJH001YY`) for Block 4 smoke test — uninstall dev build first; the keystore mismatch will reject a side-load over the dev install. |

---

## iOS

_No iOS builds yet — Block 6.1 Apple Developer entitlements + `expo prebuild --platform ios` (needs a Mac) must land first. Track on next addition._

---

## Submission state

| Store | Track / Tier | Status | First submission |
|---|---|---|---|
| Play Store | Internal Testing | ⏳ Not yet uploaded | TBD |
| Play Store | Closed Testing (Alpha) | ⏳ Not yet | TBD |
| Play Store | Production | ⏳ Not yet | TBD |
| App Store | TestFlight Internal | ⏳ Awaits iOS build | TBD |
| App Store | TestFlight External | ⏳ Awaits iOS build | TBD |
| App Store | Production | ⏳ Not yet | TBD |

---

## Notes

- **AAB vs APK:** Play Store wants AAB (smaller install footprint, per-device APK splitting). adb wants APK (single-file install). Same keystore signs both — they're equivalent artifacts from a signing-identity perspective.
- **Auto-increment behaviour:** `eas.json` has `cli.appVersionSource = remote` and `production.autoIncrement = true`. Every prod build bumps versionCode by 1 in EAS's remote ledger. Don't manually edit `android/app/build.gradle:96` versionName — `app.json:5` (currently `1.0.0`) is the source of truth and EAS propagates it.
- **Anon key in binary is fine:** `EXPO_PUBLIC_SUPABASE_ANON_KEY` ships in every APK; it's a public client key, RLS is the actual security boundary. Service role key, DB password, third-party API keys never enter the binary — they're in supabase secrets (server-side) + GitHub Actions secrets (CI).
- **Keystore loss = nuclear:** If `Build Credentials 5ZIwDWM1fJ` is lost AND the 1Password backup is gone, the app can never be updated on Play Store again. Two layers of redundancy already (EAS Cloud + 1Password); a third on an encrypted external drive would not be overkill.
