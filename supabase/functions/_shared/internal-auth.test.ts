import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  INTERNAL_HEADER,
  isAuthorizedInternal,
  withInternalHeader,
} from './internal-auth.ts';

const ENV = 'LEIKO_INTERNAL_PUSH_SECRET';

Deno.test('isAuthorizedInternal — fails closed when the secret is unset', () => {
  Deno.env.delete(ENV);
  const req = new Request('http://x', { headers: { [INTERNAL_HEADER]: 'anything' } });
  assertEquals(isAuthorizedInternal(req), false);
});

Deno.test('isAuthorizedInternal — rejects a missing or wrong header', () => {
  Deno.env.set(ENV, 's3cret');
  assertEquals(isAuthorizedInternal(new Request('http://x')), false);
  assertEquals(
    isAuthorizedInternal(new Request('http://x', { headers: { [INTERNAL_HEADER]: 'wrong' } })),
    false,
  );
  Deno.env.delete(ENV);
});

Deno.test('isAuthorizedInternal — accepts the matching secret', () => {
  Deno.env.set(ENV, 's3cret');
  const req = new Request('http://x', { headers: { [INTERNAL_HEADER]: 's3cret' } });
  assert(isAuthorizedInternal(req));
  Deno.env.delete(ENV);
});

Deno.test('withInternalHeader — injects the secret alongside caller headers', () => {
  Deno.env.set(ENV, 's3cret');
  const h = withInternalHeader({ 'Content-Type': 'application/json' });
  assertEquals(h[INTERNAL_HEADER], 's3cret');
  assertEquals(h['Content-Type'], 'application/json');
  Deno.env.delete(ENV);
});
