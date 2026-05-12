/* global module, jest */
// Manual mock for @react-native-community/netinfo. Auto-loaded by Jest
// because it lives in __mocks__ adjacent to node_modules. Provides a
// controllable in-memory subscriber list so tests can drive offline /
// online transitions without spinning up real network probes.

const listeners = new Set();

let currentState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: { isConnectionExpensive: false },
};

function fetch() {
  return Promise.resolve(currentState);
}

function refresh() {
  return Promise.resolve(currentState);
}

function addEventListener(listener) {
  listeners.add(listener);
  // NetInfo fires the current state once on subscribe.
  Promise.resolve().then(() => listener(currentState));
  return () => listeners.delete(listener);
}

// Test helper — not part of the public API. Imported via
// `require('@react-native-community/netinfo')` then accessed as
// `__setMockState({ ... })`. Mutates the singleton state and fans out
// to every subscriber synchronously.
function __setMockState(next) {
  currentState = { ...currentState, ...next };
  for (const l of listeners) l(currentState);
}

function __resetMockState() {
  currentState = {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: { isConnectionExpensive: false },
  };
  listeners.clear();
}

const NetInfoStateType = {
  unknown: 'unknown',
  none: 'none',
  cellular: 'cellular',
  wifi: 'wifi',
  bluetooth: 'bluetooth',
  ethernet: 'ethernet',
  wimax: 'wimax',
  vpn: 'vpn',
  other: 'other',
};

const useNetInfo = jest.fn(() => currentState);
const useNetInfoInstance = jest.fn(() => ({
  netInfo: currentState,
  refresh,
}));

module.exports = {
  default: {
    configure: () => {},
    fetch,
    refresh,
    addEventListener,
    useNetInfo,
    useNetInfoInstance,
  },
  configure: () => {},
  fetch,
  refresh,
  addEventListener,
  useNetInfo,
  useNetInfoInstance,
  NetInfoStateType,
  __setMockState,
  __resetMockState,
};
