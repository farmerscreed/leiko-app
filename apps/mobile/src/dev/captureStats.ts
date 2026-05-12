// Dev-only capture statistics — Sprint 16.5a Phase A.
//
// In-memory tally of every 0x73 watch-pushed notification byte observed
// during a capture session. Read by VitalsDebugPanel's Capture Status
// section so the founder can see, at a glance, whether the watch is
// emitting an un-mapped 0x73 byte we're currently routing to onUnknown.
//
// NOT shipped in production. Producer (notify.ts) only pushes when the
// BLE_TRACE flag at the top of that file is set, which is gated behind
// __DEV__. Phase A's Step 4 strips both the producer call and the rest
// of the BLE_TRACE pattern; this module stays as a small in-process
// counter for any future BLE_TRACE re-introduction.
//
// Per CLAUDE.md data rule: counts only. Never includes reading values.

import { create } from 'zustand';

interface CaptureStatsState {
  /** Map of 0x73 kind-byte → observed count this session. */
  notifyKindCounts: Record<number, number>;
  /** Bump the count for a single 0x73 kind byte. */
  recordNotifyKind: (kindByte: number) => void;
  /** Reset all counts. Used for "start a fresh capture" UX. */
  reset: () => void;
}

export const useCaptureStats = create<CaptureStatsState>((set) => ({
  notifyKindCounts: {},
  recordNotifyKind: (kindByte) =>
    set((s) => ({
      notifyKindCounts: {
        ...s.notifyKindCounts,
        [kindByte]: (s.notifyKindCounts[kindByte] ?? 0) + 1,
      },
    })),
  reset: () => set({ notifyKindCounts: {} }),
}));
