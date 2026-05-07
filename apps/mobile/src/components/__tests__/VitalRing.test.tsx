import { type ReactNode } from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import {
  VitalRing,
  arcCircumference,
  arcDashOffset,
  type VitalRingSize,
  type VitalRingState,
  type VitalType,
} from '../VitalRing';

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

describe('VitalRing — pure arc math', () => {
  it('arcCircumference = 2πr', () => {
    expect(arcCircumference(10)).toBeCloseTo(2 * Math.PI * 10, 6);
  });

  it('arcDashOffset is full circumference at 0% fill', () => {
    expect(arcDashOffset(100, 0)).toBe(100);
  });

  it('arcDashOffset is zero at 100% fill', () => {
    expect(arcDashOffset(100, 1)).toBe(0);
  });

  it('arcDashOffset is half circumference at 50% fill', () => {
    expect(arcDashOffset(100, 0.5)).toBe(50);
  });

  it('arcDashOffset clamps fill below 0', () => {
    expect(arcDashOffset(100, -0.5)).toBe(100);
  });

  it('arcDashOffset clamps fill above 1', () => {
    expect(arcDashOffset(100, 1.7)).toBe(0);
  });
});

describe('VitalRing — accessibility', () => {
  it('exposes progressbar role with the clamped fill', () => {
    render(
      withTheme(
        <VitalRing
          vitalType="bp"
          fill={0.62}
          accessibilityLabel="Morning blood pressure, in pattern"
          testID="ring"
        />,
      ),
    );
    const node = screen.getByTestId('ring');
    expect(node.props.accessibilityRole).toBe('progressbar');
    expect(node.props.accessibilityLabel).toBe('Morning blood pressure, in pattern');
    expect(node.props.accessibilityValue).toEqual({ min: 0, max: 1, now: 0.62 });
  });

  it('clamps a fill above 1 in the announced value', () => {
    render(
      withTheme(<VitalRing vitalType="hr" fill={1.4} testID="ring" />),
    );
    expect(screen.getByTestId('ring').props.accessibilityValue.now).toBe(1);
  });
});

describe('VitalRing — state × mode snapshot matrix', () => {
  const states: VitalRingState[] = ['idle', 'filling', 'pulsing', 'stale'];
  const modes: Array<'dark' | 'light'> = ['dark', 'light'];

  for (const mode of modes) {
    for (const state of states) {
      it(`renders state=${state} mode=${mode}`, () => {
        const { toJSON } = render(
          withTheme(
            <VitalRing vitalType="bp" fill={0.62} state={state} testID="ring" />,
            mode,
          ),
        );
        expect(toJSON()).toMatchSnapshot();
      });
    }
  }
});

describe('VitalRing — size variation', () => {
  const sizes: VitalRingSize[] = ['sm', 'md', 'lg', 'hero'];

  for (const size of sizes) {
    it(`renders size=${size}`, () => {
      const { toJSON } = render(
        withTheme(
          <VitalRing vitalType="hr" fill={0.5} size={size} testID="ring" />,
        ),
      );
      expect(toJSON()).toMatchSnapshot();
    });
  }
});

describe('VitalRing — vital type colors', () => {
  const vitals: VitalType[] = ['bp', 'hr', 'spo2', 'sleep', 'activity'];

  for (const vitalType of vitals) {
    it(`renders vitalType=${vitalType} without crashing`, () => {
      render(
        withTheme(<VitalRing vitalType={vitalType} fill={0.4} testID="ring" />),
      );
      expect(screen.getByTestId('ring')).toBeTruthy();
    });
  }
});

describe('VitalRing — composed inner content', () => {
  it('renders children at the center', () => {
    render(
      withTheme(
        <VitalRing vitalType="bp" fill={0.62} testID="ring">
          <Text>128/82</Text>
        </VitalRing>,
      ),
    );
    expect(screen.getByText('128/82')).toBeTruthy();
  });
});
