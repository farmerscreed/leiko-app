import { renderHook, act } from '@testing-library/react-native';
import { useRemoteRefreshNudge } from '../useRemoteRefreshNudge';
import { requestRemoteRefresh } from '../../../services/sync/requestRemoteRefresh';

jest.mock('../../../services/sync/requestRemoteRefresh', () => ({
  requestRemoteRefresh: jest.fn(() => Promise.resolve('requested')),
}));

const mockRequest = requestRemoteRefresh as jest.MockedFunction<
  typeof requestRemoteRefresh
>;

const WAIT = 1000;

function setup(freshDataSignal = 0) {
  return renderHook(
    (props: { familyId: string; freshDataSignal: number; waitMs: number }) =>
      useRemoteRefreshNudge(props),
    { initialProps: { familyId: 'fam-1', freshDataSignal, waitMs: WAIT } },
  );
}

describe('useRemoteRefreshNudge — silent-first, human-confirmed fallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRequest.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts idle', () => {
    const { result } = setup();
    expect(result.current.state).toBe('idle');
  });

  it('offers the reminder only after the wait window with no fresh data', () => {
    const { result } = setup();
    act(() => result.current.beginWaiting());
    expect(result.current.state).toBe('waiting');
    act(() => jest.advanceTimersByTime(WAIT));
    expect(result.current.state).toBe('offer');
  });

  it('fresh data during the wait resolves silently — never offers', () => {
    const { result, rerender } = setup(0);
    act(() => result.current.beginWaiting());
    expect(result.current.state).toBe('waiting');
    // New readings land for this family.
    rerender({ familyId: 'fam-1', freshDataSignal: 1, waitMs: WAIT });
    expect(result.current.state).toBe('idle');
    // Timer firing afterwards must not resurrect the offer.
    act(() => jest.advanceTimersByTime(WAIT));
    expect(result.current.state).toBe('idle');
  });

  it('sendReminder escalates to the visible nudge and acknowledges', () => {
    const { result } = setup();
    act(() => result.current.beginWaiting());
    act(() => jest.advanceTimersByTime(WAIT));
    expect(result.current.state).toBe('offer');
    act(() => result.current.sendReminder());
    expect(result.current.state).toBe('sent');
    expect(mockRequest).toHaveBeenCalledWith('fam-1', { escalate: true });
  });

  it('fresh data after a reminder was sent returns to idle', () => {
    const { result, rerender } = setup(0);
    act(() => result.current.beginWaiting());
    act(() => jest.advanceTimersByTime(WAIT));
    act(() => result.current.sendReminder());
    expect(result.current.state).toBe('sent');
    rerender({ familyId: 'fam-1', freshDataSignal: 1, waitMs: WAIT });
    expect(result.current.state).toBe('idle');
  });

  it('does not escalate on the silent (default) refresh path', () => {
    const { result } = setup();
    act(() => result.current.beginWaiting());
    // No tap → no visible nudge call at all.
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
