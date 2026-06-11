// Tests for the visible sync-nudge fallback. Imports from sync-nudge.ts
// and voice-lint-push.ts only (no index.ts) so Deno.serve never starts.

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  renderSyncNudge,
  buildSyncNudgeMessages,
  SYNC_NUDGE_FALLBACK_NAME,
} from './sync-nudge.ts';
import { lintPushText, PUSH_BODY_MAX_ANDROID } from './voice-lint-push.ts';

Deno.test('renderSyncNudge: leads with the requester name then the action', () => {
  const { title, body } = renderSyncNudge('Adaeze');
  assertEquals(title, 'Leiko');
  assertStringIncludes(body, 'Adaeze would love to see your latest reading.');
  assertStringIncludes(body, 'Tap to sync your watch.');
});

Deno.test('renderSyncNudge: blank / missing name falls back to "Your family"', () => {
  for (const name of [undefined, null, '', '   ']) {
    const { body } = renderSyncNudge(name);
    assertStringIncludes(body, `${SYNC_NUDGE_FALLBACK_NAME} would love to see`);
  }
});

Deno.test('renderSyncNudge: a very long name stays within the push body budget', () => {
  const { body } = renderSyncNudge('A'.repeat(200));
  assert(
    body.length <= PUSH_BODY_MAX_ANDROID,
    `body ${body.length} > ${PUSH_BODY_MAX_ANDROID}`,
  );
});

Deno.test('renderSyncNudge: title + body pass voice-lint (no fear / claim words)', () => {
  const { title, body } = renderSyncNudge('Tunde');
  assertEquals(lintPushText(title).passes, true);
  assertEquals(lintPushText(body).passes, true);
});

Deno.test('buildSyncNudgeMessages: visible + carries the sync_refresh trigger, no PHI', () => {
  const rendered = renderSyncNudge('Ada');
  const msgs = buildSyncNudgeMessages(['ExpoTok[a]', 'ExpoTok[b]'], rendered);
  assertEquals(msgs.length, 2);
  const [msg] = msgs;
  assertEquals(msg.to, 'ExpoTok[a]');
  // Visible: title + body present (unlike the silent path).
  assertEquals(msg.title, 'Leiko');
  assertStringIncludes(msg.body, 'Ada would love to see');
  // Reliable-delivery flags + the SAME trigger type the client already
  // recognises — the only data is the type, never a reading value.
  assertEquals(msg.data, { type: 'sync_refresh' });
  assertEquals(Object.keys(msg.data), ['type']);
  assertEquals(msg.channelId, 'family');
  assertEquals(msg.priority, 'high');
  // Not a silent/data-only message — must NOT set _contentAvailable.
  assertEquals('_contentAvailable' in msg, false);
});

Deno.test('buildSyncNudgeMessages: empty in, empty out', () => {
  assertEquals(buildSyncNudgeMessages([], renderSyncNudge('Ada')), []);
});
