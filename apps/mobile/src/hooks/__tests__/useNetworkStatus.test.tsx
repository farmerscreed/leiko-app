import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  useNetworkStatus,
  isStateOffline,
  type NetworkStatus,
} from '../useNetworkStatus';
// The mock at __mocks__/@react-native-community/netinfo.js exposes
// __setMockState / __resetMockState. The runtime import returns the
// mocked module under jest.
import * as NetInfoMock from '@react-native-community/netinfo';

const setMockState = (
  NetInfoMock as unknown as {
    __setMockState: (s: Partial<{ isConnected: boolean; isInternetReachable: boolean | null }>) => void;
  }
).__setMockState;

const resetMockState = (
  NetInfoMock as unknown as { __resetMockState: () => void }
).__resetMockState;

describe('isStateOffline', () => {
  it('returns false when state is null (boot-time unknown)', () => {
    expect(isStateOffline(null)).toBe(false);
  });

  it('returns true when isConnected is false', () => {
    expect(
      isStateOffline({
        type: 'none' as never,
        isConnected: false,
        isInternetReachable: false,
        details: null,
      } as never),
    ).toBe(true);
  });

  it('returns true when isInternetReachable is false', () => {
    expect(
      isStateOffline({
        type: 'wifi' as never,
        isConnected: true,
        isInternetReachable: false,
        details: { isConnectionExpensive: false } as never,
      } as never),
    ).toBe(true);
  });

  it('returns false when isInternetReachable is null (probe pending)', () => {
    expect(
      isStateOffline({
        type: 'wifi' as never,
        isConnected: true,
        isInternetReachable: null,
        details: { isConnectionExpensive: false } as never,
      } as never),
    ).toBe(false);
  });
});

describe('useNetworkStatus', () => {
  beforeEach(() => {
    resetMockState();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts online when NetInfo reports a connected wifi state', async () => {
    const { result } = renderHook(() => useNetworkStatus(5_000));
    // Wait for the initial promise-microtask fan-out from the mock's
    // addEventListener. The synchronous setState branch ("online → online,
    // no-op") never flips `offline` to true.
    await waitFor(() => expect(result.current.raw).not.toBeNull());
    expect(result.current.offline).toBe(false);
  });

  it('flips to offline after the debounce window elapses', async () => {
    const { result } = renderHook(() => useNetworkStatus(5_000));
    await waitFor(() => expect(result.current.raw).not.toBeNull());

    act(() => {
      setMockState({ isConnected: false, isInternetReachable: false });
    });
    // Inside the debounce window — still online to the consumer.
    expect(result.current.offline).toBe(false);

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(result.current.offline).toBe(true);
  });

  it('does not flip to offline if connectivity recovers before debounce', async () => {
    const { result } = renderHook(() => useNetworkStatus(5_000));
    await waitFor(() => expect(result.current.raw).not.toBeNull());

    act(() => {
      setMockState({ isConnected: false, isInternetReachable: false });
    });
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    act(() => {
      setMockState({ isConnected: true, isInternetReachable: true });
    });
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(result.current.offline).toBe(false);
  });

  it('returns to online immediately when connectivity recovers from offline', async () => {
    const { result } = renderHook(() => useNetworkStatus(5_000));
    await waitFor(() => expect(result.current.raw).not.toBeNull());

    // Drive into the offline state.
    act(() => {
      setMockState({ isConnected: false, isInternetReachable: false });
    });
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(result.current.offline).toBe(true);

    // Recovery is loud — no debounce.
    act(() => {
      setMockState({ isConnected: true, isInternetReachable: true });
    });
    expect(result.current.offline).toBe(false);
  });
});

// Type-only assertion — keeps the exported shape honest under refactor.
const _typeProbe: NetworkStatus = { offline: false, raw: null };
void _typeProbe;
