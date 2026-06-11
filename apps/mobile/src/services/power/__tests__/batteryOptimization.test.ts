// iOS / JS-workspace path: no native LeikoPower module, so the app is treated
// as already exempt and the request is a safe no-op. (Default test Platform is
// iOS; the Android delegation is exercised through the native module on device.)
import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from '../batteryOptimization';

it('reports exempt (true) when there is no native module to check', async () => {
  await expect(isIgnoringBatteryOptimizations()).resolves.toBe(true);
});

it('request is a no-op that resolves cleanly without a native module', async () => {
  await expect(requestIgnoreBatteryOptimizations()).resolves.toBeUndefined();
});
