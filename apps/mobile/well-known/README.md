# Universal Links + App Links assets

These files must be hosted at the `leiko.app` domain at the following URLs so iOS Universal Links and Android App Links can verify the association:

- `https://leiko.app/.well-known/apple-app-site-association`
- `https://leiko.app/.well-known/assetlinks.json`

Per `docs/11-push-notifications.md` §3.

## Before hosting

- `apple-app-site-association`: replace `TEAMID` with the Apple Developer Team ID for `com.leiko.app`.
- `assetlinks.json`:
  - ✅ **Upload-key fingerprint is filled in** (`84:13:9B:…:28`, from
    `keytool -list` on `leiko-release.jks`, 2026-06-02). This covers
    sideloaded / upload-key-signed installs (internal/dev).
  - ⬜ **Still required:** replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`
    with the SHA-256 from Play Console → Test and release → Setup →
    **App signing** → *App signing key certificate*. This is the one that
    matters for Play-distributed installs, because Play re-signs the app
    with its own key. You only get it **after the first AAB upload**.
  - After both are set, host the file (see below) and verify.

## Verification

- iOS: `swcutil dl -d leiko.app` from a Mac.
- Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://leiko.app&relation=delegate_permission/common.handle_all_urls`.
