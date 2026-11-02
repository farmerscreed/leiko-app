// Turn the platform-health bridge on: ask the OS for permission, mirror
// what was granted into the toggles, then copy past readings over.
//
// 2026-11-02: the Settings master switch used to flip the toggle without
// asking Android, so a user who had dismissed the one-time Home prompt
// got a switch that said "on" while every Health Connect write was
// refused for lack of permission. Both entry points (Settings and the
// Home prompt) now go through here.

import { Platform } from 'react-native';
import { logger } from '../analytics/logger';
import { ALL_READ_KINDS, ALL_WRITE_KINDS, requestPermissions } from './index';
import { setMaster, setReadVital, setWriteVital } from './toggles';
import { backfillHealthPlatform } from './backfill';

export type ConnectOutcome = 'connected' | 'none_granted' | 'unavailable';

export async function connectHealthPlatform(): Promise<ConnectOutcome> {
  let grant;
  try {
    grant = await requestPermissions({ write: ALL_WRITE_KINDS, read: ALL_READ_KINDS });
  } catch {
    logger.track('health_platform_permission_skipped', {
      platform: Platform.OS,
      reason: 'request_failed',
    });
    return 'unavailable';
  }
  if (!grant.userPrompted) {
    logger.track('health_platform_permission_skipped', {
      platform: Platform.OS,
      reason: 'os_unavailable',
    });
    return 'unavailable';
  }

  for (const k of ALL_WRITE_KINDS) setWriteVital(k, grant.write[k] === true);
  for (const k of ALL_READ_KINDS) setReadVital(k, grant.read[k] === true);
  const anyGranted =
    ALL_WRITE_KINDS.some((k) => grant.write[k]) || ALL_READ_KINDS.some((k) => grant.read[k]);
  setMaster(anyGranted);
  if (!anyGranted) return 'none_granted';

  logger.track('health_platform_permission_granted', { platform: Platform.OS });
  // Fire and forget: the copy reports progress through useHealthBackfill.
  void backfillHealthPlatform();
  return 'connected';
}

/** Turning a single "Share …" row on needs that permission too. */
export async function enableWriteVital(kind: (typeof ALL_WRITE_KINDS)[number]): Promise<boolean> {
  try {
    const grant = await requestPermissions({ write: [kind], read: [] });
    const ok = grant.write[kind] === true;
    setWriteVital(kind, ok);
    if (ok) void backfillHealthPlatform();
    return ok;
  } catch {
    setWriteVital(kind, false);
    return false;
  }
}
