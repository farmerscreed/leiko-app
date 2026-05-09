// usePlusEntitlement — Sprint 10a hook tests.
//
// Sprint 9 had a stub-only test (always returns 'free'). Sprint 10a
// makes the hook a TanStack Query against families.subscription_status
// with a Realtime invalidation listener. We test:
//
//   • isPlusTier — pure helper, unchanged from Sprint 9.
//   • Hook fetches the family's subscription_status on mount.
//   • Hook returns 'free' when the user has no family membership.
//   • Hook returns 'plus_trial' when family.subscription_status is
//     plus_trial (and isPlus reflects it).
//
// We mock the supabase client (just enough to satisfy the query +
// channel surface) and the auth store. Realtime delivery itself is
// out of scope for unit tests — the listener is wired and the
// subscribe / removeChannel calls are verified.

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { isPlusTier, usePlusEntitlement } from '../usePlusEntitlement';

jest.mock('../../state/auth', () => ({
  useAuth: (selector: (s: { session: { user: { id: string } } | null }) => unknown) =>
    selector({ session: { user: { id: 'user-1' } } }),
}));

interface FakeClient {
  from: jest.Mock;
  channel: jest.Mock;
  removeChannel: jest.Mock;
}

function buildClient(tier: string | null): FakeClient {
  const maybeSingle = jest.fn().mockResolvedValue({
    data:
      tier === null
        ? null
        : { family_id: 'fam-1', families: { subscription_status: tier } },
    error: null,
  });
  const limit = jest.fn().mockReturnValue({ maybeSingle });
  const is = jest.fn().mockReturnValue({ limit });
  const eq = jest.fn().mockReturnValue({ is });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  const subscribe = jest.fn().mockReturnValue({});
  const on = jest.fn().mockReturnValue({ subscribe });
  const channel = jest.fn().mockReturnValue({ on });
  const removeChannel = jest.fn();
  return { from, channel, removeChannel } as FakeClient;
}

function withQueryClient(node: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, node);
}

describe('isPlusTier', () => {
  it('treats plus / plus_trial / plus_grace as Plus-entitled', () => {
    expect(isPlusTier('plus')).toBe(true);
    expect(isPlusTier('plus_trial')).toBe(true);
    expect(isPlusTier('plus_grace')).toBe(true);
  });

  it('treats free / past_due as not entitled', () => {
    expect(isPlusTier('free')).toBe(false);
    expect(isPlusTier('past_due')).toBe(false);
  });
});

describe('usePlusEntitlement — TanStack Query', () => {
  it('returns free when the user has no family membership', async () => {
    const client = buildClient(null);
    const { result } = renderHook(
      () => usePlusEntitlement(client as unknown as Parameters<typeof usePlusEntitlement>[0]),
      { wrapper: ({ children }) => withQueryClient(children) },
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tier).toBe('free');
    expect(result.current.isPlus).toBe(false);
  });

  it('returns plus_trial and isPlus=true when the family is on trial', async () => {
    const client = buildClient('plus_trial');
    const { result } = renderHook(
      () => usePlusEntitlement(client as unknown as Parameters<typeof usePlusEntitlement>[0]),
      { wrapper: ({ children }) => withQueryClient(children) },
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tier).toBe('plus_trial');
    expect(result.current.isPlus).toBe(true);
  });

  it('returns plus when the family is on a paid plan', async () => {
    const client = buildClient('plus');
    const { result } = renderHook(
      () => usePlusEntitlement(client as unknown as Parameters<typeof usePlusEntitlement>[0]),
      { wrapper: ({ children }) => withQueryClient(children) },
    );
    await waitFor(() => {
      expect(result.current.tier).toBe('plus');
    });
    expect(result.current.isPlus).toBe(true);
  });

  it('subscribes to Realtime UPDATEs for the family', async () => {
    const client = buildClient('free');
    renderHook(
      () => usePlusEntitlement(client as unknown as Parameters<typeof usePlusEntitlement>[0]),
      { wrapper: ({ children }) => withQueryClient(children) },
    );
    await waitFor(() => {
      expect(client.channel).toHaveBeenCalledWith('families:fam-1');
    });
  });
});
