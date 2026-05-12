import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorState } from '../ErrorState';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('ErrorState', () => {
  it('renders the default title and body', () => {
    render(withTheme(<ErrorState testID="err" />));
    expect(screen.getByTestId('err-title').props.children).toContain("couldn't");
    expect(screen.getByTestId('err-body')).toBeTruthy();
  });

  it('renders custom title and body when supplied', () => {
    render(
      withTheme(
        <ErrorState
          title="We couldn't reach Leiko."
          body="Check your connection and try again."
          testID="err"
        />,
      ),
    );
    expect(screen.getByTestId('err-title')).toHaveTextContent(/reach Leiko/);
  });

  it('renders the retry button only when onRetry is supplied', () => {
    const onRetry = jest.fn();
    const { rerender } = render(
      withTheme(<ErrorState testID="err" />),
    );
    expect(screen.queryByTestId('err-retry')).toBeNull();
    rerender(
      withTheme(<ErrorState onRetry={onRetry} testID="err" />),
    );
    fireEvent.press(screen.getByTestId('err-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityRole="alert"', () => {
    render(withTheme(<ErrorState testID="err" />));
    expect(screen.getByTestId('err').props.accessibilityRole).toBe('alert');
  });

  it('default copy passes voice-lint', () => {
    // The component's own defaults are the most-shipped strings — they
    // must pass voice-lint. Render directly and lint the visible text.
    render(withTheme(<ErrorState testID="err" />));
    const titleText = String(screen.getByTestId('err-title').props.children);
    const bodyText = String(screen.getByTestId('err-body').props.children);
    expect(lintVoiceText(`${titleText} ${bodyText}`).passes).toBe(true);
  });
});
