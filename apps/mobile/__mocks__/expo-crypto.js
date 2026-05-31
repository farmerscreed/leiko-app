/* global module */
// Manual mock for expo-crypto. secureBoot uses getRandomBytesAsync(32)
// to seed the MMKV encryption key. The mock returns a deterministic
// 32-byte sequence (0..31) so tests can assert exact behavior. Override
// via __setRandomBytesForTests when a specific key needs to be injected.

let nextBytes = null;

async function getRandomBytesAsync(n) {
  if (nextBytes) {
    const bytes = nextBytes;
    nextBytes = null;
    return bytes;
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = i & 0xff;
  return out;
}

function __setRandomBytesForTests(bytes) {
  nextBytes = bytes;
}

// storage.getOrCreateClientDeviceId() uses randomUUID() to mint the
// stable per-install device identity. Deterministic counter-based output
// keeps tests stable while still returning distinct values per call.
let uuidCounter = 0;
function randomUUID() {
  uuidCounter += 1;
  const hex = uuidCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

module.exports = {
  getRandomBytesAsync,
  randomUUID,
  __setRandomBytesForTests,
};
