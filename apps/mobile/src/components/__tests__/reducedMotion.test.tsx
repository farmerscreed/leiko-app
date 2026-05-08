// Reduced-motion deterministic verification — D12 §7.4.
//
// Mocks the project's useReducedMotion() hook to always return `true`
// and renders every motion-using primitive. Asserts end-state-only
// snapshots and confirms the Reanimated drivers (withTiming, withSpring,
// withRepeat, withDelay) are NOT invoked under reduced motion.
//
// Sprint 7.6 acceptance criterion: "Reduced motion verified" — covered
// by this file plus the unit tests in src/theme/motion/__tests__/patterns.test.ts
// which exercise the same fast-path return values directly.

import { type ReactNode } from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

// Mock useReducedMotion BEFORE importing any component.
jest.mock('../../theme/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

// Spy on the Reanimated mock's animation drivers — none of these should
// fire under reduced motion. We replace the global jest.setup.rn.js mock
// for THIS file only with a richer mock that records calls.
const driverCalls: Array<{ name: string; args: unknown[] }> = [];
jest.mock('react-native-reanimated', () => {
  const { View, Text } = jest.requireActual('react-native');
  const createAnimatedComponent = (Component: unknown) => Component;
  function record(name: string) {
    return (...args: unknown[]) => {
      driverCalls.push({ name, args });
      // Return the plain target value so the call site doesn't crash if
      // (against expectation) it does invoke the driver. The test asserts
      // driverCalls.length === 0 anyway.
      const last = args[0];
      return last;
    };
  }
  return {
    __esModule: true,
    default: { View, ScrollView: View, Text, createAnimatedComponent },
    createAnimatedComponent,
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: (fn: () => unknown) => fn(),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    withTiming: record('withTiming'),
    withSpring: record('withSpring'),
    withRepeat: record('withRepeat'),
    withSequence: record('withSequence'),
    withDelay: record('withDelay'),
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    Easing: {
      bezier: () => ({}),
      linear: ({}),
      ease: ({}),
    },
  };
});

// Imports MUST come after the mocks above.
import { ThemeProvider } from '../../theme';
import { AmbientPulse } from '../AmbientPulse';
import { AnomalyBanner } from '../AnomalyBanner';
import { CorrelationStrip } from '../CorrelationStrip';
import { DailyPulseHero, type DailyPulseHeroVitals } from '../DailyPulseHero';
import { PersonCard } from '../PersonCard';
import { PersonOrb } from '../PersonOrb';
import { VitalRing } from '../VitalRing';
import { VitalTile } from '../VitalTile';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

const SAMPLE_VITALS: DailyPulseHeroVitals = {
  bp: { fill: 0.75, state: 'filling', display: '128/82', unit: 'mmHg' },
  hr: { fill: 0.4, state: 'filling', display: '64', unit: 'bpm' },
  spo2: { fill: 0.85, state: 'filling', display: '98', unit: '%' },
  sleep: { fill: 0.6, state: 'filling', display: '7:42', unit: 'hrs' },
  activity: { fill: 0.5, state: 'filling', display: '4,166', unit: 'steps' },
};

const T0 = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SAMPLE_POINTS = Array.from({ length: 7 }, (_, i) => ({
  t: T0 + i * DAY_MS,
  value: 60 + i * 3,
}));

beforeEach(() => {
  driverCalls.length = 0;
});

describe('Reduced motion (D12 §7.4) — no driver fires', () => {
  it('VitalRing state="filling" does not invoke withTiming or withDelay', () => {
    render(
      withTheme(<VitalRing vitalType="bp" fill={0.62} state="filling" />),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('VitalRing state="pulsing" does not invoke withRepeat or withSequence', () => {
    render(
      withTheme(<VitalRing vitalType="hr" fill={0.5} state="pulsing" />),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('AmbientPulse active=true does not invoke withRepeat', () => {
    render(
      withTheme(
        <AmbientPulse active>
          <Text>Live</Text>
        </AmbientPulse>,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('VitalTile state="live" does not invoke any driver', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="hr"
          value="62 bpm"
          secondary="resting"
          state="live"
          ringFill={0.4}
          onPress={() => undefined}
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('DailyPulseHero does not invoke withTiming or withDelay (reveal staggered)', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          central={{
            label: 'Blood pressure',
            value: '128/82',
            sub: 'mmHg · 6:42 am',
          }}
          aiNarration="Mum is in pattern."
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('CorrelationStrip does not invoke withTiming for the line reveal', () => {
    render(
      withTheme(
        <CorrelationStrip
          vitalA={{ type: 'sleep', points: SAMPLE_POINTS }}
          vitalB={{ type: 'bp', points: SAMPLE_POINTS }}
          range="7d"
          caption="Sleep × Morning BP"
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('AnomalyBanner calm-concerned does not invoke withSpring (sheet-rise)', () => {
    render(
      withTheme(
        <AnomalyBanner
          severity="calm-concerned"
          title="Worth a chat with Mum"
          body="We've noticed a pattern worth a gentle check-in."
          onDismiss={() => undefined}
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('AnomalyBanner confirmed-urgent does not invoke withTiming (decelerate sheet-rise)', () => {
    render(
      withTheme(
        <AnomalyBanner
          severity="confirmed-urgent"
          title="Talk to Mum now"
          body="Their latest reading was above their usual range."
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('PersonOrb does not invoke withRepeat or withDelay (orb-in + halo pulse)', () => {
    render(
      withTheme(
        <PersonOrb
          initial="M"
          accent="#FF7350"
          status="attention"
          fullName="Marian Okeke"
          bpLabel="138/89"
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });

  it('PersonCard does not invoke withSpring (button-press scale)', () => {
    render(
      withTheme(
        <PersonCard
          accent="#FF7350"
          initial="M"
          fullName="Marian Okeke"
          relation="Mom"
          age={71}
          status="clear"
          headline="A calm morning."
          sentence="BP 122/78 a moment ago. Inside the usual band."
          vitalStrip={{ bp: '122/78', hr: '64', spo2: '98%', sleep: '7:42' }}
          footerLeftLabel="Read · 6:42 am"
        />,
      ),
    );
    expect(driverCalls).toHaveLength(0);
  });
});

describe('Reduced motion — end-state snapshots', () => {
  it('VitalRing state="filling" renders at the target arc length', () => {
    const { toJSON } = render(
      withTheme(<VitalRing vitalType="bp" fill={0.62} state="filling" testID="ring" />),
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('DailyPulseHero constellation renders all rings at their target fills', () => {
    const { toJSON } = render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          central={{
            label: 'Blood pressure',
            value: '128/82',
            sub: 'mmHg · 6:42 am',
          }}
          aiNarration="Mum is in pattern."
          testID="hero"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('AnomalyBanner confirmed-urgent renders at translateY 0 (no slide-in)', () => {
    const { toJSON } = render(
      withTheme(
        <AnomalyBanner
          severity="confirmed-urgent"
          title="Talk to Mum now"
          body="Their latest reading was above their usual range."
          testID="banner"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
