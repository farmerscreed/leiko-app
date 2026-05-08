import {
  caregiverPersonFromParent,
  caregiverPeopleFromParents,
} from '../caregiverPerson';
import type {
  ParentSummary,
  ReadingSummary,
} from '../../services/families/fetchParentSummaries';

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

function reading(
  partial: Partial<ReadingSummary> & { measuredAt: string },
): ReadingSummary {
  return {
    id: 'r1',
    measuredAt: partial.measuredAt,
    systolic: partial.systolic ?? 122,
    diastolic: partial.diastolic ?? 78,
    pulse: partial.pulse ?? 64,
    qualityScore: partial.qualityScore ?? 'good',
  };
}

function summary(partial: Partial<ParentSummary> = {}): ParentSummary {
  return {
    familyId: partial.familyId ?? 'fam-1',
    parentDisplayName: partial.parentDisplayName ?? 'Marian Okeke',
    parentRelationship: partial.parentRelationship ?? 'Mom',
    parentYearOfBirth: partial.parentYearOfBirth ?? 1955,
    latestReading: partial.latestReading ?? null,
    recentReadings: partial.recentReadings ?? [],
    latestHr: partial.latestHr ?? null,
    latestSpo2: partial.latestSpo2 ?? null,
    latestSleep: partial.latestSleep ?? null,
  };
}

describe('caregiverPersonFromParent — accent rotation', () => {
  it('rotates the slot index 0/1/2 → 1/2/3', () => {
    expect(caregiverPersonFromParent(summary(), 0, NOW).accentIndex).toBe(1);
    expect(caregiverPersonFromParent(summary(), 1, NOW).accentIndex).toBe(2);
    expect(caregiverPersonFromParent(summary(), 2, NOW).accentIndex).toBe(3);
  });

  it('wraps at index 3+ back to slot 1', () => {
    expect(caregiverPersonFromParent(summary(), 3, NOW).accentIndex).toBe(1);
    expect(caregiverPersonFromParent(summary(), 4, NOW).accentIndex).toBe(2);
    expect(caregiverPersonFromParent(summary(), 5, NOW).accentIndex).toBe(3);
    expect(caregiverPersonFromParent(summary(), 6, NOW).accentIndex).toBe(1);
  });
});

describe('caregiverPersonFromParent — initial', () => {
  it('takes the uppercased first letter of the trimmed name', () => {
    expect(
      caregiverPersonFromParent(summary({ parentDisplayName: 'marian Okeke' }), 0, NOW)
        .initial,
    ).toBe('M');
  });

  it('returns "·" for an empty name', () => {
    expect(
      caregiverPersonFromParent(summary({ parentDisplayName: '   ' }), 0, NOW).initial,
    ).toBe('·');
  });

  it('keeps the rest of the name unchanged in fullName', () => {
    expect(
      caregiverPersonFromParent(summary({ parentDisplayName: 'Marian Okeke' }), 0, NOW)
        .fullName,
    ).toBe('Marian Okeke');
  });

  it('falls back to "Family member" when name is empty', () => {
    expect(
      caregiverPersonFromParent(summary({ parentDisplayName: '' }), 0, NOW).fullName,
    ).toBe('Family member');
  });
});

