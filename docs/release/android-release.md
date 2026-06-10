# Android release — one-time setup + ongoing playbook

A single-source reference for cutting Leiko Android builds that the Play
Store will accept. Read this once, then `npm run release:android:aab`
forever after.

## Account policy — read this first

**Every external service for Leiko is signed up under
`primethebrain@gmail.com`.** That includes:

- Google Play Console (the $25 developer account)
- Google Cloud Console (Google OAuth client IDs, Play service account)
- Expo / EAS (`npx expo login` → `primethebrain`)
- RevenueCat
- Sentry
- PostHog
- Cloudflare (already set up for `dl.leiko.app`)
- Apple Developer (when iOS lands; not used yet)

When you onboard a new service, sign up under primethebrain. When you
hand a project off, transfer ownership to primethebrain. When a
recovery email lands in a different inbox, it is a bug — fix the
service's owner record, do not just forward the email.

To verify the local CLI session before a release:

```powershell
npx expo whoami     # must print: primethebrain
npx eas whoami      # must print: primethebrain, OR error "not logged in" (fine — first build will prompt)
```

If `expo whoami` returns anything else, run `npx expo logout` then
`npx expo login` and try again before continuing.

## One-time setup (you do this once and never again)

### 1. Generate the upload keystore

This file is the irreplaceable identity for every future Leiko Android
upload. Losing it means starting a new Play Store listing under a new
package name. Back it up to at least two places (1Password + an
encrypted USB is the usual move).

```bash
keytool -genkey -v \
  -keystore ~/secrets/leiko-release.jks \
  -keyalg RSA -keysize 2048 -validity 25000 \
  -alias leiko
```

`keytool` will prompt for two passwords (keystore + key) — use the same
one for both unless you have a reason not to. Write them in 1Password.

### 2. Create `~/secrets/leiko-release.env`

```bash
# Source this before any release build:  source ~/secrets/leiko-release.env

# Signing
export LEIKO_RELEASE_STORE_FILE=/Users/you/secrets/leiko-release.jks
export LEIKO_RELEASE_STORE_PASSWORD=...
export LEIKO_RELEASE_KEY_ALIAS=leiko
export LEIKO_RELEASE_KEY_PASSWORD=...

# Versioning — LEIKO_VERSION_CODE is the SINGLE source of truth for the
# Android versionCode. build.gradle reads it for every local build
# (`npm run release:android:aab` and a direct `gradlew bundleRelease`).
# app.json's android.versionCode is NOT read by local builds — only by
# `eas build`, which is not our release path; it is kept in sync only so an
# accidental EAS build can't leap the ledger. Bump this for every Play
# upload; it must be strictly greater than the highest versionCode already
# on the com.leiko.care corporate track. The package rename reset the
# ledger (vc2 live in open testing, vc4 current) — so the next upload is vc5.
export LEIKO_VERSION_CODE=5

# Required runtime env (app throws on boot without these)
export EXPO_PUBLIC_SUPABASE_URL=https://kqnzxjrpnjnczhgdwdqg.supabase.co
export EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Optional but strongly recommended
export EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
export EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
export EXPO_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
export EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...

# Sentry sourcemap upload (only needed if you want symbolicated traces)
export SENTRY_AUTH_TOKEN=...
export SENTRY_ORG=...
export SENTRY_PROJECT=leiko-mobile
```

The file is gitignored by default (under `~/secrets/`). Never commit it.

### Windows / PowerShell

