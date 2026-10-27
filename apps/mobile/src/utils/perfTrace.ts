// perfTrace — lightweight timing + JS-thread stall detection.
//
// Why (2026-10-27): on the founder's Pixel 8 the JS thread sat at 100%
// CPU for ~2.5 minutes after every cold start, during the watch sync,
// so the Home screen showed only its skeleton. Release builds have no
// profiler, so this writes plain `[leiko-perf]` lines to logcat
// (`adb logcat -s ReactNativeJS`) that name the phase that was running
// whenever the JS thread stalls.
//
// Data rules: labels and durations ONLY. Never pass reading values,
// ids or personal data into a label.

const TAG = '[leiko-perf]';

let currentPhase = 'idle';
let stallTimer: ReturnType<typeof setInterval> | null = null;

/** Name the phase that is running now (shows up in stall lines). */
export function setPerfPhase(phase: string): void {
  currentPhase = phase;
}

const SILENT = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

export function perfLog(message: string): void {
  if (SILENT) return;
  console.log(`${TAG} ${message}`);
}

/** Time an async step. Logs its duration and restores the prior phase. */
export async function perfStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const prev = currentPhase;
  currentPhase = label;
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    perfLog(`${label} took ${Date.now() - t0}ms`);
    currentPhase = prev;
  }
}

/** Time a synchronous block. */
export function perfSync<T>(label: string, fn: () => T): T {
  const t0 = Date.now();
  try {
    return fn();
  } finally {
    const ms = Date.now() - t0;
    if (ms >= 50) perfLog(`${label} took ${ms}ms (sync)`);
  }
}

/**
 * Start a 250ms heartbeat on the JS thread. If a tick arrives late by
 * more than `thresholdMs`, the thread was blocked — log how long and
 * which phase was active. Idempotent.
 */
export function startStallDetector(thresholdMs = 500): void {
  if (stallTimer) return;
  const intervalMs = 250;
  let last = Date.now();
  stallTimer = setInterval(() => {
    const now = Date.now();
    const lag = now - last - intervalMs;
    last = now;
    if (lag > thresholdMs) perfLog(`JS stall ${lag}ms during phase=${currentPhase}`);
  }, intervalMs);
}

export function stopStallDetector(): void {
  if (stallTimer) clearInterval(stallTimer);
  stallTimer = null;
}
