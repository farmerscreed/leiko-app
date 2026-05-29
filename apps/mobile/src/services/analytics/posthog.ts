// PostHog adapter. Loaded lazily so the pure-jest project can pull
// services/analytics/logger.ts without bridging react-native.
//
// Wiring rules (CLAUDE.md + docs/00-tech-stack.md):
//   • Env-gated. EXPO_PUBLIC_POSTHOG_API_KEY missing → adapter no-ops
//     and the logger keeps writing to the existing MMKV ring buffer.
//   • Self-hosted host. EXPO_PUBLIC_POSTHOG_HOST may end in /, with or
//     without /capture; we hand it to the SDK verbatim.
//   • Autocapture and session replay are NEVER enabled. Screen names
//     can themselves leak vital-shaped context; we capture only the
//     typed events the logger declares.
//   • Reading values (BP / HR / SpO2) NEVER reach this layer — the
//     logger's compile-time event union enforces that. This file does
//     not re-scrub; that's the responsibility of every call site.
//
// Init contract: capturePosthog() is safe to call before initPosthog()
// resolves. Calls made before the client is ready are written to the
// existing MMKV ring buffer (same place we already buffered while
// PostHog was un-wired) and drained on the first successful init.

import type { PostHog as PostHogType } from 'posthog-react-native';

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;

let client: PostHogType | null = null;
let initPromise: Promise<PostHogType | null> | null = null;
let nativeLoadFailed = false;

interface PostHogModule {
  new (apiKey: string, options?: Record<string, unknown>): PostHogType;
}

function loadNative(): PostHogModule | null {
  if (nativeLoadFailed) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('posthog-react-native');
    return (mod?.default ?? mod) as PostHogModule;
  } catch {
    nativeLoadFailed = true;
    return null;
  }
}

/**
 * Idempotent init. Resolves to the client on success, null on any
 * misconfiguration (missing env, missing native module, init error).
 * The first call kicks off the underlying SDK; subsequent calls share
 * the same promise so the caller can `await` from anywhere without
 * worrying about double-init.
 */
export function initPosthog(): Promise<PostHogType | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!API_KEY) return null;
    const Native = loadNative();
    if (!Native) return null;
    try {
      client = new Native(API_KEY, {
        host: HOST,
        // Disable everything that could leak context the user did not
        // opt into. Screen / lifecycle autocapture stays off because
        // route names already carry product semantics (e.g. ParentReadings).
        captureAppLifecycleEvents: false,
        // Disable native session replay outright; the SDK respects
        // this flag even when the dashboard has replays enabled.
        disabled: false,
      });
      return client;
    } catch {
      return null;
    }
  })();
  return initPromise;
}

export function getPosthog(): PostHogType | null {
  return client;
}

/**
 * Bind / clear PostHog identity. Called from the auth store on every
 * status transition. Identity is the Supabase user id — no email, no
 * raw user metadata. The set of stitched attributes mirrors the
 * RevenueCat identify call so PostHog dashboards can pivot on
 * account_type without joining to Supabase.
 */
export function linkPosthogToUser(
  userId: string | null,
  attrs?: { accountType?: string | null; familyId?: string | null },
): void {
  if (!client) return;
  if (userId) {
    client.identify(userId, {
      account_type: attrs?.accountType ?? null,
      family_id: attrs?.familyId ?? null,
    });
  } else {
    client.reset();
  }
}

export function capturePosthog(name: string, props?: Record<string, unknown>): void {
  if (!client) return;
  // The SDK's PostHogEventProperties type is JSON-only; the upstream
  // event union already constrains values to JSON-safe primitives, so
  // we narrow with a cast rather than threading JsonType through the
  // logger's typed union.
  client.capture(name, (props ?? {}) as Parameters<PostHogType['capture']>[1]);
}

/** Test surface — resets module state between jest runs. */
export function _resetPosthogForTests(): void {
  client = null;
  initPromise = null;
  nativeLoadFailed = false;
}
