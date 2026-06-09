// Tests for the silent remote-refresh push builder. Imports from
// ../_shared/silent-push.ts (not index.ts) so Deno.serve never starts.

import { assertEquals } from 'jsr:@std/assert@1';
import { buildSilentSyncMessages } from '../_shared/silent-push.ts';

Deno.test('buildSilentSyncMessages: one message per token', () => {
  const msgs = buildSilentSyncMessages(['ExpoTok[a]', 'ExpoTok[b]']);
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0].to, 'ExpoTok[a]');
  assertEquals(msgs[1].to, 'ExpoTok[b]');
});

Deno.test('buildSilentSyncMessages: empty in, empty out', () => {
  assertEquals(buildSilentSyncMessages([]), []);
});

Deno.test('buildSilentSyncMessages: silent — no title, no body, no PHI', () => {
  const [msg] = buildSilentSyncMessages(['ExpoTok[x]']);
  // Nothing renders: a data-only message carries neither title nor body.
  assertEquals('title' in msg, false);
  assertEquals('body' in msg, false);
  // Background-wake flags.
  assertEquals(msg._contentAvailable, true);
  assertEquals(msg.priority, 'high');
  assertEquals(msg.sound, null);
  // The ONLY payload is the refresh type — no reading values, no PHI.
  assertEquals(msg.data, { type: 'sync_refresh' });
  assertEquals(Object.keys(msg.data), ['type']);
});
