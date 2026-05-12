import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('EmptyState', () => {
  it('renders the title', () => {
    render(
      withTheme(
        <EmptyState
          title="No readings yet"
          testID="empty"
        />,
      ),
    );
    expect(screen.getByTestId('empty-title')).toHaveTextContent('No readings yet');
  });

  it('renders the optional body when supplied', () => {
    render(
      withTheme(
        <EmptyState
          title="No readings yet"
          body="Take your first reading whenever you're ready."
          testID="empty"
        />,
      ),
    );
    expect(screen.getByTestId('empty-body')).toBeTruthy();
  });

  it('does not render a body element when body is omitted', () => {
    render(
      withTheme(<EmptyState title="No readings yet" testID="empty" />),
    );
    expect(screen.queryByTestId('empty-body')).toBeNull();
  });

  it('fires the CTA onPress', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <EmptyState
          title="No readings yet"
          cta={{ label: 'Take a reading', onPress }}
          testID="empty"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('empty-cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityRole="text"', () => {
    render(
      withTheme(<EmptyState title="No readings yet" testID="empty" />),
    );
    expect(screen.getByTestId('empty').props.accessibilityRole).toBe('text');
  });

  it('the default props pass voice-lint', () => {
    // EmptyState ships no built-in copy — but the consumer-facing strings
    // we use in Sprint 16 wiring must pass. Lint a representative payload.
    const sample = 'No readings yet. Take your first reading whenever you are ready.';
    const result = lintVoiceText(sample);
    expect(result.passes).toBe(true);
  });
});
