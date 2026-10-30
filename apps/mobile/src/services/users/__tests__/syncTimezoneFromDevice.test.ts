import { syncTimezoneFromDevice, type SyncTimezoneDeps } from '../syncTimezoneFromDevice';
import type { UserRow } from '../../../types/database';

function deps(over: Partial<SyncTimezoneDeps> & { tz?: string | null; device?: string } = {}) {
  const profile = over.tz === null ? null : ({ id: 'u1', timezone: over.tz ?? 'Africa/Lagos' } as UserRow);
  const update = jest.fn(async (_id: string, patch: { timezone: string }) => ({ ...(profile as UserRow), ...patch }));
  const applyProfile = jest.fn();
  return {
    update,
    applyProfile,
    d: {
      getProfile: () => profile,
      getDeviceTz: () => over.device ?? 'America/Los_Angeles',
      update,
      applyProfile,
      ...over,
    } as SyncTimezoneDeps,
  };
}

describe('syncTimezoneFromDevice', () => {
  it('updates the profile when the phone is in another timezone', async () => {
    const { d, update, applyProfile } = deps();
    await expect(syncTimezoneFromDevice(d)).resolves.toBe('updated');
    expect(update).toHaveBeenCalledWith('u1', { timezone: 'America/Los_Angeles' });
    expect(applyProfile).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'America/Los_Angeles' }));
  });
  it('does nothing when they already match', async () => {
    const { d, update } = deps({ tz: 'America/Los_Angeles' });
    await expect(syncTimezoneFromDevice(d)).resolves.toBe('unchanged');
    expect(update).not.toHaveBeenCalled();
  });
  it('skips when signed out', async () => {
    const { d } = deps({ tz: null });
    await expect(syncTimezoneFromDevice(d)).resolves.toBe('skipped');
  });
  it('never writes UTC or an invalid zone over a real one', async () => {
    for (const device of ['UTC', 'Not/AZone', '']) {
      const { d, update } = deps({ device });
      await expect(syncTimezoneFromDevice(d)).resolves.toBe('skipped');
      expect(update).not.toHaveBeenCalled();
    }
  });
  it('reports failure without throwing', async () => {
    const { d } = deps();
    d.update = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(syncTimezoneFromDevice(d)).resolves.toBe('failed');
  });
});
