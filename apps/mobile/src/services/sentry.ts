// Sentry wiring. Single entry point invoked from App.tsx before any
// other render-time code runs.
//
// Design choices:
//   • Env-gated. Without EXPO_PUBLIC_SENTRY_DSN we no-op so dev / CI /
//     bare clones don't pollute a real project's event quota.
//   • beforeSend strips obvious vitals + email patterns. The
//     analytics layer (services/analytics/logger.ts) is already
//     careful never to put bp/hr/spo2 values into props; this layer
//     is the second line of defence against an accidental
//     console.log() ending up in a Sentry breadcrumb.
//   • No PII tagging at init. Auth state binds the Supabase user id
//     once the session hydrates (see linkSentryToUser below) so we
//     can stitch crashes to a user without their email landing in
//     Sentry's UI.
//   • Release tag mirrors app.json expo.version so a regression
//     bisects cleanly across builds.
//
// Per CLAUDE.md data rule: reading values (BP / HR / SpO2) NEVER
// appear in analytics. The PHI scrub here is belt-and-braces for
// breadcrumbs and unhandled exceptions, where developer-authored
// log statements could otherwise leak.

import * as Sentry from '@sentry/react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appJson = require('../../app.json') as { expo?: { version?: string } };

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const RELEASE = `leiko-mobile@${appJson.expo?.version ?? '0.0.0'}`;

let initialised = false;

// Replace numeric vitals-shaped values in any string payload before it
// leaves the device. Triggers only on the literal field names we
// emit, so a coincidental "systolic" in a longer English sentence
// inside a Sentry message stays readable.
const PHI_KEY_RE = /\b(systolic|diastolic|pulse|sys|dia|bpm|spo2|sample_value|reading_value)\s*[:=]\s*-?\d+(\.\d+)?/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function scrubString(s: string): string {
  return s
    .replace(PHI_KEY_RE, (m) => m.replace(/-?\d+(\.\d+)?$/, '[redacted]'))
    .replace(EMAIL_RE, '[redacted-email]');
}

function scrubBreadcrumb(b: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (typeof b.message === 'string') b.message = scrubString(b.message);
  if (b.data && typeof b.data === 'object') {
    for (const k of Object.keys(b.data)) {
      const v = b.data[k];
      if (typeof v === 'string') b.data[k] = scrubString(v);
    }
  }
  return b;
}

export function initSentry(): void {
  if (initialised) return;
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: __DEV__ ? 'development' : 'production',
    // Conservative defaults. Performance tracing off in v1 because
    // we have no SLOs and don't want quota burn.
    tracesSampleRate: 0,
    // Send default PII OFF; we never want IP / user-agent stitched
    // to events. Identity is set explicitly via linkSentryToUser.
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },
    beforeSend(event) {
      if (event.message) event.message = scrubString(event.message);
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = scrubString(ex.value);
        }
      }
      return event;
    },
  });
  initialised = true;
}

/**
 * Bind / clear the Sentry user id. Called from the auth store's
 * _setSession on every status transition so crashes can be stitched
 * to a Supabase row id without exposing the email.
 */
export function linkSentryToUser(userId: string | null): void {
  if (!initialised) return;
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/** App-tree wrap. Used as the default export from App.tsx so any
 *  render-side crash becomes a Sentry event. No-op when Sentry isn't
 *  configured — Sentry.wrap returns the component unchanged in that
 *  case. */
export const wrapWithSentry = Sentry.wrap;
