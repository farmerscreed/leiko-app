/* eslint-disable @typescript-eslint/no-require-imports */
// In-memory implementation of the react-native-ble-plx surface the Leiko
// app uses. Conforms to the same shapes (BleManager, Device, State enum,
// Subscription) so it can be dropped in via Jest's __mocks__ folder.
//
// The hand-written shim deliberately covers ONLY the methods we call in
// production (services/ble/*). Adding a ble-plx call site means adding
// the corresponding mock method here. Tests fail loud, not silent, on
// missing surface.
//
// Test surface — exported alongside production-shape methods:
//   • new BleManager() yields a MockBleManager. Cast to access __helpers.
//   • mgr.__scriptScan(devices)             pre-load scan results
//   • mgr.__scriptConnectError(id, err)     reject the connect for id
//   • mgr.__setState('PoweredOff' | 'PoweredOn' | …) flip BT state
//   • dev.__pushNotify(b64)                 emit a notify packet
//   • clearMockState()                      reset the singleton between tests

const State = Object.freeze({
  Unknown: 'Unknown',
  Resetting: 'Resetting',
  Unsupported: 'Unsupported',
  Unauthorized: 'Unauthorized',
  PoweredOff: 'PoweredOff',
  PoweredOn: 'PoweredOn',
});

class MockSubscription {
  constructor(remove) { this._remove = remove; }
  remove() { if (this._remove) { this._remove(); this._remove = null; } }
}

class MockDevice {
  constructor({ id, name = null, rssi = -55 }) {
    this.id = id;
    this.name = name;
    this.localName = name;
    this.rssi = rssi;
    this.serviceUUIDs = [];
    this._notifyListeners = new Set();
    this._writes = [];
    this._connected = true;
    this._disconnectListeners = new Set();
  }
  async discoverAllServicesAndCharacteristics() { return this; }
  monitorCharacteristicForService(_service, _char, cb) {
    this._notifyListeners.add(cb);
    return new MockSubscription(() => this._notifyListeners.delete(cb));
  }
  async writeCharacteristicWithoutResponseForService(_service, _char, valueB64) {
    this._writes.push(valueB64);
    return this;
  }
  async writeCharacteristicWithResponseForService(_service, _char, valueB64) {
    this._writes.push(valueB64);
    return this;
  }
  async cancelConnection() {
    this._connected = false;
    for (const l of this._disconnectListeners) l(null, this);
    return this;
  }
  async isConnected() { return this._connected; }
  onDisconnected(cb) {
    this._disconnectListeners.add(cb);
    return new MockSubscription(() => this._disconnectListeners.delete(cb));
  }
  // ── test helpers ──
  __pushNotify(valueB64) {
    for (const cb of this._notifyListeners) cb(null, { value: valueB64 });
  }
  __pushNotifyError(err) {
    for (const cb of this._notifyListeners) cb(err, null);
  }
  __forceDisconnect(reason = 'remote_disconnect') {
    this._connected = false;
    const err = new Error(reason);
    for (const l of this._disconnectListeners) l(err, this);
  }
  get __writes() { return this._writes.slice(); }
}

class MockBleManager {
  constructor(options = {}) {
    this._options = options;
    this._state = State.PoweredOn;
    this._stateListeners = new Set();
    this._scanCallbacks = new Set();
    this._scriptedDevices = [];
    this._scriptedConnectErrors = new Map();
    this._connectedDevices = new Map();
    MockBleManager._lastInstance = this;
  }
  destroy() {
    this._stateListeners.clear();
    this._scanCallbacks.clear();
    this._connectedDevices.clear();
  }
  async state() { return this._state; }
  onStateChange(cb, emitCurrentState = false) {
    this._stateListeners.add(cb);
    if (emitCurrentState) Promise.resolve().then(() => cb(this._state));
    return new MockSubscription(() => this._stateListeners.delete(cb));
  }
  startDeviceScan(_serviceUUIDs, _options, cb) {
    this._scanCallbacks.add(cb);
    Promise.resolve().then(() => {
      for (const dev of this._scriptedDevices) {
        if (this._scanCallbacks.has(cb)) cb(null, dev);
      }
    });
  }
  stopDeviceScan() { this._scanCallbacks.clear(); }
  async connectToDevice(deviceId, _options) {
    if (this._scriptedConnectErrors.has(deviceId)) {
      throw this._scriptedConnectErrors.get(deviceId);
    }
    let dev = this._connectedDevices.get(deviceId);
    if (!dev) {
      const scripted = this._scriptedDevices.find((d) => d.id === deviceId);
      dev = scripted ?? new MockDevice({ id: deviceId, name: 'Leiko Watch' });
      this._connectedDevices.set(deviceId, dev);
    }
    dev._connected = true;
    return dev;
  }
  async cancelDeviceConnection(deviceId) {
    const dev = this._connectedDevices.get(deviceId);
    if (dev) await dev.cancelConnection();
    this._connectedDevices.delete(deviceId);
    return dev ?? null;
  }
  // ── test helpers ──
  __scriptScan(devices) {
    this._scriptedDevices = devices.map((d) =>
      d instanceof MockDevice ? d : new MockDevice(d),
    );
    for (const cb of this._scanCallbacks) {
      for (const dev of this._scriptedDevices) cb(null, dev);
    }
  }
  __scriptConnectError(deviceId, err) {
    this._scriptedConnectErrors.set(deviceId, err);
  }
  __scriptScanError(err) {
    for (const cb of this._scanCallbacks) cb(err, null);
  }
  __setState(state) {
    this._state = state;
    for (const cb of this._stateListeners) cb(state);
  }
  __getConnectedDevice(deviceId) { return this._connectedDevices.get(deviceId); }
}

MockBleManager._lastInstance = null;

function getLastManager() { return MockBleManager._lastInstance; }

function clearMockState() {
  MockBleManager._lastInstance = null;
}

module.exports = {
  BleManager: MockBleManager,
  Device: MockDevice,
  State,
  // test surface
  MockBleManager,
  MockDevice,
  MockSubscription,
  getLastManager,
  clearMockState,
};
