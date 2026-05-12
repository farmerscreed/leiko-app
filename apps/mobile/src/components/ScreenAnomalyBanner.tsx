// ScreenAnomalyBanner — Sprint 15.
//
// Thin wrapper around AnomalyBanner. Reads the most-severe-unacknowledged
// anomaly from the store and renders the banner with the correct copy
// for the recipient. Renders nothing when there's no anomaly. Same
// component drives Home, ReadingDetail, and the vital detail screens —
// pass the optional vital prop to scope the banner to a single vital.

import { useCallback } from 'react';
import { AnomalyBanner } from './AnomalyBanner';
import {
  useMostSevereAnomaly,
  useMostSevereAnomalyForVital,
  useAnomalyForReading,
} from '../hooks/useAnomalies';
import { useAnomalies, type AnomalyVital, type AnomalyEvent } from '../state/anomalies';
import { useAuth } from '../state/auth';
import { bannerCopyFor, type BannerRecipient } from '../utils/anomalyBannerCopy';
import { logger } from '../services/analytics/logger';
import { navigationRef } from '../navigation/navigationRef';

export interface ScreenAnomalyBannerProps {
  /** Scope to a single vital (used by per-vital detail screens). */
  vital?: AnomalyVital;
  /** Scope to a specific reading (used by Reading Detail). */
  readingServerId?: string;
  /** Tap action override — defaults to navigate to vital/reading detail
   *  via the module-level navigation ref. */
  onTap?: () => void;
}

export function ScreenAnomalyBanner({
  vital,
  readingServerId,
  onTap,
}: ScreenAnomalyBannerProps) {
  const accountType = useAuth((s) => s.profile?.account_type) ?? 'caregiver';
  const recipient: BannerRecipient = accountType as BannerRecipient;
  const acknowledge = useAnomalies((s) => s.acknowledge);

  // Three usage modes: per-reading > per-vital > home.
  // Hooks must always be called in the same order; pick the input
  // based on scope and let the unused inputs fall through to null.
  const eventForReading = useAnomalyForReading(readingServerId ?? null);
  const eventForVital = useMostSevereAnomalyForVital(vital ?? 'bp');
  const eventForHome = useMostSevereAnomaly();
  const event: AnomalyEvent | null = readingServerId
    ? eventForReading
    : vital
      ? eventForVital
      : eventForHome;

  const handleTap = useCallback(() => {
    if (!event) return;
    logger.track('anomaly_banner_tapped', { vital: event.vital, tier: event.tier });
    if (onTap) {
      onTap();
      return;
    }
    // Module-level navigation ref — works without a useNavigation hook,
    // so the component renders correctly in unit tests that mount it
    // outside NavigationContainer. The ref is no-op until the navigator
    // is ready; at runtime that's well before any banner appears.
    if (!navigationRef.isReady()) return;
    if (event.vital === 'bp' && event.readingId) {
      (navigationRef as unknown as {
        navigate: (n: string, p: unknown) => void;
      }).navigate('ReadingDetail', {
        readingLocalId: `srv-${event.readingId}`,
      });
      return;
    }
    (navigationRef as unknown as {
      navigate: (n: string, p: unknown) => void;
    }).navigate('VitalDetail', { vital: event.vital });
  }, [event, onTap]);

  if (!event) return null;
  const copy = bannerCopyFor(event, recipient, 'Mum');

  return (
    <AnomalyBanner
      severity={copy.severity}
      title={copy.title}
      body={copy.body}
      cta={{ label: 'See the reading', onPress: handleTap }}
      onDismiss={
        copy.severity === 'calm-concerned' ? () => acknowledge(event.id) : undefined
      }
      testID="screen-anomaly-banner"
    />
  );
}
