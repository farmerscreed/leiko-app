// Pure-TS test for buildTheme — no React, no RN. Runs under ts-jest.

import { buildTheme } from '../buildTheme';

describe('buildTheme — caregiver mode', () => {
  const theme = buildTheme('caregiver', false);

  it('exposes mode and reduceMotion verbatim', () => {
    expect(theme.mode).toBe('caregiver');
    expect(theme.reduceMotion).toBe(false);
  });

  it('returns the caregiver typography for body-l', () => {
    expect(theme.type('bodyL').size).toBe(17);
    expect(theme.type('bodyL').lineHeight).toBe(24);
  });

  it('uses 48pt as the min tap target', () => {
    expect(theme.minTapTarget).toBe(48);
  });

  it('uses 56pt as the list-row min height', () => {
    expect(theme.listRowMinHeight).toBe(56);
  });

  it('returns full duration when reduceMotion is off', () => {
    expect(theme.duration('normal')).toBe(200);
    expect(theme.duration('slow')).toBe(320);
    expect(theme.duration('deliberate')).toBe(480);
  });
});

describe('buildTheme — parent mode', () => {
  const theme = buildTheme('parent', false);

  it('returns 64pt min tap target', () => {
    expect(theme.minTapTarget).toBe(64);
  });

  it('returns 64pt list-row min height', () => {
    expect(theme.listRowMinHeight).toBe(64);
  });

  it('overrides body-l to 19pt', () => {
    expect(theme.type('bodyL').size).toBe(19);
  });

  it('overrides title to 20pt', () => {
    expect(theme.type('title').size).toBe(20);
  });

  it('falls back to caregiver scale for tokens with no parent override', () => {
    // displayXl, headline, bodyS have no parent overrides.
    expect(theme.type('displayXl').size).toBe(48);
    expect(theme.type('headline').size).toBe(22);
    expect(theme.type('bodyS').size).toBe(13);
  });
});

describe('buildTheme — reduceMotion = true', () => {
  const theme = buildTheme('caregiver', true);

  it('collapses normal duration to a hard cut (0ms)', () => {
    expect(theme.duration('normal')).toBe(0);
  });

  it('collapses slow and deliberate to fast (120ms)', () => {
    expect(theme.duration('slow')).toBe(120);
    expect(theme.duration('deliberate')).toBe(120);
  });

  it('keeps fast unchanged at 120ms', () => {
    expect(theme.duration('fast')).toBe(120);
  });

  it('keeps instant at 0ms', () => {
    expect(theme.duration('instant')).toBe(0);
  });
});

describe('buildTheme — token surface', () => {
  const theme = buildTheme('caregiver', false);

  it('exposes spacing, radii, opacity, elevation, fontFamily', () => {
    expect(theme.spacing.l).toBe(16);
    expect(theme.radii.m).toBe(12);
    expect(theme.opacity.disabled).toBe(0.4);
    expect(theme.elevation.none.android.elevation).toBe(0);
    expect(theme.fontFamily.body).toBe('Inter');
  });

  it('exposes the easing curve dictionary', () => {
    expect(theme.easing.standard).toContain('cubic-bezier');
  });
});
