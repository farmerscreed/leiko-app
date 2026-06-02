// Sprint 19 Block 1 — viewerCanInvite gate.

import { viewerCanInvite } from '../Home/CaregiverHome';

describe('viewerCanInvite', () => {
  it('returns false when the viewer has no family memberships', () => {
    expect(viewerCanInvite([])).toBe(false);
  });

  it('returns false when the viewer is a caregiver in every family', () => {
    expect(
      viewerCanInvite([
        { viewerRole: 'caregiver' },
        { viewerRole: 'caregiver' },
      ]),
    ).toBe(false);
  });

  it('returns true when the viewer is family_owner of at least one family', () => {
    expect(
      viewerCanInvite([
        { viewerRole: 'caregiver' },
        { viewerRole: 'family_owner' },
      ]),
    ).toBe(true);
  });

  it('returns true when the viewer is family_owner of the only family', () => {
    expect(viewerCanInvite([{ viewerRole: 'family_owner' }])).toBe(true);
  });

  it('returns false when the role field is missing entirely (legacy rows)', () => {
    expect(viewerCanInvite([{}])).toBe(false);
  });
});
