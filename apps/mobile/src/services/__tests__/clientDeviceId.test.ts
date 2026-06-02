// getOrCreateClientDeviceId — the stable per-install watch identity that
// replaces the rotating BLE MAC as the server's device dedupe key.

import { getOrCreateClientDeviceId, STORAGE_KEYS, mmkv } from '../storage';

describe('getOrCreateClientDeviceId', () => {
  beforeEach(() => {
    mmkv.remove(STORAGE_KEYS.clientDeviceId);
  });

  it('generates an id on first call and persists it to MMKV', () => {
    const id = getOrCreateClientDeviceId();
    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
    expect(mmkv.getString(STORAGE_KEYS.clientDeviceId)).toBe(id);
  });

  it('returns the same id on subsequent calls (survives reconnect/re-pair)', () => {
    const first = getOrCreateClientDeviceId();
    const second = getOrCreateClientDeviceId();
    expect(second).toBe(first);
  });

  it('reuses an id already present in storage rather than minting a new one', () => {
    mmkv.set(STORAGE_KEYS.clientDeviceId, 'preexisting-stable-id');
    expect(getOrCreateClientDeviceId()).toBe('preexisting-stable-id');
  });
});
