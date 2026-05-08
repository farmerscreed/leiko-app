// DaySpine — Sprint 8 component tests.
//
// Pure renderer over a `DayMoment[]`. The deriveDayMoments helper is
// covered by utils/__tests__/dayMoments.test.ts; here we verify the
// renderer's responses to common moment shapes.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { DaySpine } from '../DaySpine';
import type { DayMoment } from '../../utils/dayMoments';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

function makeMoment(over: Partial<DayMoment> = {}): DayMoment {
  return {
    id: over.id ?? 'm-1',
    timeSec: over.timeSec ?? 1778414400,
    timeLabel: over.timeLabel ?? '6:42a',
    title: over.title ?? 'Morning reading',
    sub: over.sub ?? 'BP 122/78 · pulse 64',
    vital: over.vital ?? 'bp',
    past: over.past ?? false,
    concerned: over.concerned,
  };
}

describe('DaySpine — empty state', () => {
  it('renders the calm empty placeholder when no moments are present', () => {
    render(withTheme(<DaySpine moments={[]} testID="spine" />));
    expect(screen.getByTestId('spine-empty')).toBeTruthy();
    expect(
      screen.getByText('Your day will fill in as readings come in.'),
    ).toBeTruthy();
  });

  it('matches snapshot in the empty state', () => {
    const { toJSON } = render(
      withTheme(<DaySpine moments={[]} testID="spine" />),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

describe('DaySpine — populated', () => {
  const moments: DayMoment[] = [
    makeMoment({
      id: 'sleep-1',
      timeLabel: 'Last night',
      title: 'A quieter night',
      sub: '7h 42m · 1 awakening',
      vital: 'sleep',
      past: true,
    }),
    makeMoment({
      id: 'bp-1',
      title: 'Morning reading',
      sub: 'BP 122/78 · pulse 64',
      vital: 'bp',
    }),
  ];

  it('renders one row per moment with its title + sub', () => {
    render(withTheme(<DaySpine moments={moments} testID="spine" />));
    expect(screen.getByText('A quieter night')).toBeTruthy();
    expect(screen.getByText('Morning reading')).toBeTruthy();
    expect(screen.getByText('7h 42m · 1 awakening')).toBeTruthy();
    expect(screen.getByText('BP 122/78 · pulse 64')).toBeTruthy();
  });

  it('fires onSelect with the tapped moment', () => {
    const onSelect = jest.fn();
    render(
      withTheme(
        <DaySpine moments={moments} onSelect={onSelect} testID="spine" />,
      ),
    );
    fireEvent.press(screen.getByTestId('spine-moment-bp-1'));
    expect(onSelect).toHaveBeenCalledWith(moments[1]);
  });

  it('matches snapshot in dark mode', () => {
    const { toJSON } = render(
      withTheme(<DaySpine moments={moments} testID="spine" />),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
