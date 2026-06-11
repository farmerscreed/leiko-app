import { requestRemoteRefresh } from '../requestRemoteRefresh';
import { supabase } from '../../supabase';

jest.mock('../../supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock('../../analytics/logger', () => ({ logger: { track: jest.fn() } }));

const invoke = supabase.functions.invoke as jest.Mock;

describe('requestRemoteRefresh', () => {
  beforeEach(() => invoke.mockReset());

  it('invokes request-sync silently by default (escalate=false)', async () => {
    invoke.mockResolvedValue({ data: { outcome: 'requested' }, error: null });
    await requestRemoteRefresh('fam-123');
    expect(invoke).toHaveBeenCalledWith('request-sync', {
      body: { familyId: 'fam-123', escalate: false },
    });
  });

  it('escalates to the visible nudge when asked', async () => {
    invoke.mockResolvedValue({ data: { outcome: 'requested' }, error: null });
    await requestRemoteRefresh('fam-123', { escalate: true });
    expect(invoke).toHaveBeenCalledWith('request-sync', {
      body: { familyId: 'fam-123', escalate: true },
    });
  });

  it('returns the server outcome on success', async () => {
    invoke.mockResolvedValue({ data: { outcome: 'requested' }, error: null });
    expect(await requestRemoteRefresh('fam-1')).toBe('requested');
  });

  it('passes through non-sent outcomes (e.g. no_owner)', async () => {
    invoke.mockResolvedValue({ data: { outcome: 'no_owner' }, error: null });
    expect(await requestRemoteRefresh('fam-1')).toBe('no_owner');
  });

  it('returns failed on a transport error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'network' } });
    expect(await requestRemoteRefresh('fam-1')).toBe('failed');
  });

  it('never throws — resolves failed if invoke rejects', async () => {
    invoke.mockRejectedValue(new Error('boom'));
    expect(await requestRemoteRefresh('fam-1')).toBe('failed');
  });
});
