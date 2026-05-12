// Deno tests for send-push quiet-hours helpers — Sprint 15.

import { assertEquals } from 'jsr:@std/assert@1';
import { isWithinQuietWindow } from '../_shared/quiet-hours.ts';

Deno.test('isWithinQuietWindow — UTC midnight-crossing window 22:00-07:00', () => {
  // 23:00 UTC → inside the window.
  const at2300 = new Date('2026-06-15T23:00:00Z');
  assertEquals(isWithinQuietWindow(at2300, '22:00', '07:00', 'UTC'), true);
});

Deno.test('isWithinQuietWindow — 06:59 UTC inside, 07:00 outside', () => {
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T06:59:00Z'), '22:00', '07:00', 'UTC'),
    true,
  );
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T07:00:00Z'), '22:00', '07:00', 'UTC'),
    false,
  );
});

Deno.test('isWithinQuietWindow — 21:59 UTC outside, 22:00 inside', () => {
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T21:59:00Z'), '22:00', '07:00', 'UTC'),
    false,
  );
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T22:00:00Z'), '22:00', '07:00', 'UTC'),
    true,
  );
});

Deno.test('isWithinQuietWindow — Lagos (UTC+1) shifts the window', () => {
  // 21:00 UTC = 22:00 in Lagos → inside the local window.
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T21:00:00Z'), '22:00', '07:00', 'Africa/Lagos'),
    true,
  );
  // 20:00 UTC = 21:00 in Lagos → outside.
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T20:00:00Z'), '22:00', '07:00', 'Africa/Lagos'),
    false,
  );
});

Deno.test('isWithinQuietWindow — same-day window 13:00-14:00', () => {
  // 13:30 inside, 14:00 outside, 12:59 outside.
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T13:30:00Z'), '13:00', '14:00', 'UTC'),
    true,
  );
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T14:00:00Z'), '13:00', '14:00', 'UTC'),
    false,
  );
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T12:59:00Z'), '13:00', '14:00', 'UTC'),
    false,
  );
});

Deno.test('isWithinQuietWindow — bad timezone falls back to UTC', () => {
  assertEquals(
    isWithinQuietWindow(new Date('2026-06-15T23:00:00Z'), '22:00', '07:00', 'Not/A/TZ'),
    true,
  );
});
