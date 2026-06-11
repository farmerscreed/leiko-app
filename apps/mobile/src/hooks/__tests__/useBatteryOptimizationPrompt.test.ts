import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useBatteryOptimizationPrompt } from '../useBatteryOptimizationPrompt';
import { usePairing } from '../../state/pairing';
import { mmkv } from '../../services/storage';
import * as batt from '../../services/power/batteryOptimization';

jest.mock('../../services/power/batteryOptimization', () => ({
  isIgnoringBatteryOptimizations: jest.fn(),
  requestIgnoreBatteryOptimizations: jest.fn(),
}));

const mockIsIgnoring = batt.isIgnoringBatteryOptimizations as jest.Mock;
const mockRequest = batt.requestIgnoreBatteryOptimizations as jest.Mock;

function pairWatch(): void {
  usePairing.setState({ pairedDevice: { bleId: 'x', name: 'Leiko', macSuffix: '00' } as never });
}

beforeEach(() => {
  mmkv.clearAll();
  usePairing.setState({ pairedDevice: null });
  mockIsIgnoring.mockReset().mockResolvedValue(true);
  mockRequest.mockReset().mockResolvedValue(undefined);
});

it('does not show without a paired watch', () => {
  const { result } = renderHook(() => useBatteryOptimizationPrompt());
  expect(result.current.show).toBe(false);
  expect(mockIsIgnoring).not.toHaveBeenCalled();
});

it('shows when a watch is paired and the app is not exempt', async () => {
  mockIsIgnoring.mockResolvedValue(false);
  pairWatch();
  const { result } = renderHook(() => useBatteryOptimizationPrompt());
  await waitFor(() => expect(result.current.show).toBe(true));
});

it('stays hidden when the app is already exempt', async () => {
  mockIsIgnoring.mockResolvedValue(true);
  pairWatch();
  const { result } = renderHook(() => useBatteryOptimizationPrompt());
  await waitFor(() => expect(mockIsIgnoring).toHaveBeenCalled());
  expect(result.current.show).toBe(false);
});

it('dismiss() hides it and persists across mounts', async () => {
  mockIsIgnoring.mockResolvedValue(false);
  pairWatch();
  const { result, unmount } = renderHook(() => useBatteryOptimizationPrompt());
  await waitFor(() => expect(result.current.show).toBe(true));

  act(() => result.current.dismiss());
  expect(result.current.show).toBe(false);
  expect(mmkv.getBoolean('leiko.batteryOpt.dismissed')).toBe(true);

  unmount();
  const second = renderHook(() => useBatteryOptimizationPrompt());
  expect(second.result.current.show).toBe(false);
});

it('request() delegates to the native request', async () => {
  mockIsIgnoring.mockResolvedValue(false);
  pairWatch();
  const { result } = renderHook(() => useBatteryOptimizationPrompt());
  await act(async () => {
    await result.current.request();
  });
  expect(mockRequest).toHaveBeenCalledTimes(1);
});
