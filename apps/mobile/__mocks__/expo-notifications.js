/* global module, jest */
// Manual jest mock for expo-notifications — Sprint 15.
//
// The real module loads native code that doesn't exist under jest. This
// mock provides the surface our notifications service uses + simple
// stubs for the rest so any transitive import doesn't crash.

const setNotificationHandler = jest.fn();
const setNotificationCategoryAsync = jest.fn().mockResolvedValue(undefined);
const setNotificationChannelAsync = jest.fn().mockResolvedValue(undefined);

const getPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'undetermined', granted: false });
const requestPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'granted', granted: true });

const getDevicePushTokenAsync = jest
  .fn()
  .mockResolvedValue({ type: 'apns', data: 'mock-native-token' });

const getExpoPushTokenAsync = jest.fn().mockResolvedValue({
  type: 'expo',
  data: 'ExponentPushToken[mock]',
});

const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const removeNotificationSubscription = jest.fn();

const getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);

const AndroidImportance = {
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
};

module.exports = {
  setNotificationHandler,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  getDevicePushTokenAsync,
  getExpoPushTokenAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
  getLastNotificationResponseAsync,
  AndroidImportance,
};
