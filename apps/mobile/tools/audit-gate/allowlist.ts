// npm audit allowlist — executable form of
// docs/_reference/npm-audit-allowlist.md.
//
// An entry here is a RECORD OF A DECISION, not a backlog item. To add
// one you must be able to say why the advisory cannot reach the
// shipped APK. If you cannot, fix the dependency instead.
//
// Every entry expires. Past `reviewBy` the gate fails on it again, so
// a suppression cannot outlive the reasoning behind it.

export interface AllowlistEntry {
  /** npm package the advisory is filed against. */
  package: string;
  /** Why it cannot reach the shipped app. Be specific. */
  reason: string;
  /** ISO date after which this suppression stops being honoured. */
  reviewBy: string;
}

/**
 * Build-time and test-time toolchain. None of these execute in the
 * published APK: Metro, Babel and the Expo CLI run on the build
 * machine and emit a JS bundle; the bundle contains none of them.
 *
 * All of them are reachable only by someone who already controls the
 * build machine or the source tree — a position that grants strictly
 * worse capabilities than any of these advisories.
 *
 * The standing remediation for the whole set is the Expo SDK 54 → 57
 * upgrade (see docs/_reference/npm-audit-allowlist.md), which is
 * scoped work with its own device-regression pass, not a dependency
 * bump. npm's own `audit fix --force` resolves these by DOWNGRADING
 * react-native 0.81.5 → 0.72.17, which is why it must never be run
 * on this repo.
 */
export const ALLOWLIST: AllowlistEntry[] = [
  {
    package: '@babel/core',
    reason:
      'Babel transforms source on the build machine. The APK ships the emitted bundle, not Babel.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'brace-expansion',
    reason:
      'Glob expansion inside Metro/Expo CLI file resolution. Build-time only; patterns come from our own config.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'image-size',
    reason:
      'Metro reads image dimensions while bundling. Build-time only; inputs are our own assets.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'js-yaml',
    reason:
      "Our own devDependency is patched (4.3.1). The remaining flagged copy is js-yaml 3.14.2 nested under @istanbuljs/load-nyc-config, reached only via react-native -> babel-jest -> babel-plugin-istanbul when computing test coverage. It parses our own coverage config, never user input, and never ships. npm overrides do not reach it in this workspace layout (tried package-scoped, nested and version-scoped forms).",
    reviewBy: '2026-11-30',
  },
  {
    package: 'nanoid',
    reason: 'ID generation inside Metro/PostCSS build tooling. Not reachable from app code.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'postcss',
    reason:
      "Metro's CSS pipeline at build time. The APK never invokes a postcss codepath (per the Sprint 16.6 decision).",
    reviewBy: '2026-11-30',
  },
  // Added 2026-10-29 (PR #30): five advisories published after the
  // gate went green on 2026-08-19. All five resolve only under Expo's
  // build toolchain (`npm ls`): none is bundled into the APK.
  {
    package: '@xmldom/xmldom',
    reason:
      'Plist parsing in @expo/cli (@expo/plist) and @expo/config-plugins (xcode -> simple-plist). Prebuild/build-time only; parses our own Info.plist, never user input, never ships.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'browserslist',
    reason:
      'Target resolution inside @expo/metro-config and Babel (core-js-compat). Build-time only; queries come from our own config.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'compression',
    reason:
      'HTTP middleware in the @expo/cli dev server. Development only — no server runs in a release build.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'node-forge',
    reason:
      'Used by @expo/code-signing-certificates inside @expo/cli for EAS Update signing tooling. Build-time only; the app does no RSA verification with it.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'source-map-js',
    reason:
      "Source-map handling in postcss under @expo/metro-config. Build-time only; maps are our bundler's own output.",
    reviewBy: '2026-11-30',
  },
  // Added 2026-10-30 (GHSA-qr28-fpjm-wq7f, published that day). Unlike the
  // build-time entries this one IS bundled: @react-navigation/core ->
  // query-string@7 -> decode-uri-component@0.2.2. It is reached only via
  // getStateFromPath/getPathFromState, which run only when
  // NavigationContainer has a `linking` config — Leiko's does not
  // (navigation/RootNavigator.tsx); incoming URLs go through our own
  // services/notifications/deepLinkParser. The fixed 0.5.1 is ESM-only and
  // query-string@7 require()s it, so an override would break link parsing.
  // If a `linking` prop is ever added, this entry is WRONG — remove it.
  {
    package: 'decode-uri-component',
    reason:
      'Bundled via @react-navigation/core -> query-string, but only reachable through NavigationContainer `linking`, which Leiko does not configure; deep links use our own parser. DoS-only. Fixed version is ESM-only and cannot be overridden under query-string@7.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'shell-quote',
    reason:
      'Expo CLI shells out during builds. Build-time only; the arguments are ours, not user input.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'tar',
    reason: 'Archive handling in Expo CLI / prebuild tooling. Build-time only.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'undici',
    reason: 'HTTP client inside Expo CLI tooling. The app uses fetch via React Native, not undici.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'uuid',
    reason: 'ID generation inside Expo CLI tooling. App-side IDs come from our own code.',
    reviewBy: '2026-11-30',
  },
  {
    package: 'ws',
    reason:
      "Metro's dev-server websocket and React DevTools. Development only — the dev server is not part of a release build.",
    reviewBy: '2026-11-30',
  },
];
