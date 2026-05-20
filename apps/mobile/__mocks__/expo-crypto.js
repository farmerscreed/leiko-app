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

module.exports = {
  getRandomBytesAsync,
  __setRandomBytesForTests,
};
