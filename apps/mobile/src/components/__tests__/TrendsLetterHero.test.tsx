import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { TrendsLetterHero } from '../TrendsLetterHero';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('TrendsLetterHero', () => {
  it('renders the paragraph body', () => {
    render(
      withTheme(
        <TrendsLetterHero
          body="You are in pattern this month."
          testID="letter"
        />,
      ),
    );
    expect(screen.getByTestId('letter-paragraph')).toBeTruthy();
  });

  it('renders the optional eyebrow + freshness', () => {
    render(
      withTheme(
        <TrendsLetterHero
          body="You are in pattern this month."
          eyebrow="A letter from Leiko · 30 days"
          freshnessCaption="Based on your last 30 days · just now"
          testID="letter"
        />,
      ),
    );
    expect(screen.getByTestId('letter-eyebrow')).toBeTruthy();
    expect(screen.getByTestId('letter-freshness')).toBeTruthy();
  });

  it('parses `_text_` markers into italic spans', () => {
    render(
      withTheme(
        <TrendsLetterHero
          body="You are _in pattern_ this month."
          testID="letter"
        />,
      ),
    );
    // Markers are stripped — the rendered text concatenates the spans
    // without the surrounding underscores. The matched substring
    // ("in pattern") appears as a child Text node inside the paragraph.
    expect(screen.queryByText('_in pattern_')).toBeNull();
    expect(screen.getByText('in pattern')).toBeTruthy();
  });

  it('sample narrative passes voice-lint', () => {
    const sample =
      'You are _in pattern_ this month. Your mornings averaged 123/81. And after the shorter nights, mornings ran a little higher.';
    expect(lintVoiceText(sample).passes).toBe(true);
  });

  it('caregiver narrative passes voice-lint', () => {
    const sample =
      "Mum is _in pattern_ this month. Mum's mornings averaged 124/82.";
    expect(lintVoiceText(sample).passes).toBe(true);
  });
});
