import { createFetchWithTimeout } from '../fetchWithTimeout';
import { withTimeout, isTimeoutError } from '../../utils/withTimeout';

// A fetch that never answers unless aborted — the stalled-network case.
function hangingFetch(): typeof fetch {
  return ((_input: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('createFetchWithTimeout', () => {
  it('aborts a request that never answers', async () => {
    const f = createFetchWithTimeout(hangingFetch(), 1000);
    const p = f('https://example.test');
    const assertion = expect(p).rejects.toThrow('aborted');
    await jest.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  it('passes a fast response straight through', async () => {
    const ok = { ok: true } as Response;
    const base = jest.fn().mockResolvedValue(ok) as unknown as typeof fetch;
    const f = createFetchWithTimeout(base, 1000);
    await expect(f('https://example.test')).resolves.toBe(ok);
  });

  it("still honours the caller's own abort signal", async () => {
    const f = createFetchWithTimeout(hangingFetch(), 60_000);
    const caller = new AbortController();
    const p = f('https://example.test', { signal: caller.signal });
    const assertion = expect(p).rejects.toThrow('aborted');
    caller.abort();
    await assertion;
  });
});

describe('withTimeout', () => {
  it('rejects with a TimeoutError at the deadline', async () => {
    const p = withTimeout(new Promise(() => {}), 500, 'thing');
    const assertion = p.catch((e) => e);
    await jest.advanceTimersByTimeAsync(501);
    expect(isTimeoutError(await assertion)).toBe(true);
  });

  it('resolves when the work finishes first', async () => {
    await expect(withTimeout(Promise.resolve(7), 500)).resolves.toBe(7);
  });

  it('passes through the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 500)).rejects.toThrow('boom');
  });
});
