// Verifies token values match docs/02-design-tokens.md exactly. If the spec
// changes a hex value, ms duration, or font family, this test fails — which
// is the signal to update tokens.ts.

import {
  colors,
  elevation,
  motion,
  opacity,
  palette,
  radii,
  reducedMotionDuration,
  spacing,
  typeScale,
} from '../tokens';

describe('palette (D5 §4.1)', () => {
  it('matches D5 §4.1 hex values exactly', () => {
    expect(palette.navy[900]).toBe('#0F2340');
    expect(palette.navy[700]).toBe('#2A5F7F');
    expect(palette.amber[500]).toBe('#E89F4F');
    expect(palette.crimson[700]).toBe('#8C2D2D');
    expect(palette.cream[100]).toBe('#F5EFE6');
    expect(palette.cream[200]).toBe('#E8E2D5');
    expect(palette.cream[300]).toBe('#D6CFC2');
    expect(palette.white).toBe('#FFFFFF');
    expect(palette.text.primary).toBe('#1B2540');
    expect(palette.text.secondary).toBe('#5A6478');
    expect(palette.success[500]).toBe('#2F7A3F');
  });
});

describe('semantic colors (D8 §2.1.2)', () => {
  it('maps brand to navy palette', () => {
    expect(colors.brand.primary).toBe('#0F2340');
    expect(colors.brand.primarySoft).toBe('#2A5F7F');
    expect(colors.brand.accent).toBe('#E89F4F');
  });

  it('reserves urgent for confirmed-clinical only (crimson)', () => {
    expect(colors.state.urgent).toBe('#8C2D2D');
  });

  it('uses cream for surface base, taupe for subtle, white for elevated', () => {
    expect(colors.surface.base).toBe('#F5EFE6');
    expect(colors.surface.subtle).toBe('#E8E2D5');
    expect(colors.surface.elevated).toBe('#FFFFFF');
  });
});

describe('spacing — 4pt scale (D8 §2.3)', () => {
  it('starts at 4 and reaches 48', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.s).toBe(8);
    expect(spacing.m).toBe(12);
    expect(spacing.l).toBe(16);
    expect(spacing.xl).toBe(20);
    expect(spacing.xxl).toBe(24);
    expect(spacing.xxxl).toBe(32);
    expect(spacing.xxxxl).toBe(48);
  });
});

describe('radii (D8 §2.4)', () => {
  it('uses 12 as the default', () => {
    expect(radii.m).toBe(12);
  });
  it('uses 999 for fully rounded pills', () => {
    expect(radii.full).toBe(999);
  });
});

describe('opacity (D8 §2.7)', () => {
  it('disabled is 0.40', () => {
    expect(opacity.disabled).toBe(0.4);
  });
  it('scrim is 0.55', () => {
    expect(opacity.scrim).toBe(0.55);
  });
});

describe('motion durations (D8 §2.6.1)', () => {
  it('matches the spec ms values exactly', () => {
    expect(motion.duration.instant).toBe(0);
    expect(motion.duration.fast).toBe(120);
    expect(motion.duration.normal).toBe(200);
    expect(motion.duration.slow).toBe(320);
    expect(motion.duration.deliberate).toBe(480);
  });
});

describe('reduced-motion mapping (D8 §2.6.3)', () => {
  it('collapses normal to instant (hard cut)', () => {
    expect(reducedMotionDuration.normal).toBe(0);
  });
  it('collapses slow and deliberate to fast', () => {
    expect(reducedMotionDuration.slow).toBe(120);
    expect(reducedMotionDuration.deliberate).toBe(120);
  });
  it('keeps fast unchanged at 120', () => {
    expect(reducedMotionDuration.fast).toBe(120);
  });
});

describe('elevation (D8 §2.5)', () => {
  it('tints shadows navy, not pure black', () => {
    expect(elevation.medium.ios.shadowColor).toBe('#0F2340');
    expect(elevation.high.ios.shadowColor).toBe('#0F2340');
  });
  it('cards on cream cast no shadow by default', () => {
    expect(elevation.none.android.elevation).toBe(0);
    expect(elevation.none.ios.shadowOpacity).toBe(0);
  });
});

describe('typography (D8 §2.2 + §2.3)', () => {
  it('caregiver body-l is 17/24', () => {
    expect(typeScale.caregiver.bodyL.size).toBe(17);
    expect(typeScale.caregiver.bodyL.lineHeight).toBe(24);
  });
  it('parent body-l steps up to 19', () => {
    expect(typeScale.parent.bodyL.size).toBe(19);
  });
  it('parent label steps up to 15', () => {
    expect(typeScale.parent.label.size).toBe(15);
  });
  it('display-xl uses Recoleta and is 48pt bold', () => {
    expect(typeScale.caregiver.displayXl.family).toBe('Recoleta');
    expect(typeScale.caregiver.displayXl.size).toBe(48);
    expect(typeScale.caregiver.displayXl.weight).toBe('700');
  });
  it('numeric tokens use JetBrains Mono', () => {
    expect(typeScale.caregiver.numericXl.family).toBe('JetBrainsMono');
    expect(typeScale.caregiver.numericL.family).toBe('JetBrainsMono');
    expect(typeScale.caregiver.numericM.family).toBe('JetBrainsMono');
  });
});
