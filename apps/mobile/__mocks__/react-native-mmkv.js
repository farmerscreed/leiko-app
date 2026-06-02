/* global module */
// Manual mock for react-native-mmkv 4.x — auto-loaded by Jest because it
// sits in __mocks__ adjacent to node_modules. Provides a JS-only Map-
// backed substitute so storage.ts can run under both Jest projects (pure
// ts-jest node + jest-expo RN). Surface mirrors the methods our app
// actually uses (set, getString, getNumber, getBoolean, contains,
// remove, getAllKeys, clearAll) plus deleteMMKV for the Sprint 18
// legacy-cleanup path.
//
// Sprint 18 / SEC-1 — instances are keyed by `id` so calling
// createMMKV({ id: 'leiko' }) twice returns the SAME backing store, the
// way real MMKV behaves. Without that, secureBoot.migrate's two
// createMMKV calls (one for legacy, one for encrypted) would fan out
// into four separate maps and the migration test couldn't observe the
// copy.

const instances = new Map();

class MockMMKV {
  constructor(config) {
    this.id = (config && config.id) || 'mmkv.default';
    this.encryptionKey = (config && config.encryptionKey) || null;
    this._map = new Map();
  }
  // Typed-set discrimination: real MMKV stores per-type. The mock
  // serialises everything to string but remembers the original type so
  // typed getters return undefined for the wrong type — same contract
  // production code depends on (storage.ts always writes strings, but
  // the migration code reads through all three typed getters).
  set(key, value) {
    if (typeof value === 'number') {
      this._map.set(key, { type: 'number', value });
    } else if (typeof value === 'boolean') {
      this._map.set(key, { type: 'boolean', value });
    } else {
      this._map.set(key, { type: 'string', value: String(value) });
    }
  }
  getString(key) {
    const entry = this._map.get(key);
    return entry && entry.type === 'string' ? entry.value : undefined;
  }
  getBoolean(key) {
    const entry = this._map.get(key);
    return entry && entry.type === 'boolean' ? entry.value : undefined;
  }
  getNumber(key) {
    const entry = this._map.get(key);
    return entry && entry.type === 'number' ? entry.value : undefined;
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

function createMMKV(config) {
  const id = (config && config.id) || 'mmkv.default';
  const existing = instances.get(id);
  if (existing) {
    // Real MMKV: opening the same id with a different encryption key
    // would fail to read. The mock doesn't enforce that — tests pass an
    // explicit key + clear when they want a fresh slate.
    return existing;
  }
  const inst = new MockMMKV(config);
  instances.set(id, inst);
  return inst;
}

function deleteMMKV(id) {
  instances.delete(id || 'mmkv.default');
  return true;
}

// Test surface — let suites reset all mock instances between tests so
// state never leaks across files in jest's per-project parallel runs.
function __resetMmkvForTests() {
  instances.clear();
}

module.exports = {
  createMMKV,
  deleteMMKV,
  __resetMmkvForTests,
  // Stubs for the rest of the package surface — present so imports don't
  // fail at evaluation time. None are exercised by app code today.
  existsMMKV: (id) => instances.has(id || 'mmkv.default'),
  useMMKV: () => createMMKV(),
  useMMKVString: () => [undefined, () => {}],
  useMMKVNumber: () => [undefined, () => {}],
  useMMKVBoolean: () => [undefined, () => {}],
  useMMKVObject: () => [undefined, () => {}],
  useMMKVBuffer: () => [undefined, () => {}],
  useMMKVListener: () => {},
  useMMKVKeys: () => [],
};
