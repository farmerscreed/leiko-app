# Universal Links + App Links assets

These files must be hosted at the `leiko.app` domain at the following URLs so iOS Universal Links and Android App Links can verify the association:

- `https://leiko.app/.well-known/apple-app-site-association`
- `https://leiko.app/.well-known/assetlinks.json`

Per `docs/11-push-notifications.md` §3.

## Before hosting

- `apple-app-site-association`: replace `TEAMID` with the Apple Developer Team ID for `com.leiko.app`.
- `assetlinks.json`: replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` with the SHA-256 fingerprint Google reports under Play Console → Setup → App integrity → App signing key certificate. If you use the upload keystore for sideloads (dev / internal), add its fingerprint as the second entry.

## Verification

- iOS: `swcutil dl -d leiko.app` from a Mac.
- Android: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://leiko.app&relation=delegate_permission/common.handle_all_urls`.
