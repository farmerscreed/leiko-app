import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import {
  DailyPulseHero,
  type DailyPulseHeroVitals,
} from '../DailyPulseHero';

function withTheme(
  ui: ReactNode,
  colorMode: 'dark' | 'light' = 'dark',
  typeMode: 'caregiver' | 'parent' = 'caregiver',
) {
  return (
    <ThemeProvider mode={typeMode} colorMode={colorMode}>
      {ui}
    </ThemeProvider>
  );
}

const SAMPLE_VITALS: DailyPulseHeroVitals = {
  bp: { fill: 0.75 },
  hr: { fill: 0.4 },
  spo2: { fill: 0.85 },
  sleep: { fill: 0.6 },
  activity: { fill: 0.5 },
};

describe('DailyPulseHero — render', () => {
  it('renders the central value + label', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          parentName="Mum"
          testID="hero"
        />,
      ),
    );
    expect(screen.getByText('128/82')).toBeTruthy();
    expect(screen.getByText('morning BP')).toBeTruthy();
  });

  it('renders the AI narration when provided', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          aiNarration="Mum is in pattern. 124/79 this morning, six below her week."
          testID="hero"
        />,
      ),
    );
    expect(
      screen.getByText('Mum is in pattern. 124/79 this morning, six below her week.'),
    ).toBeTruthy();
  });

  it('omits the narration line when aiNarration is undefined', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="—"
          centralLabel="no readings yet today"
          testID="hero"
        />,
      ),
    );
    expect(screen.queryByText(/in pattern/)).toBeNull();
  });
});

describe('DailyPulseHero — accessibility composition (D12 §11.2.3)', () => {
  it('reads "Daily pulse for {parentName}" when parentName is provided', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          parentName="Mum"
          testID="hero"
        />,
      ),
    );
    const node = screen.getByTestId('hero');
    expect(node.props.accessibilityLabel).toMatch(/^Daily pulse for Mum/);
  });

  it('falls back to "Daily pulse" without a parentName', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          testID="hero"
        />,
      ),
    );
    expect(screen.getByTestId('hero').props.accessibilityLabel).toMatch(
      /^Daily pulse\./,
    );
  });

  it('includes the central value + label and every vital fill as a percent', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          testID="hero"
        />,
      ),
    );
    const label = screen.getByTestId('hero').props.accessibilityLabel;
    expect(label).toContain('morning BP 128/82');
    expect(label).toContain('Blood pressure 75 percent');
    expect(label).toContain('Heart rate 40 percent');
    expect(label).toContain('Oxygen 85 percent');
    expect(label).toContain('Sleep 60 percent');
    expect(label).toContain('Activity 50 percent');
  });

  it('includes the AI narration verbatim when provided', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          aiNarration="Mum is in pattern."
          testID="hero"
        />,
      ),
    );
    expect(screen.getByTestId('hero').props.accessibilityLabel).toContain(
      'Mum is in pattern.',
    );
  });

  it('clamps fills above 1 to 100% in the announced label', () => {
    render(
      withTheme(
        <DailyPulseHero
          vitals={{ ...SAMPLE_VITALS, bp: { fill: 1.4 } }}
          centralValue="128/82"
          centralLabel="morning BP"
          testID="hero"
        />,
      ),
    );
    expect(screen.getByTestId('hero').props.accessibilityLabel).toContain(
      'Blood pressure 100 percent',
    );
  });
});

describe('DailyPulseHero — mode × colorMode snapshot matrix', () => {
  const modes: Array<'immersive' | 'card'> = ['immersive', 'card'];
  const colorModes: Array<'dark' | 'light'> = ['dark', 'light'];

  for (const mode of modes) {
    for (const colorMode of colorModes) {
      it(`renders mode=${mode} colorMode=${colorMode}`, () => {
        const { toJSON } = render(
          withTheme(
            <DailyPulseHero
              vitals={SAMPLE_VITALS}
              centralValue="128/82"
              centralLabel="morning BP"
              aiNarration="Mum is in pattern."
              mode={mode}
              parentName="Mum"
              testID="hero"
            />,
            colorMode,
          ),
        );
        expect(toJSON()).toMatchSnapshot();
      });
    }
  }
});

describe('DailyPulseHero — adaptive central value branches (D13 §7.2)', () => {
  // Each branch is a different (centralValue, centralLabel) combination.
  // The Hero is presentational; the priority logic is unit-tested in
  // utils/__tests__/dailyPulseCentral.test.ts. These snapshots prove the
  // branches render correctly in the visual.

  it('branch 1 — fresh BP: "128/82" / "morning BP"', () => {
    const { toJSON } = render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="128/82"
          centralLabel="morning BP"
          testID="hero"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('branch 2 — HR only: "62" / "resting HR"', () => {
    const { toJSON } = render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="62"
          centralLabel="resting HR"
          testID="hero"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('branch 3 — sleep only: "7h 24m" / "last night"', () => {
    const { toJSON } = render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="7h 24m"
          centralLabel="last night"
          testID="hero"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('branch 4 — nothing: "—" / "no readings yet today"', () => {
    const { toJSON } = render(
      withTheme(
        <DailyPulseHero
          vitals={SAMPLE_VITALS}
          centralValue="—"
          centralLabel="no readings yet today"
          testID="hero"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
