// expo-secure-store mock. In-memory map keeps the secure adapter's
// chunked read/write/delete dance honest in jest without touching the
// real native module.

const store = new Map();

module.exports = {
  getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  setItemAsync: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    store.delete(key);
  }),
  isAvailableAsync: jest.fn(async () => true),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  __reset() {
    store.clear();
  },
};
