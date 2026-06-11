# ADR-0011: remote refresh is silent-first with a human-confirmed visible fallback

- **Status**: Accepted (founder decision 2026-06-11)
- **Date**: 2026-06-11
- **Affects**: `supabase/functions/request-sync`, `supabase/functions/send-push`
  (new `sync_nudge` category), `_shared/sync-nudge.ts`,
  `apps/mobile/src/screens/Home/ParentDashboard.tsx`,
  `apps/mobile/src/screens/Home/useRemoteRefreshNudge.ts`,
  `apps/mobile/src/services/sync/requestRemoteRefresh.ts`,
  `apps/mobile/src/services/notifications/listeners.ts`
- **Evidence / context doc**: `plans/REMOTE_REFRESH_FIX_2026-06-10.md` §④
- **Builds on**: ADR-0010 (send-push internal auth)

## Context

"Remote refresh" lets a remote caregiver pull-to-refresh on a parent's
dashboard and have the parent's phone sync the watch over BLE — ideally
without the parent doing anything. It was implemented as a pure **silent,
data-only FCM push** (`sync_refresh`, see `_shared/silent-push.ts`).

Android does **not guarantee delivery of silent data-only messages to a
backgrounded / Doze app** — even high-priority, even with a live BLE
foreground service. Controlled testing (REMOTE_REFRESH_FIX §④) showed the
backgrounded phone woke only sometimes. The Nigeria market skews to
aggressive-OEM devices (Transsion/Tecno/Infinix, Xiaomi) where silent data
delivery is least reliable. So a pure-silent design cannot be "reliable" for
a meaningful slice of real users.

A visible notification, by contrast, the OS delivers reliably even in Doze —
but a visible notification on *every* caregiver refresh nags the wearer and
undermines the dignity goal.

## Decision

**Silent-first, with a human-confirmed visible fallback.**

1. A caregiver pull-to-refresh sends the **silent** `sync_refresh`
   (`request-sync` default, `escalate=false`). Foreground / battery-opt-exempt
   phones sync invisibly; nothing is shown.
2. The caregiver screen (`useRemoteRefreshNudge`) watches its Realtime feed.
   If fresh data lands within ~20s, the wearer was never touched — done.
3. If no fresh data arrives, the screen offers the **caregiver** a calm
   "Send a reminder" row. Only that **deliberate caregiver tap** escalates to
   the **visible** `sync_nudge` (`request-sync` with `escalate=true`) — a
   tappable notification ("{name} would love to see your latest reading. Tap
   to sync your watch.") the wearer taps to sync. The nudge carries
   `data.type='sync_refresh'`, so the client's existing foreground + tap
   handlers run the BLE sync.

The automatic 3-hourly cron (`request-stale-syncs`) is unchanged — always
silent; it must never nag.

### Why human-confirmed, not auto-escalate

Auto-escalating "when silent failed" requires reliably detecting whether the
phone **woke**. The only signals available are flawed:
- **"No new reading arrived"** conflates *didn't wake* with *woke but the
  watch had nothing new* — so it would false-nag the wearer whenever they
  simply hadn't measured. That violates the no-unnecessary-push / dignity
  rule (CLAUDE.md anti-patterns).
- **A server-written wake-ack** (e.g. `devices.last_sync_at`) is the correct
  signal but is non-trivial here: that column is RLS-gated to the family
  **owner** (`is_family_owner`), which in caregiver mode is **not** the
  wearer, and it is currently a dead field never written by `/sync`. Reviving
  it means editing the hot ingest path — out of scope and higher risk.

The human-confirmed path needs neither: the caregiver, a human looking at a
stale screen, decides. Its only detection input — "did fresh data arrive?" —
just gates whether to *offer* the reminder, never whether to *send* it, so
its imperfection is harmless (worst case: the offer shows and the caregiver
ignores it).

Alternatives considered and rejected:
- **Always-visible on explicit refresh**: reliable, but nags the wearer on
  every refresh even when silent would have worked.
- **Auto-escalate on "no new data"**: false-nags on the common "hadn't
  measured" case.
- **Auto-escalate on a `last_sync_at` ack**: correct but requires editing
  `/sync` + an RLS path; revisit if/when that field is revived for other
  reasons.

## Consequences

- The wearer is invisible-synced when possible, reliably reachable when not,
  and never false-nagged. The caregiver path no longer silently fails in Doze.
- New `send-push` category `sync_nudge` runs the full visible pipeline
  (opt-out under `family_activity` · voice-lint · quiet-hours hold · 24h/3
  rate limit). Copy lives in `_shared/sync-nudge.ts`; it carries no PHI.
- `request-sync` input grew an optional `escalate?: boolean`. Old clients that
  omit it get the silent push (backward compatible) — so the prod deploy of
  `send-push` v20 + `request-sync` v5 is safe ahead of the v5 client.
- The client orchestration (`useRemoteRefreshNudge`, the "Send a reminder"
  row, the tap-handler) ships in the **v5 build**; the server is live now.
- Whether the *silent* path alone is now adequate (token registration +
  `EXPO_ACCESS_TOKEN` + battery-opt exemption coexist for the first time in
  v5) is an open empirical question — see the v5 retest checklist in
  `plans/V5_BUILD_HANDOFF_2026-06-10.md`. If silent proves reliable on the
  primary devices, the nudge simply rarely shows; the design needs no change.
