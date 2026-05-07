import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { VitalTile, type VitalTileState } from '../VitalTile';
import type { VitalType } from '../VitalRing';

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

describe('VitalTile — state × colorMode snapshot matrix', () => {
  const states: VitalTileState[] = ['normal', 'live', 'stale', 'no-data'];
  const modes: Array<'dark' | 'light'> = ['dark', 'light'];

  for (const mode of modes) {
    for (const state of states) {
      it(`renders state=${state} mode=${mode}`, () => {
        const { toJSON } = render(
          withTheme(
            <VitalTile
              vitalType="hr"
              value="62 bpm"
              secondary={state === 'no-data' ? undefined : 'resting'}
              state={state}
              ringFill={0.5}
              testID="tile"
            />,
            mode,
          ),
        );
        expect(toJSON()).toMatchSnapshot();
      });
    }
  }
});

describe('VitalTile — vital type render smoke', () => {
  const cases: Array<{ vitalType: VitalType; value: string; secondary: string }> = [
    { vitalType: 'bp', value: '128/82', secondary: 'morning' },
    { vitalType: 'hr', value: '62 bpm', secondary: 'resting' },
    { vitalType: 'spo2', value: '97%', secondary: 'last reading' },
    { vitalType: 'sleep', value: '7h 24m', secondary: 'last night' },
    { vitalType: 'activity', value: '8,432', secondary: 'today' },
  ];

  for (const c of cases) {
    it(`renders vitalType=${c.vitalType}`, () => {
      render(
        withTheme(
          <VitalTile
            vitalType={c.vitalType}
            value={c.value}
            secondary={c.secondary}
            ringFill={0.6}
            testID="tile"
          />,
        ),
      );
      expect(screen.getByTestId('tile')).toBeTruthy();
      expect(screen.getByText(c.value)).toBeTruthy();
      expect(screen.getByText(c.secondary)).toBeTruthy();
    });
  }
});

describe('VitalTile — interaction', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <VitalTile
          vitalType="bp"
          value="128/82"
          ringFill={0.5}
          onPress={onPress}
          testID="tile"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('tile'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires onLongPress when long-pressed', () => {
    const onLongPress = jest.fn();
    render(
      withTheme(
        <VitalTile
          vitalType="bp"
          value="128/82"
          ringFill={0.5}
          onPress={() => undefined}
          onLongPress={onLongPress}
          testID="tile"
        />,
      ),
    );
    fireEvent(screen.getByTestId('tile'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});

describe('VitalTile — accessibility', () => {
  it('sets accessibilityRole="button"', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="hr"
          value="62 bpm"
          ringFill={0.5}
          onPress={() => undefined}
          testID="tile"
        />,
      ),
    );
    const node = screen.getByTestId('tile');
    expect(node.props.accessibilityRole).toBe('button');
  });

  it('composes accessibilityLabel from vital name + value + secondary when not provided', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="hr"
          value="62 bpm"
          secondary="resting"
          ringFill={0.5}
          onPress={() => undefined}
          testID="tile"
        />,
      ),
    );
    const node = screen.getByTestId('tile');
    expect(node.props.accessibilityLabel).toBe('Heart rate tile, 62 bpm, resting');
  });

  it('composes accessibilityLabel without secondary when secondary is undefined', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="bp"
          value="128/82"
          ringFill={0.5}
          onPress={() => undefined}
          testID="tile"
        />,
      ),
    );
    const node = screen.getByTestId('tile');
    expect(node.props.accessibilityLabel).toBe('Blood pressure tile, 128/82');
  });

  it('passes through a consumer-provided accessibilityLabel', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="hr"
          value="62 bpm"
          secondary="resting"
          ringFill={0.5}
          onPress={() => undefined}
          accessibilityLabel="Mum's heart rate, last reading 62 bpm"
          testID="tile"
        />,
      ),
    );
    const node = screen.getByTestId('tile');
    expect(node.props.accessibilityLabel).toBe(
      "Mum's heart rate, last reading 62 bpm",
    );
  });

  it('marks the tile disabled when no onPress is provided', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="hr"
          value="62 bpm"
          ringFill={0.5}
          testID="tile"
        />,
      ),
    );
    const node = screen.getByTestId('tile');
    expect(node.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('marks the tile enabled when onPress is provided', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="hr"
          value="62 bpm"
          ringFill={0.5}
          onPress={() => undefined}
          testID="tile"
        />,
      ),
    );
    const node = screen.getByTestId('tile');
    expect(node.props.accessibilityState).toMatchObject({ disabled: false });
  });
});

describe('VitalTile — no-data fallback', () => {
  it('falls back to "No reading yet today" when secondary is omitted in no-data state', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="bp"
          value="—"
          state="no-data"
          testID="tile"
        />,
      ),
    );
    expect(screen.getByText('No reading yet today')).toBeTruthy();
  });

  it('respects a consumer-supplied secondary in no-data state', () => {
    render(
      withTheme(
        <VitalTile
          vitalType="bp"
          value="—"
          secondary="Take your first reading"
          state="no-data"
          testID="tile"
        />,
      ),
    );
    expect(screen.getByText('Take your first reading')).toBeTruthy();
  });
});
