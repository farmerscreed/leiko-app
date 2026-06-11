// Visible sync-nudge push — the reliable, human-confirmed fallback for
// remote-refresh.
//
// Android does NOT guarantee delivery of the silent, data-only
// 'sync_refresh' push (see _shared/silent-push.ts) to a backgrounded /
// Doze app — even high-priority, even with a live BLE foreground service.
// Remote refresh is therefore SILENT-FIRST: a caregiver's pull-to-refresh
// sends the silent push, and only if that doesn't surface fresh data — and
// the caregiver then chooses "send a reminder" — does request-sync escalate
// to this VISIBLE notification: the system delivers it reliably, and the
// wearer taps it to open the app and sync. (The automatic 3-hourly cron
// always stays silent — it must never nag the wearer.)
//
// The message carries data { type: 'sync_refresh' } on purpose:
//   - Foregrounded wearer → expo's received-listener auto-runs the sync and
//     setNotificationHandler suppresses the banner (it already special-cases
//     this type) → silent, no interruption.
//   - Backgrounded wearer → the OS shows the tray notification; the tap
//     fires the response-listener which runs the sync.
// One message, both paths.
//
// HARD RULES per CLAUDE.md + docs/05-voice-and-claims.md:
//   - Carries NO PHI — never a reading value, only the requester's name.
//   - The rendered title + body still pass through send-push's voice-lint
//     (fail-closed) before egress; this module only produces the copy.

/** Used when the requester's display name is missing/blank. */
export const SYNC_NUDGE_FALLBACK_NAME = 'Your family';

/** Names longer than this are clamped so the body stays within the
 *  push length budget (PUSH_BODY_MAX_ANDROID = 180). */
const MAX_NAME_LEN = 40;

export interface RenderedNudge {
  title: string;
  body: string;
}

/**
 * Wearer-facing copy. Voice-approved (founder, 2026-06-11): warm,
 * dignified, leads with who asked, then the action. No fear language.
 */
export function renderSyncNudge(requesterName?: string | null): RenderedNudge {
  const raw = (requesterName ?? '').trim().slice(0, MAX_NAME_LEN);
  const name = raw.length > 0 ? raw : SYNC_NUDGE_FALLBACK_NAME;
  return {
    title: 'Leiko',
    body: `${name} would love to see your latest reading. Tap to sync your watch.`,
  };
}

export interface SyncNudgeMessage {
  to: string;
  title: string;
  body: string;
  // The tap/foreground sync trigger — the SAME type the silent path uses,
  // so the client's existing handlers recognise it. No PHI.
  data: { type: 'sync_refresh' };
  // Android: routed through the existing 'family' channel (DEFAULT
  // importance — visible + sound, not a heads-up alarm).
  channelId: 'family';
  priority: 'high';
  sound: 'default';
  // iOS interruption level — a routine, non-urgent nudge.
  interruptionLevel: 'active';
}

export function buildSyncNudgeMessages(
  expoTokens: string[],
  rendered: RenderedNudge,
): SyncNudgeMessage[] {
  return expoTokens.map((to) => ({
    to,
    title: rendered.title,
    body: rendered.body,
    data: { type: 'sync_refresh' },
    channelId: 'family',
    priority: 'high',
    sound: 'default',
    interruptionLevel: 'active',
  }));
}
