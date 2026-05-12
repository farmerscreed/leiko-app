// useNetworkStatus — Sprint 16 (offline + error states).
//
// Wraps @react-native-community/netinfo with a debounce so a brief
// connectivity flicker (a phone walking past a wifi dead-spot) does
// not flash the offline banner on screen. Online→offline transitions
// are debounced by OFFLINE_DEBOUNCE_MS; offline→online is immediate
// (we want the banner to disappear as soon as connectivity is back).
//
// "Offline" for our purposes means `isConnected === false` OR
// `isInternetReachable === false`. A reachable LAN with no internet
// is still offline for the sync orchestrator's purposes. While
// reachability is being determined (`isInternetReachable === null` —
// the boot-time unknown state), we treat the device as ONLINE to
// avoid a startup banner flash.

import { useEffect, useRef, useState } from 'react';
import NetInfo, {
  type NetInfoState,
} from '@react-native-community/netinfo';

const OFFLINE_DEBOUNCE_MS = 5_000;

export interface NetworkStatus {
  /** True when we are confident the device has no usable internet. */
  offline: boolean;
  /** Underlying NetInfo state — passed through for callers that need detail. */
  raw: NetInfoState | null;
}

/**
 * Treat the device as offline only if the underlying NetInfo state is
 * unambiguously offline. The boot-time `isInternetReachable === null`
 * is treated as online to suppress a startup banner flash.
 */
export function isStateOffline(state: NetInfoState | null): boolean {
  if (state === null) return false;
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export function useNetworkStatus(
  debounceMs: number = OFFLINE_DEBOUNCE_MS,
): NetworkStatus {
  const [raw, setRaw] = useState<NetInfoState | null>(null);
  const [offline, setOffline] = useState<boolean>(false);
  // Hold pending offline transitions so we can cancel them if the network
  // recovers before the debounce fires.
  const pendingOfflineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPending = () => {
      if (pendingOfflineTimer.current) {
        clearTimeout(pendingOfflineTimer.current);
        pendingOfflineTimer.current = null;
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      setRaw(state);
      const nextOffline = isStateOffline(state);
      if (nextOffline) {
        // Online → offline transition: debounce. If we're already
        // offline, no-op.
        if (offline) return;
        clearPending();
        pendingOfflineTimer.current = setTimeout(() => {
          setOffline(true);
          pendingOfflineTimer.current = null;
        }, debounceMs);
      } else {
        // Any non-offline state cancels any pending offline transition
        // AND clears the offline flag immediately — recovery is loud.
        clearPending();
        if (offline) setOffline(false);
      }
    });

    return () => {
      clearPending();
      unsubscribe();
    };
  }, [debounceMs, offline]);

  return { offline, raw };
}
