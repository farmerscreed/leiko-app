# npm audit allowlist

Sprint 16.6 QUA-6 — known-tolerated transitive vulnerabilities.

Last audited: **2026-05-14**

## Current state

`npm audit` reports 9 vulnerabilities (5 low, 4 moderate, 0 high, 0
critical). Every one is in a transitive build-time or test-time
dependency. None ship in the production APK. CI gates production
dependencies with `--audit-level=high`, so this allowlist exists
purely for human reference.

## The 9 transitive entries

### Moderate (4) — postcss XSS chain

`postcss <8.5.10` has an XSS via unescaped `</style>` in CSS
Stringify Output ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)).
The chain:

    postcss
    ↳ @expo/metro-config
       ↳ @expo/cli
          ↳ expo

The auto-fix path `npm audit fix --force` would downgrade us to
`expo@49.0.23`, a major version regression that loses:

- Expo SDK 56 features we depend on (new arch, the `privacyManifests`
  field, `eas build --local` profiles, the new notification handler
  shape).
- Two years of incremental fixes across `expo-notifications`,
  `expo-secure-store`, `expo-background-fetch`, etc.

Why we accept the risk: `postcss` runs only at build time inside
Metro's CSS pipeline. The published APK never invokes a postcss
codepath. The XSS vector requires an attacker to control the CSS
input being stringified, which on our build server requires either
a compromise of the source tree or of the dev dependency tree —
both pre-conditions that already grant the attacker far worse paths.

Remediation: upgrade to Expo SDK 57 once the channel lands a patch
release of `@expo/metro-config` that pins `postcss >=8.5.10`. Tracked
in PRODUCTION_READINESS.md (post-launch).

### Low (5) — jest-expo / jsdom chain

The Jest test-environment pulls jsdom which transitively pulls
`http-proxy-agent` + `@tootallnate/once`, both flagged at low
severity. Auto-fix downgrades `jest-expo` to 47, which removes our
ability to test against SDK 56 native modules. Tests never ship.

Remediation: tracks the same Expo SDK 57 upgrade — `jest-expo` 56+
should pull in the patched `jsdom`.

## Adding a new entry to the allowlist

Don't. If `npm audit` surfaces a new finding:

1. If high or critical: CI fails; fix the underlying dependency or
   reject the offending direct dependency.
2. If moderate or low and runtime-shippable: same — CI doesn't fail
   today but it should; raise to high severity in the workflow.
3. If moderate or low and dev-only: append to this document with
   a remediation note. The allowlist is not a backlog of "fix
   later" items — it is a record of decisions.

## CI invocation

The shipping step in `.github/workflows/ci.yml` is:

```
npm audit --omit=dev --audit-level=high
```

`--omit=dev` filters out the jest-expo and jsdom chain entirely
(they're dev dependencies). `--audit-level=high` then filters out
the postcss chain (it surfaces as moderate). Today this command
exits 0; if a real production high/critical lands, the build
breaks until it is addressed.
