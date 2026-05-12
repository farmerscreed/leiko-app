import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  TrendsWeeklySummaryCard,
  TRENDS_WEEKLY_EYEBROW,
  TRENDS_WEEKLY_BODY,
} from '../TrendsWeeklySummaryCard';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('TrendsWeeklySummaryCard', () => {
  it('renders eyebrow + body copy', () => {
    render(
      withTheme(<TrendsWeeklySummaryCard testID="weekly" />),
    );
    expect(screen.getByTestId('weekly-eyebrow').props.children).toBe(
      TRENDS_WEEKLY_EYEBROW,
    );
    expect(screen.getByTestId('weekly-body').props.children).toBe(
      TRENDS_WEEKLY_BODY,
    );
  });

  it('eyebrow + body pass voice-lint', () => {
    expect(lintVoiceText(TRENDS_WEEKLY_EYEBROW).passes).toBe(true);
    expect(lintVoiceText(TRENDS_WEEKLY_BODY).passes).toBe(true);
  });
});
