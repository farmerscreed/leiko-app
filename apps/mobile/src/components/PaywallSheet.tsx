// PaywallSheet — Sprint 9 minimal entry point for Leiko Plus prompts.
//
// Sourced from docs/09-paywall-and-iap.md §3 (paywall screen anatomy)
// and D8a §9.3-9.4 (account_type-switched headline + value bullets).
//
// Sprint 9 scope is the *trigger*: when a free user taps a Plus-only
// surface (Trends >7d range chip, "Save as PDF for my doctor"), this
// sheet rises with the right copy, dismisses politely, and does NOT
// attempt to start a purchase. Sprint 10 swaps the primary CTA for the
// real RevenueCat trial-start flow + product price block.
//
// Design notes:
//   • Reuses the shared BottomSheet (D12 §11.1 glass + spring rise).
//   • Headline + bullets switch on `accountType` per D8a §9.3-9.4.
//     Self-buyer leads with the doctor-PDF value prop because that's
//     the most compelling self-buyer ask (per D8a §9.4 callout).
//   • "Maybe later" dismiss is dignified — no countdown, no "are you
//     sure", no ?guilt UI (CLAUDE.md anti-pattern + D5 §3.4).
//   • The "Try free for 7 days" button is rendered for visual parity
//     with the eventual paywall but in Sprint 9 it just dismisses the
//     sheet (Sprint 10 hooks it to RevenueCat). Marked accessibility-
//     hint accordingly so screen-reader users know it's stubbed.

import { Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { useTheme } from '../theme';
import type { AccountType } from '../types/database';

export type PaywallTrigger =
  | 'range_extension'        // Trends — tap a >7d range chip
  | 'pdf_export'             // Trends — tap "Save as PDF for my doctor"
  | 'all_time_range'         // Trends — tap the All-time chip (self-buyer)
  | 'tier_b_query'           // AI assistant — first Tier-B query attempt
  | 'anomaly_optin'          // Home — tap proactive-alerts opt-in
  | 'sixth_reading'          // Auto-fire on 6th reading per identity
  | 'add_caregiver';         // Settings — tap "+ Add caregiver" past limit

export interface PaywallSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Switches headline + value-bullet copy per D8a §9.3-9.4. */
  accountType: AccountType;
  /** Source of the trigger — feeds analytics + future routing.
   *  Currently used only for the testID; Sprint 10 logs it. */
  trigger: PaywallTrigger;
  testID?: string;
}

interface PaywallCopy {
  headline: string;
  body: string;
  bullets: string[];
}

function copyForMode(accountType: AccountType): PaywallCopy {
  // Self-buyer leads with the PDF / explanation / full history bullets
  // per D8a §9.4. Caregiver leads with multi-caregiver / weekly summary
  // / share-with-doctor.
  if (accountType === 'self_buyer') {
    return {
      headline: 'Understand your numbers',
      body:
        'See trends clearly. Share them with your doctor. Get plain-language explanations of what your readings mean.',
      bullets: [
        'A one-page summary you can save and show your doctor',
        'Plain-language explanations of every reading and trend',
        'Full history, with no time limit on what you can see',
      ],
    };
  }
  // 'caregiver' OR 'parent'. Parent users won't normally see this sheet
  // (they're read-only large-text mode), but when they do — for example
  // a hybrid-mode flow — caregiver copy is the safe default.
  return {
    headline: 'Stay close, every day',
    body:
      "Leiko helps you stay close to your parent's health — with calm, contextual updates.",
    bullets: [
      'Up to 5 family members can stay informed',
      'AI-generated weekly summaries',
      "Share readings with your parent's doctor",
    ],
  };
}

export function PaywallSheet({
  visible,
  onDismiss,
  accountType,
  trigger,
  testID,
}: PaywallSheetProps) {
  const theme = useTheme();
  const copy = copyForMode(accountType);

  const headlineStyle = theme.type('headline');
  const bodyStyle = theme.type('bodyL');
  const bulletStyle = theme.type('bodyL');
  const labelStyle = theme.type('label');

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      size="tall"
      title="Leiko Plus"
      testID={testID ?? `paywall-sheet:${trigger}`}
    >
      <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.xl }}>
        {/* Headline */}
        <View style={{ marginTop: theme.spacing.l }}>
          <View
            accessibilityRole="header"
            accessibilityLabel={copy.headline}
          >
            {/* RN 0.81 typography — pass typography style + colour */}
            <Text style={[headlineStyle, { color: theme.colors.text.primary }]}>
              {copy.headline}
            </Text>
          </View>
          <View style={{ marginTop: theme.spacing.s }}>
            <Text style={[bodyStyle, { color: theme.colors.text.secondary }]}>
              {copy.body}
            </Text>
          </View>
        </View>

        {/* Value bullets */}
        <View style={{ marginTop: theme.spacing.l }}>
          {copy.bullets.map((bullet) => (
            <View
              key={bullet}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginTop: theme.spacing.m,
              }}
            >
              <Text
                style={[
                  bulletStyle,
                  { color: theme.colors.brand.primary, width: theme.spacing.l },
                ]}
              >
                {'•'}
              </Text>
              <Text
                style={[
                  bulletStyle,
                  { color: theme.colors.text.primary, flex: 1 },
                ]}
              >
                {bullet}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA stack */}
        <View style={{ marginTop: theme.spacing.xl }}>
          {/* Sprint 10 will swap onPress for the RevenueCat trial-start.
              Sprint 9 dismisses the sheet so the flow is testable end-to-
              end without a real purchase. */}
          <Button
            variant="primary"
            onPress={onDismiss}
            accessibilityLabel="Try Leiko Plus free for seven days"
            accessibilityHint="The trial sign-up flow lands in the next sprint."
            testID="paywall-sheet:cta-trial"
          >
            Try Leiko Plus free for 7 days
          </Button>
          <View style={{ marginTop: theme.spacing.m, alignItems: 'center' }}>
            <Button
              variant="ghost"
              onPress={onDismiss}
              accessibilityLabel="Maybe later"
              testID="paywall-sheet:cta-dismiss"
            >
              Maybe later
            </Button>
          </View>
        </View>

        {/* Legal footer — voice-passing, no urgency */}
        <View style={{ marginTop: theme.spacing.l, alignItems: 'center' }}>
          <Text style={[labelStyle, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
            Subscriptions auto-renew. Manage anytime in Settings.
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
}

