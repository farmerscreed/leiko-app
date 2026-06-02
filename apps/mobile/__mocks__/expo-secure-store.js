/* global module, jest */
// Manual mock for expo-secure-store — auto-loaded by Jest from
// apps/mobile/__mocks__/. Surface mirrors what secureBoot + the
// chunked secureStorage adapter use (getItemAsync, setItemAsync,
// deleteItemAsync, isAvailableAsync) plus the accessibility constants.
//
// Merged surface (consolidation):
//   - Sprint 18 / SEC-1: failure-mode injection via
//     __setSecureStoreFailure + reset via __resetSecureStoreForTests,
//     used by secureBoot's keychain-unavailable path.
//   - secure-store adapter: methods are jest.fn() so its tests can
//     assert on .mock.calls; __reset() is the alias that suite uses.

let store = new Map();
let failureMode = null; // null | 'all' | 'get' | 'set' | 'delete'

function maybeFail(op) {
  if (failureMode === 'all') throw new Error('mock: secure store unavailable');
  if (failureMode === op) throw new Error(`mock: ${op} failed`);
}

const getItemAsync = jest.fn(async (key /* , opts */) => {
  maybeFail('get');
  return store.has(key) ? store.get(key) : null;
});

const setItemAsync = jest.fn(async (key, value /* , opts */) => {
  maybeFail('set');
  store.set(key, value);
});

const deleteItemAsync = jest.fn(async (key /* , opts */) => {
  maybeFail('delete');
  store.delete(key);
});

const isAvailableAsync = jest.fn(async () => failureMode !== 'all');

function __resetSecureStoreForTests() {
  store = new Map();
  failureMode = null;
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
  isAvailableAsync.mockClear();
}

function __setSecureStoreFailure(mode) {
  failureMode = mode;
}

function __seedSecureStoreForTests(seed) {
  store = new Map(Object.entries(seed));
}

module.exports = {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
  // Accessibility constants — values are arbitrary in the mock;
  // production code passes them as-is to native, which ignores them
  // under jest-expo.
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
  __resetSecureStoreForTests,
  __setSecureStoreFailure,
  __seedSecureStoreForTests,
  // Alias used by the secure-store adapter's own test suite.
  __reset: __resetSecureStoreForTests,
};
