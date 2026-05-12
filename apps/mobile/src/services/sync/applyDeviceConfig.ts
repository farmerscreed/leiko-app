// applyDeviceConfig — Sprint 10b.2.
//
// Closes the multi_vitals_gap.md follow-up: "setUserParams + setGoals
// writers stubbed ... Wire in Sprint 8.5+ when Settings lands."
//
// Composes user-facing Settings state (vitalSetup store + auth.profile
// demographics) into the four U16PRO configuration commands and pushes
// them to the connected watch:
//
//   • setAutoHR(autoHrEnabled)
//   • setAutoSpO2(autoSpo2Enabled)
//   • setUserParams({ gender, ageYears, heightCm, weightKg, ... })
//   • setGoals({ stepsTarget, sleepTargetMin, ... })
//
// Called by the orchestrator after a successful connect, before the
// data backlog pull. Failures are logged but never abort the sync —
// the watch keeps its previous config and we'll retry on the next
// run (dirty flag stays true).
//
// Idempotency: when vitalSetup.dirty is false AND profile demographics
// haven't changed since the last successful flush, this function is a
// no-op. The dirty flag is set by every Settings write; we clear it
// only on a successful flush so a partial failure (e.g. setUserParams
// succeeds but setGoals throws) leaves dirty=true and the next sync
// retries the full sequence — Settings → watch is a "set of values"
// rather than "delta of changes" and the watch idempotently overwrites.
//
// Per CLAUDE.md voice + data rules: no PHI logged. Telemetry only
// emits {ok|failed, step}.

import { setAutoHR } from '../ble/commands/setAutoHR';
import { setAutoSpO2 } from '../ble/commands/setAutoSpO2';
import { setGoals } from '../ble/commands/setGoals';
import { setUserParams } from '../ble/commands/setUserParams';
import type { UrionDevice } from '../ble/UrionDevice';
import { logger } from '../analytics/logger';
import { getVitalSetup, useVitalSetup } from '../../state/vitalSetup';
import { useAuth } from '../../state/auth';
import type { UserRow } from '../../types/database';

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

export interface DeviceConfigResult {
  ran: boolean;
  /** Names of steps that succeeded — useful for partial-failure logs. */
  steps: string[];
  error?: string;
}

interface ApplyDeviceConfigOptions {
  /** Inject for tests. Defaults to the live Zustand stores. */
  vitalSetupSnapshot?: ReturnType<typeof getVitalSetup>;
  profileSnapshot?: UserRow | null;
  /** Inject for tests so the BLE wrappers can be spied on. */
  setters?: {
    setAutoHR: typeof setAutoHR;
    setAutoSpO2: typeof setAutoSpO2;
    setUserParams: typeof setUserParams;
    setGoals: typeof setGoals;
  };
  /** Force a flush even when dirty=false. Used by manual "re-sync settings". */
  force?: boolean;
}

const DEFAULT_SETTERS = { setAutoHR, setAutoSpO2, setUserParams, setGoals };

const CURRENT_YEAR = new Date().getFullYear();

