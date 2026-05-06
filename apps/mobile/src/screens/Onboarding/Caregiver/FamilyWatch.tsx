// FamilyWatch — docs/04-screens/caregiver-onboarding.md §4.4.3.
// Two-card watch path. "I have the watch with me" calls
// completeWithWatchInHand(): updates public.users, calls create_family RPC,
// flips the navigator gate. The other path ("Ship one to them") is gated
// off until the Shopify integration ships in a later sprint.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../../components/Card';
import { Pill } from '../../../components/Pill';
import { useTheme } from '../../../theme';
import { useOnboarding } from '../../../state/onboarding';
import type { CaregiverOnboardingScreenProps } from '../../../navigation/types';

export function CaregiverFamilyWatchScreen({
  navigation,
}: CaregiverOnboardingScreenProps<'FamilyWatch'>) {
  const theme = useTheme();
  const completeWithWatchInHand = useOnboarding((s) => s.completeWithWatchInHand);
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
      await completeWithWatchInHand();
      // No explicit navigation — the navigator re-evaluates on the
      // caregiverOnboardingComplete flag flip and renders the home stack.
    } catch {
      // Error message surfaces via finalizeError below.
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
          Where's the watch right now?
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
          We'll set it up the right way for where it lives.
        </Text>

        <Card
          elevation="low"
          onPress={handleHaveWatch}
          disabled={finalizing}
          accessibilityLabel="I have the watch with me. Set up over Bluetooth on this phone."
          testID="family-watch-have"
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
            I have the watch with me
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              lineHeight: body.lineHeight,
              fontFamily: body.family,
            }}
          >
            We'll pair it over Bluetooth on this phone.
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
          accessibilityLabel="Ship one to them. Coming soon in the United States."
          testID="family-watch-ship"
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
              Ship one to them
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
            We're getting ready to ship watches direct in the United States.
          </Text>
        </Card>

        {finalizeError ? (
          <Text
            accessibilityLiveRegion="polite"
            testID="family-watch-error"
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
