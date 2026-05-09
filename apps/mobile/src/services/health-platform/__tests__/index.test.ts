// Contract tests for the public health-platform surface — exercises
// the mock adapter through the same import path real callers use.
// Sprint 9.5 / Task 3.

import {
  __reset,
  __seedExternal,
  __getWritten,
  __getLastPermissionRequest,
  __setAvailable,
  mockAdapter,
} from '../adapters/mock';
import {
  __setAdapterForTest,
  __resetAdapterForTest,
  getActivePlatform,
  isAvailable,
  readExternalSince,
  requestPermissions,
  write,
} from '../index';
import { LEIKO_BUNDLE_ID } from '../types';
import type { ExternalVitalSample } from '../types';

beforeEach(() => {
  __reset();
  __setAdapterForTest(mockAdapter);
});

afterAll(() => {
  __resetAdapterForTest();
});

describe('health-platform public surface', () => {
  it('reports the active adapter platform', () => {
    expect(getActivePlatform()).toBe('mock');
  });

  it('isAvailable() reflects the mock state', async () => {
    expect(await isAvailable()).toBe(true);
    __setAvailable(false);
    expect(await isAvailable()).toBe(false);
  });

  it('requestPermissions() forwards the request and reports prompted=true', async () => {
    const req = {
      write: ['bp', 'hr', 'sleep'] as const,
      read: ['weight'] as const,
    };
    const grant = await requestPermissions({ write: [...req.write], read: [...req.read] });
    expect(grant.userPrompted).toBe(true);
    expect(grant.write.bp).toBe(true);
    expect(grant.write.hr).toBe(true);
    expect(grant.write.sleep).toBe(true);
    expect(grant.read.weight).toBe(true);
    expect(__getLastPermissionRequest()?.write).toEqual([...req.write]);
  });

  it('write() fans out to per-vital adapter calls', async () => {
    const result = await write({
      bp: [
        {
          measuredAtSec: 1700000000,
          systolic: 124,
          diastolic: 78,
          pulse: 72,
          source: 'watch',
        },
      ],
      hr: [
        {
          measuredAtSec: 1700000060,
          bpm: 70,
          sampleWindowSec: 30,
          motionState: 'rest',
          isSpotCheck: false,
        },
      ],
      steps: [
        {
          dayLocal: '2026-05-09',
          measuredAtSec: 1700000000,
          totalSteps: 4321,
          targetSteps: 6000,
          lastSampleAtSec: 1700000000,
          hourly: Array(24).fill(0),
        },
      ],
    });

    expect(result.bp.written).toBe(1);
    expect(result.hr.written).toBe(1);
    expect(result.steps.written).toBe(1);
    expect(result.spo2.written).toBe(0);
    expect(result.sleep.written).toBe(0);
    expect(result.calories.written).toBe(0);

    const written = __getWritten();
    expect(written.bp).toHaveLength(1);
    expect(written.hr).toHaveLength(1);
    expect(written.steps).toHaveLength(1);
  });

  it('write() returns EMPTY_RESULT for absent vital arrays', async () => {
    const result = await write({});
    expect(result.bp.written).toBe(0);
    expect(result.bp.rejected).toBe(0);
    expect(result.calories.written).toBe(0);
  });

  it('readExternalSince() returns seeded samples filtered by sinceSec', async () => {
    const seeds: ExternalVitalSample[] = [
      {
        vitalType: 'weight',
        measuredAtSec: 1700000000,
        valueNumeric: 78.4,
        valueUnit: 'kg',
        sourceOrigin: 'com.withings.scale',
      },
      {
        vitalType: 'weight',
        measuredAtSec: 1600000000,
        valueNumeric: 80.1,
        valueUnit: 'kg',
        sourceOrigin: 'com.withings.scale',
      },
    ];
    __seedExternal(seeds);

    const out = await readExternalSince({ sinceSec: 1700000000 - 1 });
    expect(out).toHaveLength(1);
    expect(out[0].valueNumeric).toBe(78.4);
  });

  it('readExternalSince() filters samples whose source matches our own bundle', async () => {
    __seedExternal([
      {
        vitalType: 'blood_glucose',
        measuredAtSec: 1700000000,
        valueNumeric: 95,
        valueUnit: 'mg/dL',
        sourceOrigin: 'com.freestylelibre.app',
      },
      {
        vitalType: 'blood_glucose',
        measuredAtSec: 1700000060,
        valueNumeric: 5.3,
        valueUnit: 'mmol/L',
        // This is a Leiko-written sample. Round-trip filter must drop it.
        sourceOrigin: LEIKO_BUNDLE_ID,
      },
    ]);

    const out = await readExternalSince({ sinceSec: 0 });
    expect(out).toHaveLength(1);
    expect(out[0].sourceOrigin).toBe('com.freestylelibre.app');
  });

  it('readExternalSince() honours the vitals filter', async () => {
    __seedExternal([
      {
        vitalType: 'weight',
        measuredAtSec: 1700000000,
        valueNumeric: 78.4,
        valueUnit: 'kg',
        sourceOrigin: 'com.withings.scale',
      },
      {
        vitalType: 'height',
        measuredAtSec: 1700000000,
        valueNumeric: 1.78,
        valueUnit: 'm',
        sourceOrigin: 'com.apple.health',
      },
    ]);

    const out = await readExternalSince({ sinceSec: 0, vitals: ['weight'] });
    expect(out).toHaveLength(1);
    expect(out[0].vitalType).toBe('weight');
  });
});