export async function applyDeviceConfig(
  device: UrionDevice,
  opts: ApplyDeviceConfigOptions = {},
): Promise<DeviceConfigResult> {
  const setup = opts.vitalSetupSnapshot ?? getVitalSetup();
  const profile = opts.profileSnapshot ?? useAuth.getState().profile;
  const setters = opts.setters ?? DEFAULT_SETTERS;

  if (!opts.force && !setup.dirty) {
    if (BLE_TRACE) {
      console.log(
        '[ble-trace] applyDeviceConfig skipped — dirty=false force=false',
      );
    }
    return { ran: false, steps: [] };
  }

  if (BLE_TRACE) {
    console.log(
      `[ble-trace] applyDeviceConfig start — force=${opts.force ?? false} dirty=${setup.dirty} ` +
        `autoHR=${setup.autoHrEnabled} autoSpO2=${setup.autoSpo2Enabled} ` +
        `hasDemographics=${profile ? hasDemographics(profile) : false}`,
    );
  }

  const steps: string[] = [];

  // 1. Auto-HR ----------------------------------------------------------------
  try {
    await setters.setAutoHR(device, setup.autoHrEnabled);
    steps.push('autoHr');
    if (BLE_TRACE) console.log('[ble-trace] applyDeviceConfig step=autoHr ok');
  } catch (e) {
    return failPartial(steps, 'autoHr', e);
  }

  // 2. Auto-SpO2 --------------------------------------------------------------
  try {
    await setters.setAutoSpO2(device, setup.autoSpo2Enabled);
    steps.push('autoSpo2');
    if (BLE_TRACE) console.log('[ble-trace] applyDeviceConfig step=autoSpo2 ok');
  } catch (e) {
    return failPartial(steps, 'autoSpo2', e);
  }

  // 3. setUserParams (only when demographics are populated). Per
  //    memory/multi_vitals_gap.md the orchestrator skipped this step
  //    because there was no Settings UI to source the inputs. Now we
  //    have it — but a profile that hasn't filled in gender / height /
  //    weight yet still skips because the wire packet has no "absent"
  //    encoding. The watch keeps its previous demographics until the
  //    user fills them in.
  if (profile && hasDemographics(profile)) {
    try {
      await setters.setUserParams(device, {
        hourFormat: '24h', // not user-configurable yet (Settings preference comes later)
        units: 'metric',
        gender: profile.gender === 'female' ? 'female' : 'male',
        ageYears: profile.year_of_birth ? Math.max(1, CURRENT_YEAR - profile.year_of_birth) : 30,
        heightCm: profile.height_cm ?? 170,
        weightKg: profile.weight_kg !== null ? Math.round(profile.weight_kg) : 70,
        strapSizeMm: 0,
        hrAlarmBpm: 0,
      });
      steps.push('userParams');
      if (BLE_TRACE) console.log('[ble-trace] applyDeviceConfig step=userParams ok');
    } catch (e) {
      return failPartial(steps, 'userParams', e);
    }
  } else if (BLE_TRACE) {
    console.log(
      `[ble-trace] applyDeviceConfig step=userParams SKIPPED ` +
        `(profile=${profile ? 'present' : 'null'}, hasDemographics=false). ` +
        'Watch will not receive demographics this cycle.',
    );
  }

  // 4. setGoals ---------------------------------------------------------------
  try {
    await setters.setGoals(device, {
      stepsTarget: setup.stepsTarget,
      // BLE setGoals takes calorie + distance + standing + exercise too
      // — wired with sensible defaults until Settings exposes them.
      kcalTarget: 2000,
      standingTargetHours: 12,
      distanceTargetMeters: 5000,
      sleepTargetMinutes: setup.sleepTargetMin,
      exerciseTargetMinutes: 30,
    });
    steps.push('goals');
    if (BLE_TRACE) console.log('[ble-trace] applyDeviceConfig step=goals ok');
  } catch (e) {
    return failPartial(steps, 'goals', e);
  }

  // All four packets succeeded — clear dirty so the next no-config sync
  // skips this step entirely.
  useVitalSetup.getState().clearDirty();
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] applyDeviceConfig done — steps=${steps.length} [${steps.join(',')}]`,
    );
  }
  logger.track('device_config_flushed', { steps: steps.length });
  return { ran: true, steps };
}

function failPartial(
  steps: string[],
  failedStep: string,
  e: unknown,
): DeviceConfigResult {
  const error = e instanceof Error ? e.message : String(e);
  logger.track('device_config_failed', { failedStep, completed: steps.length });
  return { ran: true, steps, error: `${failedStep}: ${error}` };
}

function hasDemographics(profile: UserRow): boolean {
  return (
    profile.year_of_birth !== null &&
    profile.height_cm !== null &&
    profile.weight_kg !== null &&
    profile.gender !== null
  );
}
