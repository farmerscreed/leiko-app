import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner, OFFLINE_BANNER_COPY } from '../OfflineBanner';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTree(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 20, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('OfflineBanner', () => {
  it('renders nothing when online (default network state)', () => {
    render(withTree(<OfflineBanner testID="banner" />));
    expect(screen.queryByTestId('banner')).toBeNull();
  });

  it('renders the calm reassurance copy when forceOffline=true', () => {
    render(withTree(<OfflineBanner forceOffline testID="banner" />));
    expect(screen.getByTestId('banner-label')).toHaveTextContent(
      OFFLINE_BANNER_COPY,
    );
  });

  it('exposes accessibilityRole="alert" + polite live region', () => {
    render(withTree(<OfflineBanner forceOffline testID="banner" />));
    const node = screen.getByTestId('banner');
    expect(node.props.accessibilityRole).toBe('alert');
    expect(node.props.accessibilityLiveRegion).toBe('polite');
  });

  it("the banner copy passes voice-lint", () => {
    expect(lintVoiceText(OFFLINE_BANNER_COPY).passes).toBe(true);
  });
});
