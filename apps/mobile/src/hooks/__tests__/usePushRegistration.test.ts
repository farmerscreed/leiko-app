import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { usePushRegistration } from '../usePushRegistration';

const mockRegister = jest.fn(() => Promise.resolve({ ok: true }));
jest.mock('../../services/notifications', () => ({
  registerForPushNotifications: () => mockRegister(),
}));

describe('usePushRegistration', () => {
  beforeEach(() => mockRegister.mockClear());

  it('does not register while unauthenticated', () => {
    renderHook(() => usePushRegistration(false));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers once auth is hydrated', () => {
    renderHook(() => usePushRegistration(true));
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('registers on the unauthenticated → authenticated transition', () => {
    const { rerender } = renderHook(
      ({ authed }: { authed: boolean }) => usePushRegistration(authed),
      { initialProps: { authed: false } },
    );
    expect(mockRegister).not.toHaveBeenCalled();
    rerender({ authed: true });
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('re-registers on foreground, but not on background', () => {
    const listeners: Array<(s: string) => void> = [];
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, cb) => {
        listeners.push(cb as (s: string) => void);
        return { remove: jest.fn() } as never;
      });
    renderHook(() => usePushRegistration(true));
    expect(mockRegister).toHaveBeenCalledTimes(1); // initial register
    act(() => listeners.forEach((cb) => cb('active')));
    expect(mockRegister).toHaveBeenCalledTimes(2); // foreground re-register
    act(() => listeners.forEach((cb) => cb('background')));
    expect(mockRegister).toHaveBeenCalledTimes(2); // background is a no-op
    spy.mockRestore();
  });

  it('removes the AppState listener on unmount', () => {
    const remove = jest.fn();
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as never);
    const { unmount } = renderHook(() => usePushRegistration(true));
    unmount();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});
