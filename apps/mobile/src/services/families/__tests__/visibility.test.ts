import {
  DEFAULT_VISIBILITY,
  getEffectiveVisibility,
} from '../visibility';

describe('DEFAULT_VISIBILITY', () => {
  it('matches D13 §13.2 — sleep hidden by default, others visible', () => {
    expect(DEFAULT_VISIBILITY).toEqual({
      bp: true,
      hr: true,
      spo2: true,
      sleep: false,
      activity: true,
    });
  });
});

describe('getEffectiveVisibility', () => {
  it('returns the defaults when stored is null', () => {
    expect(getEffectiveVisibility(null)).toEqual(DEFAULT_VISIBILITY);
  });

  it('returns the defaults when stored is undefined', () => {
    expect(getEffectiveVisibility(undefined)).toEqual(DEFAULT_VISIBILITY);
  });

  it('coerces bp=true even when stored has bp=false', () => {
    const v = getEffectiveVisibility({
      bp: false,
      hr: true,
      spo2: true,
      sleep: true,
      activity: true,
    });
    expect(v.bp).toBe(true);
  });

  it('honours stored values for the non-BP vitals', () => {
    const v = getEffectiveVisibility({
      bp: true,
      hr: false,
      spo2: false,
      sleep: true,
      activity: false,
    });
    expect(v).toEqual({
      bp: true,
      hr: false,
      spo2: false,
      sleep: true,
      activity: false,
    });
  });

  it('falls back to defaults for missing keys in a partial map', () => {
    const v = getEffectiveVisibility({
      bp: true,
      hr: false,
    } as never);
    expect(v.hr).toBe(false);
    expect(v.spo2).toBe(true); // default
    expect(v.sleep).toBe(false); // default
    expect(v.activity).toBe(true); // default
  });
});
