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
  withTiming: (toValue: number, config?: { duration?: number }) => ({
    __anim: 'timing',
    toValue,
    duration: config?.duration,
  }),
  withSequence: (...args: unknown[]) => ({ __anim: 'sequence', args }),
  withRepeat: (anim: unknown, count: number) => ({ __anim: 'repeat', anim, count }),
  withDelay: (delay: number, anim: unknown) => ({ __anim: 'delay', delay, anim }),
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
  dailyPulseRevealOpacity,
  dailyPulseRevealFill,
  dailyPulseRevealNarrationOpacity,
  livePulseScale,
  livePulseOpacity,
  livePulseCycleMs,
  tileExpandScale,
  tileExpandUnderlayOpacity,
  LIVE_PULSE_SCALE_PEAK,
  LIVE_PULSE_SCALE_REST,
  LIVE_PULSE_OPACITY_TROUGH,
  LIVE_PULSE_OPACITY_REST,
  DAILY_PULSE_REVEAL_STAGGER_MS,
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

describe('daily-pulse-reveal pattern (D12 §7.3, §11.2.3)', () => {
  describe('reduced motion', () => {
    it('opacity hard-cuts to 1', () => {
      expect(dailyPulseRevealOpacity(true, 0)).toBe(1);
      expect(dailyPulseRevealOpacity(true, 4)).toBe(1);
    });

    it('fill hard-cuts to target', () => {
      expect(dailyPulseRevealFill(true, 0, 0.62)).toBe(0.62);
      expect(dailyPulseRevealFill(true, 4, 0.0)).toBe(0.0);
    });

    it('narration opacity hard-cuts to 1', () => {
      expect(dailyPulseRevealNarrationOpacity(true)).toBe(1);
    });
  });

  describe('motion on', () => {
    it('opacity stagger: ring index 0 has 0ms delay', () => {
      expect(dailyPulseRevealOpacity(false, 0)).toMatchObject({ __anim: 'delay', delay: 0 });
    });

    it('opacity stagger: ring index N has N * 80ms delay', () => {
      expect(dailyPulseRevealOpacity(false, 1)).toMatchObject({
        __anim: 'delay',
        delay: DAILY_PULSE_REVEAL_STAGGER_MS,
      });
      expect(dailyPulseRevealOpacity(false, 4)).toMatchObject({
        __anim: 'delay',
        delay: 4 * DAILY_PULSE_REVEAL_STAGGER_MS,
      });
    });

    it('fill begins after ring opacity completes (delay + 200ms)', () => {
      expect(dailyPulseRevealFill(false, 0, 0.5)).toMatchObject({
        __anim: 'delay',
        delay: 200,
      });
      expect(dailyPulseRevealFill(false, 2, 0.5)).toMatchObject({
        __anim: 'delay',
        delay: 2 * DAILY_PULSE_REVEAL_STAGGER_MS + 200,
      });
    });

    it('fill animation runs for cinematic duration (720ms)', () => {
      const result = dailyPulseRevealFill(false, 0, 0.62) as unknown as {
        anim: { duration: number; toValue: number };
      };
      expect(result.anim.duration).toBe(720);
      expect(result.anim.toValue).toBe(0.62);
    });

    it('narration fades in 200ms after the last ring starts filling', () => {
      // Last ring fill starts at 4 * 80 + 200 = 520ms; narration delay = 720ms.
      const lastRingFillStart = 4 * DAILY_PULSE_REVEAL_STAGGER_MS + 200;
      expect(dailyPulseRevealNarrationOpacity(false)).toMatchObject({
        __anim: 'delay',
        delay: lastRingFillStart + 200,
      });
    });
  });
});

describe('live-pulse pattern (D12 §7.5)', () => {
  describe('cycle clamping', () => {
    it('default 50bpm = 1200ms cycle', () => {
      expect(livePulseCycleMs(50)).toBe(1200);
    });

    it('120bpm = 500ms cycle (max bpm)', () => {
      expect(livePulseCycleMs(120)).toBe(500);
    });

    it('clamps below 50 to 50', () => {
      expect(livePulseCycleMs(40)).toBe(1200);
      expect(livePulseCycleMs(0)).toBe(1200);
    });

    it('clamps above 120 to 120', () => {
      expect(livePulseCycleMs(140)).toBe(500);
      expect(livePulseCycleMs(200)).toBe(500);
    });
  });

  describe('reduced motion (D12 §7.4 — DISABLED)', () => {
    it('scale rests at 1.0', () => {
      expect(livePulseScale(true)).toBe(LIVE_PULSE_SCALE_REST);
      expect(livePulseScale(true, 80)).toBe(LIVE_PULSE_SCALE_REST);
    });

    it('opacity rests at 1.0', () => {
      expect(livePulseOpacity(true)).toBe(LIVE_PULSE_OPACITY_REST);
      expect(livePulseOpacity(true, 80)).toBe(LIVE_PULSE_OPACITY_REST);
    });
  });

  describe('motion on', () => {
    it('scale returns infinite repeat of a four-segment sequence', () => {
      const result = livePulseScale(false) as unknown as {
        __anim: string;
        anim: { args: unknown[] };
        count: number;
      };
      expect(result.__anim).toBe('repeat');
      expect(result.count).toBe(-1);
      expect(result.anim).toMatchObject({ __anim: 'sequence' });
      expect(result.anim.args).toHaveLength(4);
    });

    it('scale segments: peak / peak-hold / rest / rest-hold', () => {
      const result = livePulseScale(false) as unknown as {
        anim: { args: Array<{ toValue: number }> };
      };
      const [grow, peakHold, shrink, troughHold] = result.anim.args;
      expect(grow.toValue).toBe(LIVE_PULSE_SCALE_PEAK);
      expect(peakHold.toValue).toBe(LIVE_PULSE_SCALE_PEAK);
      expect(shrink.toValue).toBe(LIVE_PULSE_SCALE_REST);
      expect(troughHold.toValue).toBe(LIVE_PULSE_SCALE_REST);
    });

    it('opacity segments: trough / trough-hold / rest / rest-hold', () => {
      const result = livePulseOpacity(false) as unknown as {
        anim: { args: Array<{ toValue: number }> };
      };
      const [dip, troughHold, rise, restHold] = result.anim.args;
      expect(dip.toValue).toBe(LIVE_PULSE_OPACITY_TROUGH);
      expect(troughHold.toValue).toBe(LIVE_PULSE_OPACITY_TROUGH);
      expect(rise.toValue).toBe(LIVE_PULSE_OPACITY_REST);
      expect(restHold.toValue).toBe(LIVE_PULSE_OPACITY_REST);
    });
  });
});

describe('tile-expand pattern (D12 §11.2.2)', () => {
  it('scale hard-cuts to target under reduced motion', () => {
    expect(tileExpandScale(true, 4.2)).toBe(4.2);
  });

  it('underlay opacity hard-cuts to 0 under reduced motion', () => {
    expect(tileExpandUnderlayOpacity(true)).toBe(0);
  });

  it('produces a spring node when motion is on', () => {
    expect(tileExpandScale(false, 4.2)).toMatchObject({ __anim: 'spring', toValue: 4.2 });
  });
});
