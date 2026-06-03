// useHRRangeSummary tests — vitals data-completeness fix (Stage 2).
//
// Coverage:
//   - Disabled (no familyId): never calls the RPC, data stays null
//   - Success: calls hr_range_summary with family + tz + a window whose
//     span matches the selected range, returns the summary
//   - Error: surfaces the RPC error (e.g. the can_see_vital 42501 gate)

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// jest hoists jest.mock() above imports; `mock`-prefixed names are the
// documented closure escape hatch.
const mockRpc = jest.fn();

jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('../../state/auth', () => ({
  useAuth: (selector: (s: unknown) => unknown) =>
    selector({ profile: { timezone: 'Africa/Lagos' } }),
}));

import { useHRRangeSummary } from '../useHRRangeSummary';
import type { HrRangeSummary } from '../../types/database';

const SUMMARY: HrRangeSummary = {
  totals: {
    n: 1784,
    avg_bpm: 75,
    min_bpm: 51,
    max_bpm: 158,
    first_at: '2026-05-27T00:00:00Z',
    last_at: '2026-06-03T09:25:00Z',
  },
  zones: { resting: 173, calm: 1064, active: 493, vigorous: 52, total: 1782 },
  per_day: [{ day: '2026-06-03', avg: 76, min: 52, max: 125, n: 84 }],
  resting_by_night: [{ night: '2026-06-03', resting: 58 }],
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => {
  mockRpc.mockReset();
});

describe('useHRRangeSummary', () => {
  it('does not call the RPC when familyId is null', () => {
    const { result } = renderHook(() => useHRRangeSummary(null, '7d'), {
      wrapper: makeWrapper(),
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls hr_range_summary with the tz and a window matching the range', async () => {
    mockRpc.mockResolvedValue({ data: SUMMARY, error: null });

    const { result } = renderHook(() => useHRRangeSummary('fam-1', '30d'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data).toEqual(SUMMARY);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [fn, args] = mockRpc.mock.calls[0] as [
      string,
      { _family_id: string; _tz: string; _from: string; _to: string },
    ];
    expect(fn).toBe('hr_range_summary');
    expect(args._family_id).toBe('fam-1');
    expect(args._tz).toBe('Africa/Lagos');
    const spanDays =
      (Date.parse(args._to) - Date.parse(args._from)) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).toBe(30);
  });

  it('surfaces the RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('not authorized to read hr'),
    });

    const { result } = renderHook(() => useHRRangeSummary('fam-1', '7d'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain('not authorized');
  });
});
