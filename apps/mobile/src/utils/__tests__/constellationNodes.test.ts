import {
  buildConstellationNodes,
  isSelfCircle,
  hasSelfNode,
} from '../constellationNodes';
import type {
  ParentSummary,
  ReadingSummary,
} from '../../services/families/fetchParentSummaries';

const NOW = 1_700_000_000_000;

function reading(
  partial: Partial<ReadingSummary> & { measuredAt: string },
): ReadingSummary {
  return {
    id: partial.id ?? 'r1',
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
    viewerRole: partial.viewerRole ?? 'caregiver',
    caregiverRelationshipLabel: partial.caregiverRelationshipLabel ?? null,
    latestReading: partial.latestReading ?? null,
    recentReadings: partial.recentReadings ?? [],
    latestHr: partial.latestHr ?? null,
    latestSpo2: partial.latestSpo2 ?? null,
    latestSleep: partial.latestSleep ?? null,
  };
}

// A fresh in-range reading → 'clear' status.
const freshReading = reading({
  measuredAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
  systolic: 122,
  diastolic: 78,
});

describe('isSelfCircle', () => {
  it('detects the self-circle by parent_relationship', () => {
    expect(isSelfCircle(summary({ parentRelationship: 'self' }))).toBe(true);
    expect(isSelfCircle(summary({ parentRelationship: 'Self' }))).toBe(true);
    expect(isSelfCircle(summary({ parentRelationship: '  self ' }))).toBe(true);
  });

  it('treats relatives as non-self', () => {
    expect(isSelfCircle(summary({ parentRelationship: 'Mom' }))).toBe(false);
    expect(isSelfCircle(summary({ parentRelationship: 'uncle' }))).toBe(false);
  });
});

describe('buildConstellationNodes', () => {
  it('flags the self node and places it first when all calm', () => {
    const nodes = buildConstellationNodes(
      [
        summary({ familyId: 'mum', parentRelationship: 'Mom', latestReading: freshReading }),
        summary({ familyId: 'me', parentRelationship: 'self', latestReading: freshReading }),
      ],
      NOW,
    );
    expect(nodes[0].id).toBe('me');
    expect(nodes[0].isSelf).toBe(true);
    expect(nodes.find((n) => n.id === 'mum')?.isSelf).toBe(false);
  });

  it('lets an at-risk relative float above the self node', () => {
    const highReading = reading({
      measuredAt: new Date(NOW - 30 * 60 * 1000).toISOString(),
      systolic: 190,
      diastolic: 125, // confirmed-urgent range
    });
    const nodes = buildConstellationNodes(
      [
        summary({ familyId: 'me', parentRelationship: 'self', latestReading: freshReading }),
        summary({ familyId: 'dad', parentRelationship: 'father', latestReading: highReading }),
      ],
      NOW,
    );
    expect(nodes[0].id).toBe('dad'); // urgency pre-empts You
  });

  it('handles a pure self constellation', () => {
    const nodes = buildConstellationNodes(
      [summary({ familyId: 'me', parentRelationship: 'self', latestReading: freshReading })],
      NOW,
    );
    expect(nodes).toHaveLength(1);
    expect(hasSelfNode(nodes)).toBe(true);
  });

  it('handles a pure caregiver constellation (no self node)', () => {
    const nodes = buildConstellationNodes(
      [
        summary({ familyId: 'mum', parentRelationship: 'Mom', latestReading: freshReading }),
        summary({ familyId: 'dad', parentRelationship: 'father', latestReading: freshReading }),
      ],
      NOW,
    );
    expect(hasSelfNode(nodes)).toBe(false);
    expect(nodes).toHaveLength(2);
  });

  it('returns an empty array for no circles', () => {
    expect(buildConstellationNodes([], NOW)).toEqual([]);
  });
});
