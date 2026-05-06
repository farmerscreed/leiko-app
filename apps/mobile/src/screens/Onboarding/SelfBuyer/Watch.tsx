// Self-Buyer / Watch — docs/04-screens/self-buyer-onboarding.md §4.4.2
// (D8a §4.2). Two-card watch path. "I have it" calls
// completeSelfBuyer() — updates public.users (display_name + timezone +
// optional year_of_birth), runs the create_family RPC on the
// self_buyer branch, flips the navigator gate. "I need to order one"
// is gated off until the Shopify integration ships in a later sprint.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../../components/Card';
import { Pill } from '../../../components/Pill';
import { useTheme } from '../../../theme';
import { useOnboarding } from '../../../state/onboarding';
import type { SelfBuyerOnboardingScreenProps } from '../../../navigation/types';

export function SelfBuyerWatchScreen({
  navigation,
}: SelfBuyerOnboardingScreenProps<'Watch'>) {
  const theme = useTheme();
  const completeSelfBuyer = useOnboarding((s) => s.completeSelfBuyer);
  const finalizing = useOnboarding((s) => s.finalizing);
  const finalizeError = useOnboarding((s) => s.finalizeError);

  const [pressed, setPressed] = useState<'have' | null>(null);

  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  const title = theme.type('title');
  const caption = theme.type('caption');

  const handleHaveWatch = async () => {
    if (finalizing) return;
    setPressed('have');
    try {
      await completeSelfBuyer();
    } catch {
      setPressed(null);
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: theme.spacing.xxl,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.xxl,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.xxl }}
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: body.size,
              fontFamily: body.family,
            }}
          >
            Back
          </Text>
        </Pressable>

        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headline.size,
            lineHeight: headline.lineHeight,
            fontWeight: headline.weight as '700',
            fontFamily: headline.family,
            marginBottom: theme.spacing.s,
          }}
        >
          Do you have the watch yet?
        </Text>

        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: body.size,
            lineHeight: body.lineHeight,
            fontFamily: body.family,
            marginBottom: theme.spacing.xxl,
          }}
        >
          No problem either way — we'll guide you through the next step.
        </Text>

        <Card
          elevation="low"
          onPress={handleHaveWatch}
          disabled={finalizing}
          accessibilityLabel="I have it. Pair it now over Bluetooth."
          testID="self-buyer-watch-have"
          style={{ marginBottom: theme.spacing.l }}
        >
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: title.size,
              lineHeight: title.lineHeight,
              fontWeight: title.weight as '600',
              fontFamily: title.family,
              marginBottom: theme.spacing.xs,
            }}
          >
            I have it
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              lineHeight: body.lineHeight,
              fontFamily: body.family,
            }}
          >
            Let's pair it now.
          </Text>
          {pressed === 'have' && finalizing ? (
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: caption.size,
                fontFamily: caption.family,
                marginTop: theme.spacing.s,
              }}
              accessibilityLiveRegion="polite"
            >
              Setting things up…
            </Text>
          ) : null}
        </Card>

        <Card
          elevation="default"
          disabled
          accessibilityLabel="I need to order one. Coming soon."
          testID="self-buyer-watch-order"
          style={{ marginBottom: theme.spacing.l }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: theme.spacing.xs,
            }}
          >
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: title.size,
                lineHeight: title.lineHeight,
                fontWeight: title.weight as '600',
                fontFamily: title.family,
                flex: 1,
              }}
            >
              I need to order one
            </Text>
            <Pill variant="info">Coming soon</Pill>
          </View>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              lineHeight: body.lineHeight,
              fontFamily: body.family,
            }}
          >
            We're getting the shop ready. We'll let you know when it opens.
          </Text>
        </Card>

        {finalizeError ? (
          <Text
            accessibilityLiveRegion="polite"
            testID="self-buyer-watch-error"
            style={{
              color: theme.colors.state.urgent,
              fontSize: body.size,
              fontFamily: body.family,
              marginTop: theme.spacing.l,
            }}
          >
            {finalizeError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
