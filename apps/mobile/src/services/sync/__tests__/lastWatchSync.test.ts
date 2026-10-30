import { mmkv } from '../../storage';
import { formatLastWatchSync, getLastWatchSyncMs, recordWatchSync } from '../lastWatchSync';

beforeEach(() => mmkv.clearAll());

describe('lastWatchSync', () => {
  it('is empty until a sync completes', () => {
    expect(getLastWatchSyncMs()).toBeNull();
    expect(formatLastWatchSync(null)).toBe('Not yet synced');
  });

  it('records and reads back the sync time', () => {
    recordWatchSync(1_700_000_000_000);
    expect(getLastWatchSyncMs()).toBe(1_700_000_000_000);
  });

  it('formats relative to now (the founder saw "31 d ago" from the old BP-cursor source)', () => {
    const now = 1_700_000_000_000;
    expect(formatLastWatchSync(now - 20_000, now)).toBe('Just now');
    expect(formatLastWatchSync(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(formatLastWatchSync(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatLastWatchSync(now - 50 * 3_600_000, now)).toBe('2 d ago');
  });
});