describe('caregiverPersonFromParent — status mapping (D13 §6 + D10 anomaly)', () => {
  function withReading(p: Partial<ReadingSummary>): ParentSummary {
    return summary({ latestReading: reading({ measuredAt: '2023-11-14T20:53:00Z', ...p }) });
  }

  it('returns "clear" when classification is in_pattern and the reading is fresh', () => {
    // 2023-11-14T20:53:00Z is exactly NOW (1_700_000_000_000)
    const p = caregiverPersonFromParent(withReading({ systolic: 122, diastolic: 78 }), 0, NOW);
    expect(p.status).toBe('clear');
    expect(p.bpLabel).toBe('122/78');
  });

  it('returns "attention" when classification is calm_concerned', () => {
    // 165/100 — above calm_concerned threshold but below confirmed_urgent
    const p = caregiverPersonFromParent(withReading({ systolic: 165, diastolic: 100 }), 0, NOW);
    expect(p.status).toBe('attention');
    expect(p.headline).toContain("pattern");
  });

  it('returns "urgent" when classification is confirmed_urgent (≥180/120)', () => {
    const p = caregiverPersonFromParent(withReading({ systolic: 185, diastolic: 125 }), 0, NOW);
    expect(p.status).toBe('urgent');
    expect(p.headline).toContain('calm check-in');
  });

  it('returns "offline" when latest reading is older than 12h', () => {
    const measuredAtMs = NOW - 13 * HOUR;
    const p = caregiverPersonFromParent(
      summary({ latestReading: reading({ measuredAt: new Date(measuredAtMs).toISOString() }) }),
      0,
      NOW,
    );
    expect(p.status).toBe('offline');
    expect(p.headline).toContain('Last reading');
  });

  it('treats stale-but-classifiable as offline (staleness wins)', () => {
    const measuredAtMs = NOW - 13 * HOUR;
    const p = caregiverPersonFromParent(
      summary({
        latestReading: reading({
          measuredAt: new Date(measuredAtMs).toISOString(),
          systolic: 200,
          diastolic: 130,
        }),
      }),
      0,
      NOW,
    );
    expect(p.status).toBe('offline'); // not 'urgent'
  });

  it('returns "clear" / "—" / "No readings yet" when latestReading is null', () => {
    const p = caregiverPersonFromParent(summary({ latestReading: null }), 0, NOW);
    expect(p.status).toBe('clear');
    expect(p.bpLabel).toBe('—');
    expect(p.headline).toBe('No readings yet');
  });
});

describe('caregiverPersonFromParent — voice rules in headlines', () => {
  const FORBIDDEN = [
    /patient/i,
    /diagnose/i,
    /silent killer/i,
    /critical/i,
    /dangerous level/i,
    /medical advice/i,
  ];

  function checkVoice(headline: string): void {
    for (const pattern of FORBIDDEN) {
      expect(headline).not.toMatch(pattern);
    }
  }

  it('clear-state headline passes', () => {
    const p = caregiverPersonFromParent(
      summary({ latestReading: reading({ measuredAt: new Date(NOW - HOUR).toISOString() }) }),
      0,
      NOW,
    );
    checkVoice(p.headline);
  });

  it('attention-state headline passes', () => {
    const p = caregiverPersonFromParent(
      summary({
        latestReading: reading({
          measuredAt: new Date(NOW - HOUR).toISOString(),
          systolic: 165,
          diastolic: 100,
        }),
      }),
      0,
      NOW,
    );
    checkVoice(p.headline);
  });

  it('urgent-state headline passes', () => {
    const p = caregiverPersonFromParent(
      summary({
        latestReading: reading({
          measuredAt: new Date(NOW - HOUR).toISOString(),
          systolic: 185,
          diastolic: 125,
        }),
      }),
      0,
      NOW,
    );
    checkVoice(p.headline);
  });

  it('offline-state headline passes', () => {
    const p = caregiverPersonFromParent(
      summary({
        latestReading: reading({
          measuredAt: new Date(NOW - 13 * HOUR).toISOString(),
        }),
      }),
      0,
      NOW,
    );
    checkVoice(p.headline);
  });

  it('no-data headline passes', () => {
    const p = caregiverPersonFromParent(summary({ latestReading: null }), 0, NOW);
    checkVoice(p.headline);
  });
});

describe('caregiverPeopleFromParents — list mapping', () => {
  it('returns one CaregiverPerson per ParentSummary, in order', () => {
    const out = caregiverPeopleFromParents(
      [
        summary({ familyId: 'a', parentDisplayName: 'Anna' }),
        summary({ familyId: 'b', parentDisplayName: 'Bola' }),
        summary({ familyId: 'c', parentDisplayName: 'Chinwe' }),
      ],
      NOW,
    );
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((p) => p.initial)).toEqual(['A', 'B', 'C']);
    expect(out.map((p) => p.accentIndex)).toEqual([1, 2, 3]);
  });
});
