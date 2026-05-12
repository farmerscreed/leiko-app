import {
  bumpVitalFailure,
  clearAllVitalFailures,
  clearSyncFailure,
  clearVitalFailure,
  computeNextRetryAtMs,
  getLastSyncFailedAt,
  getVitalFailureCounters,
  isVitalBackoffActive,
  markSyncFailure,
} from '../syncFailureTracker';
import { mmkv } from '../../storage';

beforeEach(() => {
  mmkv.clearAll();
});

describe('markSyncFailure / clearSyncFailure', () => {
  it('marks the first failure timestamp', () => {
    expect(getLastSyncFailedAt()).toBeNull();
    const at = markSyncFailure(1_000_000);
    expect(at).toBe(1_000_000);
    expect(getLastSyncFailedAt()).toBe(1_000_000);
  });

  it('is idempotent on subsequent failures — returns the first one', () => {
    markSyncFailure(1_000_000);
    const second = markSyncFailure(2_000_000);
    expect(second).toBe(1_000_000);
    expect(getLastSyncFailedAt()).toBe(1_000_000);
  });

  it('clearSyncFailure resets the streak', () => {
    markSyncFailure(1_000_000);
    clearSyncFailure();
    expect(getLastSyncFailedAt()).toBeNull();
  });

  it('returns null when the stored value is corrupt', () => {
    mmkv.set('leiko.sync.lastSyncFailedAt', 'not-a-number');
    expect(getLastSyncFailedAt()).toBeNull();
  });
});

describe('computeNextRetryAtMs', () => {
  it('first failure waits 30s', () => {
    expect(computeNextRetryAtMs(1, 0)).toBe(30_000);
  });

  it('second failure waits 60s', () => {
    expect(computeNextRetryAtMs(2, 0)).toBe(60_000);
  });

  it('fifth failure waits 8 minutes', () => {
    expect(computeNextRetryAtMs(5, 0)).toBe(8 * 60_000);
  });

  it('caps at one hour', () => {
    expect(computeNextRetryAtMs(20, 0)).toBe(60 * 60 * 1000);
  });
});

describe('bumpVitalFailure / clearVitalFailure', () => {
  it('records the first failure with a 30s next retry', () => {
    const entry = bumpVitalFailure('hr', 1_000);
    expect(entry.count).toBe(1);
    expect(entry.nextRetryAtMs).toBe(1_000 + 30_000);
  });

  it('increments the counter on repeated failures', () => {
    bumpVitalFailure('hr', 0);
    const second = bumpVitalFailure('hr', 100_000);
    expect(second.count).toBe(2);
    expect(second.nextRetryAtMs).toBe(100_000 + 60_000);
  });

  it('isVitalBackoffActive is true within the window', () => {
    bumpVitalFailure('hr', 1_000);
    expect(isVitalBackoffActive('hr', 1_000)).toBe(true);
    expect(isVitalBackoffActive('hr', 1_000 + 29_000)).toBe(true);
    expect(isVitalBackoffActive('hr', 1_000 + 30_001)).toBe(false);
  });

  it('clearVitalFailure removes the entry and ends backoff', () => {
    bumpVitalFailure('hr', 0);
    clearVitalFailure('hr');
    expect(isVitalBackoffActive('hr', 1)).toBe(false);
    expect(getVitalFailureCounters().hr).toBeUndefined();
  });

  it('separate vitals back off independently', () => {
    bumpVitalFailure('hr', 0);
    bumpVitalFailure('spo2', 0);
    expect(isVitalBackoffActive('hr', 1)).toBe(true);
    expect(isVitalBackoffActive('sleep', 1)).toBe(false);
    clearVitalFailure('hr');
    expect(isVitalBackoffActive('hr', 1)).toBe(false);
    expect(isVitalBackoffActive('spo2', 1)).toBe(true);
  });

  it('clearAllVitalFailures wipes every counter', () => {
    bumpVitalFailure('hr', 0);
    bumpVitalFailure('spo2', 0);
    bumpVitalFailure('sleep', 0);
    clearAllVitalFailures();
    expect(getVitalFailureCounters()).toEqual({});
  });
});

describe('vitalFailureCounters resilience', () => {
  it('treats a corrupt JSON blob as empty', () => {
    mmkv.set('leiko.sync.vitalFailureCounters', '{not-json');
    expect(getVitalFailureCounters()).toEqual({});
  });
});
