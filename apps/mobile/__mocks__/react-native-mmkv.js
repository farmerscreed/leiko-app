/* global module */
// Manual mock for react-native-mmkv 4.x — auto-loaded by Jest because it
// sits in __mocks__ adjacent to node_modules. Provides a JS-only Map-
// backed substitute so storage.ts can run under both Jest projects (pure
// ts-jest node + jest-expo RN). Surface mirrors the methods our app
// actually uses (set, getString, remove, contains, getAllKeys, clearAll).
//
// API: mmkv 4.x replaced `new MMKV()` with `createMMKV(config)`, and
// `delete()` with `remove()`. Mock matches that.

class MockMMKV {
  constructor(config) {
    this.id = (config && config.id) || 'mmkv.default';
    this._map = new Map();
  }
  set(key, value) {
    this._map.set(key, String(value));
  }
  getString(key) {
    return this._map.has(key) ? this._map.get(key) : undefined;
  }
  getBoolean(key) {
    const v = this._map.get(key);
    if (v === undefined) return undefined;
    return v === 'true';
  }
  getNumber(key) {
    const v = this._map.get(key);
    if (v === undefined) return undefined;
    return Number(v);
  }
  contains(key) {
    return this._map.has(key);
  }
  remove(key) {
    return this._map.delete(key);
  }
  getAllKeys() {
    return [...this._map.keys()];
  }
  clearAll() {
    this._map.clear();
  }
}

module.exports = {
  createMMKV: (config) => new MockMMKV(config),
  // Stubs for the rest of the package surface — present so imports don't
  // fail at evaluation time. None are exercised by Sprint 2 code.
  existsMMKV: () => false,
  deleteMMKV: () => {},
  useMMKV: () => new MockMMKV(),
  useMMKVString: () => [undefined, () => {}],
  useMMKVNumber: () => [undefined, () => {}],
  useMMKVBoolean: () => [undefined, () => {}],
  useMMKVObject: () => [undefined, () => {}],
  useMMKVBuffer: () => [undefined, () => {}],
  useMMKVListener: () => {},
  useMMKVKeys: () => [],
};
