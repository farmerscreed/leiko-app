// withTimeout — race a promise against a deadline.
//
// Why this exists: React Native's Android networking (OkHttp) is
// configured with NO connect/read timeout, so a request on a stalled
// network (airport captive portal, weak 3G, a dropped TCP session)
// never settles. Anything awaited on the app's launch path must
// therefore carry its own deadline, or the launch spinner waits
// forever. See plans/STARTUP_HANG_FIX_2026-10-27.md.
//
// The underlying promise is NOT cancelled — it keeps running and its
// eventual result is simply ignored by this wrapper. Callers that care
// about a late result (e.g. a session refresh that lands after the
// deadline) should keep their own reference to the original promise.

export class TimeoutError extends Error {
  readonly label: string;
  readonly ms: number;
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.label = label;
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}
