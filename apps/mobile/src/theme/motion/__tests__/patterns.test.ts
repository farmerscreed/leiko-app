// Reduce-motion behaviour tests for the motion patterns. Animation timing /
// easing are not unit-testable (they live on the UI thread); these tests
// only verify the reduce-motion fast-path returns plain values rather than
// animation nodes.
//
// Mocks reanimated to JS-noop equivalents — the rn jest setup provides the
// global shim, but this file lives under the pure project per the test-path
// glob in jest.config.js, so we mock locally.

jest.mock('react-native-reanimated', () => ({
  withSpring: (toValue: number) => ({ __anim: 'spring', toValue }),
  withTiming: (toValue: number) => ({ __anim: 'timing', toValue }),
  withSequence: (...args: unknown[]) => ({ __anim: 'sequence', args }),
  withRepeat: (anim: unknown) => ({ __anim: 'repeat', anim }),
  Easing: {
    linear: 'linear',
    bezier: () => 'bezier',
  },
}));

import {
  buttonPressInScale,
  buttonPressOutScale,
  sheetRiseInTranslate,
  sheetRiseOutTranslate,
  sheetRiseInBackdropOpacity,
  sheetRiseOutBackdropOpacity,
  skeletonShimmer,
} from '../patterns';

describe('button-press pattern', () => {
  it('hard-cuts to 0.97 under reduced motion', () => {
    expect(buttonPressInScale(true)).toBe(0.97);
  });

  it('returns a spring animation node when motion is on', () => {
    expect(buttonPressInScale(false)).toMatchObject({ __anim: 'spring', toValue: 0.97 });
  });

  it('release hard-cuts back to 1.0 under reduced motion', () => {
    expect(buttonPressOutScale(true)).toBe(1.0);
  });
});

describe('sheet-rise pattern', () => {
  it('translate-in hard-cuts to resting Y under reduced motion', () => {
    expect(sheetRiseInTranslate(true, 200)).toBe(200);
  });

  it('translate-out hard-cuts to full-height under reduced motion', () => {
    expect(sheetRiseOutTranslate(true, 800)).toBe(800);
  });

  it('backdrop opacity in hard-cuts to scrim under reduced motion', () => {
    expect(sheetRiseInBackdropOpacity(true, 0.55)).toBe(0.55);
  });

  it('backdrop opacity out hard-cuts to 0 under reduced motion', () => {
    expect(sheetRiseOutBackdropOpacity(true)).toBe(0);
  });

  it('produces an animation node when motion is on', () => {
    expect(sheetRiseInTranslate(false, 200)).toMatchObject({ __anim: 'spring', toValue: 200 });
  });
});

describe('skeleton-shimmer pattern (D12 §7.3 / §7.4)', () => {
  it('returns 0 (static placeholder marker) under reduced motion', () => {
    expect(skeletonShimmer(true)).toBe(0);
  });

  it('returns a repeating animation when motion is on', () => {
    expect(skeletonShimmer(false)).toMatchObject({ __anim: 'repeat' });
  });
});