`source` and the `export VAR=…` file above are bash-only. On Windows
PowerShell, set the vars with `$env:` instead (single-quote the values so
`$` or special chars in passwords aren't interpreted). Paste this once per
terminal session, filling in your own keystore path + passwords:

```powershell
# signing (your values)
$env:LEIKO_RELEASE_STORE_FILE     = 'C:\Users\admin\secrets\leiko-release.jks'
$env:LEIKO_RELEASE_STORE_PASSWORD = 'your-keystore-password'
$env:LEIKO_RELEASE_KEY_ALIAS      = 'leiko'
$env:LEIKO_RELEASE_KEY_PASSWORD   = 'your-key-password'
$env:LEIKO_VERSION_CODE           = '5'    # SINGLE source of truth; MUST be > the highest versionCode on the com.leiko.care track (vc4 current → next is 5)

# runtime — copy the exact value from apps/mobile/eas.json (build.production.env)
$env:EXPO_PUBLIC_SUPABASE_URL      = 'https://kqnzxjrpnjnczhgdwdqg.supabase.co'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = '<paste EXPO_PUBLIC_SUPABASE_ANON_KEY from eas.json>'

# optional
# $env:EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = 'goog_...'
```

Then run the build (PowerShell can't do bash's inline `VAR=x cmd` form, so
set the ACK var on its own line):

```powershell
npm run release:android:aab          # dry-run: prints the checks + plan, then stops
$env:LEIKO_RELEASE_ACK = 'yes'
npm run release:android:aab          # real build
```

Needs a **JDK 17** + the **Android SDK** on the machine (the same toolchain
any local Android build uses). If gradle complains about `JAVA_HOME` or the
SDK, that toolchain isn't installed — the easiest alternative is a cloud
build: `eas build -p android --profile production` (no local Android
toolchain needed; point EAS at your existing keystore via `eas credentials`).

### 3. First release build

```bash
cd apps/mobile
source ~/secrets/leiko-release.env

# Dry-run shows what will happen + lets you sanity-check the env:
npm run release:android:aab

# When the printout looks right, run it for real:
LEIKO_RELEASE_ACK=yes npm run release:android:aab
```

The script verifies your keystore is not the well-known Android debug
key, patches `versionCode` + `versionName` into `build.gradle` for the
duration of the build, runs `./gradlew bundleRelease`, and restores
`build.gradle` so the diff is never committed.

The output AAB lives at:

```
apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

Verify the signature:

```bash
apksigner verify --print-certs app/build/outputs/bundle/release/app-release.aab
```

The SHA-256 fingerprint should match the one you wrote in 1Password.

## Every release after the first

1. Decide the new `versionName` (`1.0.1` → `1.0.2`) and `versionCode`
   (must be strictly greater than the previous Play Store upload).
2. Update `apps/mobile/app.json` `expo.version` to the new
   `versionName` and commit.
3. Bump `LEIKO_VERSION_CODE` in your local env (or your CI secret).
4. `source ~/secrets/leiko-release.env`
5. `LEIKO_RELEASE_ACK=yes npm run release:android:aab`
6. Upload the AAB to the Play Console internal-testing track.

## APK vs AAB

- **AAB (`release:android:aab`)** is what the Play Store accepts.
- **APK (`release:android:apk`)** is what you sideload onto your own
  test device. Same signing config; just different gradle task.

## If the script complains

| Error | Fix |
| --- | --- |
| `Env var LEIKO_RELEASE_STORE_FILE is not set` | `source ~/secrets/leiko-release.env` |
| `LEIKO_RELEASE_STORE_FILE points at the well-known Android debug keystore` | You set the path to your repo's `apps/mobile/android/app/debug.keystore`. Point it at your real keystore instead. |
| `LEIKO_VERSION_CODE env var must be set to a positive integer` | `export LEIKO_VERSION_CODE=8` (or whatever the next integer is) |
| `Required runtime env var EXPO_PUBLIC_SUPABASE_URL is not set` | Source the env file. The app throws on boot without it. |

## When the manifest hardening regresses

The audit PR (#1) added `allowBackup="false"`, the legacy BLE
permissions, and `dataExtractionRules` directly to
`android/app/src/main/AndroidManifest.xml`. Those edits do **not**
survive `npx expo prebuild --clean`. Until we land a config plugin
that re-injects them, do not run `expo prebuild --clean` against this
repo without re-applying the audit-PR manifest diff afterwards. The
non-clean `npx expo prebuild` form preserves existing files.
