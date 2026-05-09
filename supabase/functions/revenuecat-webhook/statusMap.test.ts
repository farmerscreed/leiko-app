// Deno test for the pure status mapper. Run with:
//   deno test supabase/functions/revenuecat-webhook/statusMap.test.ts
//
// We don't pull in the index.ts entrypoint because it calls Deno.serve()
// at module load. The mapper is the only logic worth unit-testing in
// isolation; the HTTP handler is exercised end-to-end via the supabase
// CLI in dev.

import { assertEquals } from 'jsr:@std/assert@1';
import { classifyEvent } from './statusMap.ts';

Deno.test('TRIAL_STARTED → trialing / plus_trial', () => {
  const c = classifyEvent({ type: 'TRIAL_STARTED' });
  assertEquals(c.subscriptionsStatus, 'trialing');
  assertEquals(c.familiesStatus, 'plus_trial');
  assertEquals(c.shouldUpdateFamily, true);
  assertEquals(c.auditAction, 'subscription.activated');
});

Deno.test('INITIAL_PURCHASE outside trial → active / plus', () => {
  const c = classifyEvent({ type: 'INITIAL_PURCHASE', is_trial_period: false });
  assertEquals(c.subscriptionsStatus, 'active');
  assertEquals(c.familiesStatus, 'plus');
});

Deno.test('INITIAL_PURCHASE inside trial → active / plus_trial', () => {
  const c = classifyEvent({ type: 'INITIAL_PURCHASE', is_trial_period: true });
  assertEquals(c.familiesStatus, 'plus_trial');
});

Deno.test('TRIAL_CONVERTED → active / plus', () => {
  const c = classifyEvent({ type: 'TRIAL_CONVERTED' });
  assertEquals(c.subscriptionsStatus, 'active');
  assertEquals(c.familiesStatus, 'plus');
  assertEquals(c.auditAction, 'subscription.renewed');
});

Deno.test('RENEWAL → active / plus', () => {
  const c = classifyEvent({ type: 'RENEWAL' });
  assertEquals(c.subscriptionsStatus, 'active');
  assertEquals(c.familiesStatus, 'plus');
});

Deno.test('BILLING_ISSUE → grace / plus_grace', () => {
  const c = classifyEvent({ type: 'BILLING_ISSUE' });
  assertEquals(c.subscriptionsStatus, 'grace');
  assertEquals(c.familiesStatus, 'plus_grace');
  assertEquals(c.shouldUpdateFamily, true);
});

Deno.test('CANCELLATION does NOT downgrade family', () => {
  const c = classifyEvent({ type: 'CANCELLATION' });
  assertEquals(c.subscriptionsStatus, 'cancelled');
  assertEquals(c.shouldUpdateFamily, false);
  assertEquals(c.auditAction, 'subscription.lapsed');
});

Deno.test('TRIAL_CANCELLED does NOT downgrade family', () => {
  const c = classifyEvent({ type: 'TRIAL_CANCELLED' });
  assertEquals(c.shouldUpdateFamily, false);
});

Deno.test('EXPIRATION → expired / free', () => {
  const c = classifyEvent({ type: 'EXPIRATION' });
  assertEquals(c.subscriptionsStatus, 'expired');
  assertEquals(c.familiesStatus, 'free');
  assertEquals(c.shouldUpdateFamily, true);
});

Deno.test('UNCANCELLATION restores plus', () => {
  const c = classifyEvent({ type: 'UNCANCELLATION' });
  assertEquals(c.subscriptionsStatus, 'active');
  assertEquals(c.familiesStatus, 'plus');
});

Deno.test('PRODUCT_CHANGE preserves trial flag', () => {
  const t = classifyEvent({ type: 'PRODUCT_CHANGE', is_trial_period: true });
  assertEquals(t.familiesStatus, 'plus_trial');
  const a = classifyEvent({ type: 'PRODUCT_CHANGE', is_trial_period: false });
  assertEquals(a.familiesStatus, 'plus');
});

Deno.test('Unknown event types fall through without family change', () => {
  const c = classifyEvent({ type: 'WHO_KNOWS' as never });
  assertEquals(c.shouldUpdateFamily, false);
});
