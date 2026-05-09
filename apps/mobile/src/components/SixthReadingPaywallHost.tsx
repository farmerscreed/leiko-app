// SixthReadingPaywallHost — Sprint 10a auto-paywall mount point.
//
// Mounted on both home screens (CaregiverHome + SelfBuyerHome). The
// hook decides whether the surface is visible (per family per month
// threshold from D8a §9.1) and the host wires it to the PaywallSheet.
// Other paywall triggers (Trends range / PDF / AI Tier-B / etc.) own
// their own state — this host is only for the auto-trigger.

import { PaywallSheet } from './PaywallSheet';
import { useSixthReadingPaywall } from '../hooks/useSixthReadingPaywall';
import type { AccountType } from '../types/database';

interface SixthReadingPaywallHostProps {
  accountType: AccountType;
  familyId: string | null;
}

export function SixthReadingPaywallHost({
  accountType,
  familyId,
}: SixthReadingPaywallHostProps) {
  const { visible, dismiss } = useSixthReadingPaywall(familyId);
  return (
    <PaywallSheet
      visible={visible}
      onDismiss={dismiss}
      accountType={accountType}
      trigger="sixth_reading"
      testID="paywall-sheet:sixth_reading"
    />
  );
}
