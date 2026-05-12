import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  SyncReassuranceBanner,
  SYNC_REASSURANCE_COPY,
} from '../SyncReassuranceBanner';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';
import {
  clearSyncFailure,
  markSyncFailure,
} from '../../services/sync/syncFailureTracker';
import { mmkv } from '../../services/storage';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

beforeEach(() => {
  mmkv.clearAll();
});

describe('SyncReassuranceBanner', () => {
  it('renders nothing when no failure streak is active', () => {
    render(withTheme(<SyncReassuranceBanner testID="reassurance" />));
    expect(screen.queryByTestId('reassurance')).toBeNull();
  });

  it('renders nothing when streak is shorter than 24h', () => {
    markSyncFailure(0);
    render(
      withTheme(
        <SyncReassuranceBanner
          nowProvider={() => 1_000}
          testID="reassurance"
        />,
      ),
    );
    expect(screen.queryByTestId('reassurance')).toBeNull();
  });

  it('renders the calm copy after 24h', () => {
    markSyncFailure(0);
    render(
      withTheme(
        <SyncReassuranceBanner
          nowProvider={() => 24 * 60 * 60 * 1000 + 1_000}
          testID="reassurance"
        />,
      ),
    );
    expect(screen.getByTestId('reassurance-label')).toHaveTextContent(
      SYNC_REASSURANCE_COPY,
    );
  });

  it('forceVisible overrides the hook for previews', () => {
    render(
      withTheme(<SyncReassuranceBanner forceVisible testID="reassurance" />),
    );
    expect(screen.getByTestId('reassurance')).toBeTruthy();
  });

  it('reassurance copy passes voice-lint', () => {
    expect(lintVoiceText(SYNC_REASSURANCE_COPY).passes).toBe(true);
  });

  it('clearSyncFailure hides the banner', () => {
    markSyncFailure(0);
    clearSyncFailure();
    render(
      withTheme(
        <SyncReassuranceBanner
          nowProvider={() => 24 * 60 * 60 * 1000 + 1_000}
          testID="reassurance"
        />,
      ),
    );
    expect(screen.queryByTestId('reassurance')).toBeNull();
  });
});
