import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  TrendsWeeklySummaryCard,
  TRENDS_WEEKLY_EYEBROW_FALLBACK,
  TRENDS_WEEKLY_BODY_FALLBACK,
} from '../TrendsWeeklySummaryCard';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';
import type { TrendsData } from '../../utils/trends-aggregate';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

function trendsWithBP(): TrendsData {
  const series = Array.from({ length: 5 }, (_, i) => ({
    day: `2026-05-0${i + 1}`,
    sys: 122 + i,
    dia: 78 + i,
    pulse: null,
    count: 1,
  }));
  return {
    series: { bp: series, hr: [], spo2: [], sleep: [], activity: [] },
    summary: {
      bp: { count: 5, avgSys: 124, avgDia: 80, pctInRange: 1 },
      hr: { count: 0, avgResting: null },
      spo2: { count: 0, avgMinPercent: null },
      sleep: { count: 0, avgTotalMinutes: null },
      activity: { count: 0, avgSteps: null },
    },
  };
}

describe('TrendsWeeklySummaryCard', () => {
  it('renders fallback eyebrow + body when there is no data', () => {
    render(withTheme(<TrendsWeeklySummaryCard testID="weekly" />));
    expect(screen.getByTestId('weekly-eyebrow').props.children).toBe(
      TRENDS_WEEKLY_EYEBROW_FALLBACK,
    );
    expect(screen.getByTestId('weekly-body').props.children).toBe(
      TRENDS_WEEKLY_BODY_FALLBACK,
    );
  });

  it('renders the real Tier-C body when data is present', () => {
    render(
      withTheme(
        <TrendsWeeklySummaryCard
          data={trendsWithBP()}
          accountType="self_buyer"
          testID="weekly"
        />,
      ),
    );
    const eyebrow = screen.getByTestId('weekly-eyebrow').props.children;
    expect(eyebrow).not.toBe(TRENDS_WEEKLY_EYEBROW_FALLBACK);
    expect(eyebrow).toContain('week');
    const body = screen.getByTestId('weekly-body').props.children;
    expect(body).toContain('124/80');
  });

  it('fallback copy passes voice-lint', () => {
    expect(lintVoiceText(TRENDS_WEEKLY_EYEBROW_FALLBACK).passes).toBe(true);
    expect(lintVoiceText(TRENDS_WEEKLY_BODY_FALLBACK).passes).toBe(true);
  });
});
