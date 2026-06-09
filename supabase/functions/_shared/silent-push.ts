// Silent remote-refresh push payload builder. Lives in _shared (not in
// send-push/index.ts) so tests can import it without triggering the
// Deno.serve at index.ts module load — same pattern as quiet-hours.ts.
//
// The one invariant worth guarding: a silent sync push carries NO title,
// NO body (so nothing renders) and NO PHI — only { type: 'sync_refresh' }.

export interface SilentPushMessage {
  to: string;
  data: { type: 'sync_refresh' };
  priority: 'high';
  _contentAvailable: true;
  sound: null;
}

export function buildSilentSyncMessages(expoTokens: string[]): SilentPushMessage[] {
  return expoTokens.map((to) => ({
    to,
    data: { type: 'sync_refresh' },
    priority: 'high',
    _contentAvailable: true,
    sound: null,
  }));
}
