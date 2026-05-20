// useEnforceVisibility tests — Sprint 17b.
//
// Pure-helper coverage. The hook's Realtime side-effect is covered
// indirectly via `diffHiddenVitals`.

import { diffHiddenVitals } from '../useEnforceVisibility';

describe('diffHiddenVitals', () => {
  const base = {
    bp: true,
    hr: true,
    spo2: true,
    sleep: true,
    activity: true,
  } as const;

  it('returns an empty list when nothing changed', () => {
    expect(diffHiddenVitals(base, base)).toEqual([]);
  });

  it('returns vitals that flipped visible → hidden', () => {
    expect(
      diffHiddenVitals(base, { ...base, hr: false, sleep: false }),
    ).toEqual(['hr', 'sleep']);
  });

  it('ignores vitals that flipped hidden → visible (no purge needed)', () => {
    expect(
      diffHiddenVitals(
        { ...base, hr: false },
        { ...base, hr: true },
      ),
    ).toEqual([]);
  });

  it('does not include vitals that were already hidden', () => {
    expect(
      diffHiddenVitals(
        { ...base, hr: false, sleep: false },
        { ...base, hr: false, sleep: false, spo2: false },
      ),
    ).toEqual(['spo2']);
  });
});
