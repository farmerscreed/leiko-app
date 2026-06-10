# ADR-0010: send-push uses verify_jwt=false + an internal shared secret

- **Status**: Accepted (founder decision 2026-06-10)
- **Date**: 2026-06-10
- **Affects**: `supabase/functions/send-push`, `_shared/internal-auth.ts`,
  and every caller of send-push (`request-sync`, `request-stale-syncs`,
  `detect-anomaly`, `manage-family-membership`)
- **Evidence / context doc**: `plans/REMOTE_REFRESH_FIX_2026-06-10.md`

## Context

`send-push` is Leiko's single Expo egress: it is never called by the mobile
app directly, only by other edge functions. Those callers invoked it with
`Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (the auto-injected env
key) while `send-push` had `verify_jwt=true`.

leiko-prod has the **new Supabase API key scheme** enabled (publishable key
is `sb_publishable_…`). Under it the injected `SUPABASE_SERVICE_ROLE_KEY` is
**not a JWT** — it authenticates to PostgREST/the DB (so the callers' own DB
work succeeded) but **fails the platform `verify_jwt` gate**, which 401s the
function-to-function call before `send-push`'s handler runs. Net effect:
**no push of any category had ever dispatched** (remote-refresh, anomaly,
family) — confirmed by zero `push.sent` rows in `audit_log` and
`request-stale-syncs` returning `{scanned:1, requested:0}`, while a direct
call with a real JWT returned `{outcome:"sent"}`.

## Decision

Deploy `send-push` with **`verify_jwt=false`** and re-lock it with an
**internal shared secret** instead of relying on the platform JWT gate:

- `supabase/functions/_shared/internal-auth.ts` holds the contract: the
  `x-leiko-internal` header carries `LEIKO_INTERNAL_PUSH_SECRET` (a function
  secret, set via `supabase secrets`, never in the repo).
- Callers attach it with `withInternalHeader()`. `send-push` validates it
  with `isAuthorizedInternal()`, which **fails closed** — if the secret is
  unset, nothing is authorized, so a misconfigured deploy rejects rather than
  silently exposing send-push to the public internet.

Alternatives considered and rejected:
- **Keep verify_jwt=true, fix the bearer** (forward the caller's JWT, or give
  cron a legacy-JWT secret): more moving parts, and the cron path has no user
  JWT to forward.
- **verify_jwt=false only** (no shared secret): simplest, but leaves
  send-push invokable by anyone who knows the URL. The shared secret closes
  that for a one-line-per-caller cost.

## Consequences

- Remote-refresh, anomaly, and family pushes now dispatch (server path proven
  in prod: `requested:1` + `push.sent`).
- Any **new** edge function called by another edge function must use this same
  pattern — do not depend on `SUPABASE_SERVICE_ROLE_KEY` as a bearer across a
  `verify_jwt` boundary on this project. (Memory: `edge-fn-verify-jwt-new-api-keys`.)
- `send-push` is now only as protected as `LEIKO_INTERNAL_PUSH_SECRET`. It
  must stay set in prod and be rotated like any secret; it carries no PHI.
- Does **not** by itself prove device delivery — Expo→FCM→device is tracked
  separately (REMOTE_REFRESH_FIX_2026-06-10 §④).
