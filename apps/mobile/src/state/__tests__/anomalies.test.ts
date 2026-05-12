// Anomaly store selector tests — Sprint 15.

import {
  pickMostSevere,
  pickMostSevereForVital,
  findEventForReading,
  type AnomalyEvent,
} from '../anomalies';

const calmBp: AnomalyEvent = {
  id: 'a',
  userId: 'u1',
  familyId: 'f1',
  vital: 'bp',
  tier: 'calm_concerned',
  reason: 'outlier_and_soft_threshold',
  readingId: 'r1',
  triggeredAtSec: 1000,
  acknowledgedAt: null,
  feedbackThumb: 0,
};

const urgentHr: AnomalyEvent = {
  id: 'b',
  userId: 'u1',
  familyId: 'f1',
  vital: 'hr',
  tier: 'confirmed_urgent',
  reason: 'extreme_value',
  readingId: null,
  triggeredAtSec: 2000,
  acknowledgedAt: null,
  feedbackThumb: 0,
};

const calmSpO2: AnomalyEvent = {
  id: 'c',
  userId: 'u1',
  familyId: 'f1',
  vital: 'spo2',
  tier: 'calm_concerned',
  reason: 'sample_or_overnight_borderline',
  readingId: null,
  triggeredAtSec: 3000,
  acknowledgedAt: null,
  feedbackThumb: 0,
};

describe('pickMostSevere', () => {
  it('returns null when empty', () => {
    expect(pickMostSevere([])).toBeNull();
  });

  it('returns null when all are acknowledged', () => {
    expect(
      pickMostSevere([{ ...calmBp, acknowledgedAt: Date.now() }]),
    ).toBeNull();
  });

  it('prefers urgent over calm even when calm is newer', () => {
    const result = pickMostSevere([
      calmSpO2,                                   // triggeredAt=3000, calm
      urgentHr,                                   // triggeredAt=2000, urgent
    ]);
    expect(result?.id).toBe('b');
  });

  it('within same tier prefers newer', () => {
    const result = pickMostSevere([calmBp, calmSpO2]);
    expect(result?.id).toBe('c');
  });
});

describe('pickMostSevereForVital', () => {
  it('filters by vital', () => {
    const events = [calmBp, urgentHr, calmSpO2];
    expect(pickMostSevereForVital(events, 'bp')?.id).toBe('a');
    expect(pickMostSevereForVital(events, 'hr')?.id).toBe('b');
    expect(pickMostSevereForVital(events, 'spo2')?.id).toBe('c');
  });

  it('returns null when no event for vital', () => {
    expect(pickMostSevereForVital([calmBp], 'hr')).toBeNull();
  });
});

describe('findEventForReading', () => {
  it('matches by readingId', () => {
    expect(findEventForReading([calmBp], 'r1')?.id).toBe('a');
  });

  it('returns null for unacknowledged or different reading', () => {
    expect(findEventForReading([calmBp], 'other')).toBeNull();
    expect(
      findEventForReading([{ ...calmBp, acknowledgedAt: 1 }], 'r1'),
    ).toBeNull();
  });
});
