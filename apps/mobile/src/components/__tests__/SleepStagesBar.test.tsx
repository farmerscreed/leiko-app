// SleepStagesBar — Sprint 18 tz + wakeSource regression tests.

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { SleepStagesBar } from '../SleepStagesBar';
import { useAuth } from '../../state/auth';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

beforeEach(() => {
  useAuth.setState({ profile: null });
});

describe('SleepStagesBar — tz-aware clock', () => {
  // 2026-05-22T05:30:00Z = 06:30 Lagos = 01:30 NYC (UTC-4 DST).
  // Asserting different output for different tz proves we honored
  // the user's chosen tz rather than the device-OS default.
  const wakeSec = Math.floor(new Date('2026-05-22T05:30:00Z').getTime() / 1000);
  const bedSec = wakeSec - 7 * 3600;

  it('formats the wake-time in the explicit tz prop', () => {
    render(
      withTheme(
        <SleepStagesBar
          totalMinutes={420}
          deepMinutes={90}
          lightMinutes={200}
          sessionStartSec={bedSec}
          sessionEndSec={wakeSec}
          tz="Africa/Lagos"
          testID="bar"
        />,
      ),
    );
    expect(screen.getByText(/6:30/)).toBeTruthy();
  });

  it('formats the wake-time differently in a different tz', () => {
    render(
      withTheme(
        <SleepStagesBar
          totalMinutes={420}
          deepMinutes={90}
          lightMinutes={200}
          sessionStartSec={bedSec}
          sessionEndSec={wakeSec}
          tz="America/New_York"
          testID="bar"
        />,
      ),
    );
    expect(screen.getByText(/1:30/)).toBeTruthy();
  });

  it('falls back to the profile tz when no tz prop is supplied', () => {
    useAuth.setState({ profile: { timezone: 'Africa/Lagos' } as never });
    render(
      withTheme(
        <SleepStagesBar
          totalMinutes={420}
          deepMinutes={90}
          lightMinutes={200}
          sessionStartSec={bedSec}
          sessionEndSec={wakeSec}
          testID="bar"
        />,
      ),
    );
    expect(screen.getByText(/6:30/)).toBeTruthy();
  });
});

describe('SleepStagesBar — wakeSource approx marker', () => {
  const wakeSec = Math.floor(new Date('2026-05-22T05:30:00Z').getTime() / 1000);
  const bedSec = wakeSec - 7 * 3600;

  it('renders an "approx." caption when wakeSource is fallback', () => {
    render(
      withTheme(
        <SleepStagesBar
          totalMinutes={420}
          deepMinutes={90}
          lightMinutes={200}
          sessionStartSec={bedSec}
          sessionEndSec={wakeSec}
          tz="UTC"
          wakeSource="fallback"
          testID="bar"
        />,
      ),
    );
    expect(screen.getByText(/approx\./i)).toBeTruthy();
  });

  it('does NOT render the approx caption when wakeSource is hr_inferred', () => {
    render(
      withTheme(
        <SleepStagesBar
          totalMinutes={420}
          deepMinutes={90}
          lightMinutes={200}
          sessionStartSec={bedSec}
          sessionEndSec={wakeSec}
          tz="UTC"
          wakeSource="hr_inferred"
          testID="bar"
        />,
      ),
    );
    expect(screen.queryByText(/approx\./i)).toBeNull();
  });

  it('is silent (no caption) when wakeSource is undefined (legacy rows)', () => {
    render(
      withTheme(
        <SleepStagesBar
          totalMinutes={420}
          deepMinutes={90}
          lightMinutes={200}
          sessionStartSec={bedSec}
          sessionEndSec={wakeSec}
          tz="UTC"
          testID="bar"
        />,
      ),
    );
    expect(screen.queryByText(/approx\./i)).toBeNull();
  });
});
