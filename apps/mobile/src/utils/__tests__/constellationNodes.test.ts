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
  it('detects MY self-circle: relationship self AND viewer is family_owner', () => {
    const self = { parentRelationship: 'self', viewerRole: 'family_owner' as const };
    expect(isSelfCircle(summary(self))).toBe(true);
    expect(isSelfCircle(summary({ ...self, parentRelationship: 'Self' }))).toBe(true);
    expect(isSelfCircle(summary({ ...self, parentRelationship: '  self ' }))).toBe(true);
  });

  it('a self-relationship circle I only FOLLOW is NOT my self-node', () => {
    // The regression: every wearer's circle has relationship 'self'. A
    // caregiver following several wearers must NOT see them all as "self"
    // (they'd collapse into the centre You node and vanish from the orbit).
    expect(
      isSelfCircle(summary({ parentRelationship: 'self', viewerRole: 'caregiver' })),
    ).toBe(false);
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
        summary({ familyId: 'me', parentRelationship: 'self', viewerRole: 'family_owner', latestReading: freshReading }),
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
        summary({ familyId: 'me', parentRelationship: 'self', viewerRole: 'family_owner', latestReading: freshReading }),
        summary({ familyId: 'dad', parentRelationship: 'father', latestReading: highReading }),
      ],
      NOW,
    );
    expect(nodes[0].id).toBe('dad'); // urgency pre-empts You
  });

  it('handles a pure self constellation', () => {
    const nodes = buildConstellationNodes(
      [summary({ familyId: 'me', parentRelationship: 'self', viewerRole: 'family_owner', latestReading: freshReading })],
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

  it('a caregiver following multiple wearers sees them ALL (none collapse to self)', () => {
    // Regression: every wearer's circle has relationship 'self'. A
    // watchless caregiver following three wearers must see three NON-self
    // nodes (all orbit), not have two vanish into the centre.
    const nodes = buildConstellationNodes(
      [
        summary({ familyId: 'a', parentRelationship: 'self', viewerRole: 'caregiver', latestReading: freshReading }),
        summary({ familyId: 'b', parentRelationship: 'self', viewerRole: 'caregiver', latestReading: freshReading }),
        summary({ familyId: 'c', parentRelationship: 'self', viewerRole: 'caregiver', latestReading: freshReading }),
      ],
      NOW,
    );
    expect(hasSelfNode(nodes)).toBe(false);
    expect(nodes).toHaveLength(3);
    expect(nodes.every((n) => !n.isSelf)).toBe(true);
  });

  it('returns an empty array for no circles', () => {
    expect(buildConstellationNodes([], NOW)).toEqual([]);
  });
});
