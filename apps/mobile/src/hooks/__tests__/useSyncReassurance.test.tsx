import { renderHook, act } from '@testing-library/react-native';
import {
  computeShouldShow,
  REASSURANCE_THRESHOLD_MS,
  useSyncReassurance,
} from '../useSyncReassurance';
import {
  clearSyncFailure,
  markSyncFailure,
} from '../../services/sync/syncFailureTracker';
import { mmkv } from '../../services/storage';

beforeEach(() => {
  mmkv.clearAll();
});

describe('computeShouldShow', () => {
  it('false when no failure streak', () => {
    expect(computeShouldShow(0)).toBe(false);
  });

  it('false when failure streak is shorter than 24h', () => {
    markSyncFailure(0);
    expect(computeShouldShow(REASSURANCE_THRESHOLD_MS - 1)).toBe(false);
  });

  it('true at exactly 24h', () => {
    markSyncFailure(0);
    expect(computeShouldShow(REASSURANCE_THRESHOLD_MS)).toBe(true);
  });

  it('true well past 24h', () => {
    markSyncFailure(0);
    expect(computeShouldShow(48 * 60 * 60 * 1000)).toBe(true);
  });

  it('false after clearSyncFailure', () => {
    markSyncFailure(0);
    clearSyncFailure();
    expect(computeShouldShow(48 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('useSyncReassurance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('initial value reflects the current streak state', () => {
    markSyncFailure(0);
    const now = REASSURANCE_THRESHOLD_MS + 10_000;
    const { result } = renderHook(() =>
      useSyncReassurance(() => now, 60_000),
    );
    expect(result.current).toBe(true);
  });

  it('starts false, flips true when the streak crosses 24h on a poll tick', () => {
    markSyncFailure(0);
    let now = REASSURANCE_THRESHOLD_MS - 10_000;
    const { result } = renderHook(() =>
      useSyncReassurance(() => now, 60_000),
    );
    expect(result.current).toBe(false);
    act(() => {
      now = REASSURANCE_THRESHOLD_MS + 10_000;
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(true);
  });

  it('flips false when the streak is cleared mid-life', () => {
    markSyncFailure(0);
    const now = REASSURANCE_THRESHOLD_MS + 10_000;
    const { result } = renderHook(() =>
      useSyncReassurance(() => now, 60_000),
    );
    expect(result.current).toBe(true);
    act(() => {
      clearSyncFailure();
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(false);
  });
});
