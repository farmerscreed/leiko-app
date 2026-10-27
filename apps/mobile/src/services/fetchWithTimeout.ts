// fetchWithTimeout — the global fetch the Supabase client uses.
//
// React Native's Android HTTP stack has no default timeout: a request on
// a stalled network hangs forever. Every Supabase call (REST, RPC, auth
// refresh, edge functions, storage) goes through this wrapper so nothing
// can hang indefinitely. The cap is deliberately generous — doctor-report
// PDF generation and Ask Leiko run through edge functions that can take
// tens of seconds on a good connection — because the launch path has its
// own, much tighter, deadline (state/auth.ts STARTUP_TIMEOUT_MS).
//
// A caller-supplied AbortSignal still works: aborting it aborts the
// request exactly as before.

export const REQUEST_TIMEOUT_MS = 60_000;

type FetchFn = typeof fetch;

export function createFetchWithTimeout(
  baseFetch: FetchFn,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): FetchFn {
  return (input, init) => {
    const controller = new AbortController();
    const callerSignal = init?.signal ?? null;

    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort();
      } else {
        callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
    });
  };
}

export const fetchWithTimeout: FetchFn = (input, init) =>
  createFetchWithTimeout(fetch)(input, init);
