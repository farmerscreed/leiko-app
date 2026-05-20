/* global module */
// Manual mock for expo-secure-store — auto-loaded by Jest from
// apps/mobile/__mocks__/. Surface mirrors what secureBoot uses
// (getItemAsync, setItemAsync, deleteItemAsync) plus the
// WHEN_UNLOCKED accessibility constant.
//
// Sprint 18 / SEC-1 — tests reset via __resetSecureStoreForTests.
// The mock can be put into "failure mode" via __setSecureStoreFailure
// to exercise the keychain-unavailable code path in secureBoot.

let store = new Map();
let failureMode = null; // null | 'all' | 'get' | 'set'

function maybeFail(op) {
  if (failureMode === 'all') throw new Error('mock: secure store unavailable');
  if (failureMode === op) throw new Error(`mock: ${op} failed`);
}

async function getItemAsync(key /* , opts */) {
  maybeFail('get');
  return store.has(key) ? store.get(key) : null;
}

async function setItemAsync(key, value /* , opts */) {
  maybeFail('set');
  store.set(key, value);
}

async function deleteItemAsync(key /* , opts */) {
  maybeFail('delete');
  store.delete(key);
}

function __resetSecureStoreForTests() {
  store = new Map();
  failureMode = null;
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
  // Accessibility constants — values are arbitrary in the mock;
  // production code passes them as-is to native, which ignores them
  // under jest-expo.
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
  __resetSecureStoreForTests,
  __setSecureStoreFailure,
  __seedSecureStoreForTests,
};
