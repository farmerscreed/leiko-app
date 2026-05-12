import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { LoadingState } from '../LoadingState';
import { ThemeProvider } from '../../theme';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('LoadingState', () => {
  it('renders an ActivityIndicator', () => {
    render(withTheme(<LoadingState testID="loading" />));
    const root = screen.getByTestId('loading');
    expect(root.props.accessibilityRole).toBe('progressbar');
  });

  it('renders an optional caption when supplied', () => {
    render(
      withTheme(<LoadingState caption="Loading your trend." testID="loading" />),
    );
    expect(screen.getByTestId('loading-caption')).toHaveTextContent(
      'Loading your trend.',
    );
  });

  it('uses the caption as the accessibility label when supplied', () => {
    render(
      withTheme(<LoadingState caption="Loading your trend." testID="loading" />),
    );
    expect(screen.getByTestId('loading').props.accessibilityLabel).toBe(
      'Loading your trend.',
    );
  });

  it('defaults the accessibility label to "Loading"', () => {
    render(withTheme(<LoadingState testID="loading" />));
    expect(screen.getByTestId('loading').props.accessibilityLabel).toBe('Loading');
  });
});
