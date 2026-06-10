// Internal function-to-function auth for send-push.
//
// send-push is deployed with verify_jwt=false: under this project's new
// API-key scheme the auto-injected SUPABASE_SERVICE_ROLE_KEY is not a JWT,
// so the platform's verify_jwt gate 401s every function-to-function call
// (request-sync / request-stale-syncs / detect-anomaly / manage-family-
// membership), which is why no push ever dispatched. Turning the JWT gate
// off would make send-push publicly invokable, so we re-lock it with a
// shared secret: callers send the header, send-push checks it.
//
// The secret lives in the LEIKO_INTERNAL_PUSH_SECRET function secret (set
// via `supabase secrets set`, never in the repo). It carries no PHI.

export const INTERNAL_HEADER = 'x-leiko-internal';

/** The shared secret from the environment ('' when unset). */
export function internalSecret(): string {
  return Deno.env.get('LEIKO_INTERNAL_PUSH_SECRET') ?? '';
}

/** Merge the internal-auth header into a caller's outbound headers. */
export function withInternalHeader(
  headers: Record<string, string> = {},
): Record<string, string> {
  return { ...headers, [INTERNAL_HEADER]: internalSecret() };
}

/**
 * True when the request carries the correct internal secret. Fails closed:
 * if the secret is unset, NOTHING is authorized (so a misconfigured deploy
 * rejects rather than silently opening send-push to the world).
 */
export function isAuthorizedInternal(req: Request): boolean {
  const expected = internalSecret();
  return expected.length > 0 && req.headers.get(INTERNAL_HEADER) === expected;
}
