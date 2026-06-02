// mapSignInError — Sprint 19 Block 9 Bug 2.

import { mapSignInError } from '../SignIn';

describe('mapSignInError', () => {
  it("maps Supabase 'signups not allowed' to a friendly hint + suggestSignUp", () => {
    const out = mapSignInError(new Error('Signups not allowed for otp'));
    expect(out.suggestSignUp).toBe(true);
    expect(out.message).toMatch(/don't see an account/i);
    expect(out.message).toMatch(/sign up/i);
  });

  it('maps "user not found" the same way', () => {
    const out = mapSignInError(new Error('User not found'));
    expect(out.suggestSignUp).toBe(true);
    expect(out.message).toMatch(/don't see an account/i);
  });

  it('maps "invalid login credentials" the same way', () => {
    const out = mapSignInError(new Error('Invalid login credentials'));
    expect(out.suggestSignUp).toBe(true);
  });

  it('maps rate-limit errors to a calm waiting message (no signup hint)', () => {
    const out = mapSignInError(new Error('Rate limit exceeded'));
    expect(out.suggestSignUp).toBe(false);
    expect(out.message).toMatch(/wait a moment/i);
  });

  it('maps "Too many requests" similarly', () => {
    const out = mapSignInError(new Error('Too many requests'));
    expect(out.suggestSignUp).toBe(false);
    expect(out.message).toMatch(/wait a moment/i);
  });

  it('passes unrecognised error messages through verbatim (no signup hint)', () => {
    const out = mapSignInError(new Error('Some other error from Supabase'));
    expect(out.suggestSignUp).toBe(false);
    expect(out.message).toBe('Some other error from Supabase');
  });

  it('falls back to a generic message for non-Error throwables', () => {
    const out = mapSignInError('a string thrown like an idiot');
    expect(out.suggestSignUp).toBe(false);
    expect(out.message).toMatch(/couldn.t send your code/i);
  });
});
