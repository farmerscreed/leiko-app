// FamilyWatch — docs/04-screens/caregiver-onboarding.md §4.4.3.
// Two-card watch path. "I have the watch with me" calls
// completeWithWatchInHand(): updates public.users, calls create_family RPC,
// flips the navigator gate. The other path ("Ship one to them") is gated
// off until the Shopify integration ships in a later sprint.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AcceptInviteSheet } from '../../../components/AcceptInviteSheet';
import { Card } from '../../../components/Card';
import { Pill } from '../../../components/Pill';
import { useTheme } from '../../../theme';
import { useAuth } from '../../../state/auth';
import { useOnboarding } from '../../../state/onboarding';
import type { CaregiverOnboardingScreenProps } from '../../../navigation/types';

export function CaregiverFamilyWatchScreen({
  navigation,
}: CaregiverOnboardingScreenProps<'FamilyWatch'>) {
  const theme = useTheme();
  const completeWithWatchInHand = useOnboarding((s) => s.completeWithWatchInHand);
  const completeViaInvite = useOnboarding((s) => s.completeViaInvite);
  const finalizing = useOnboarding((s) => s.finalizing);
  const finalizeError = useOnboarding((s) => s.finalizeError);
  const profileEmail = useAuth((s) => s.profile?.email ?? '');

  const [pressed, setPressed] = useState<'have' | 'later' | 'invited' | null>(null);
  // Sprint 16.6 Issue #1 — third onboarding path for caregivers who
  // were invited to an existing family. Opens AcceptInviteSheet; on
  // success calls completeViaInvite (no create_family).
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);

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

  // Sprint 16.6: third option for caregivers whose parent already has
  // the watch on another phone, or who just want to finish onboarding
  // now and pair the watch later from Settings. Same underlying call —
  // completeWithWatchInHand only finalizes the user + family rows, it
  // does NOT actually pair a device. The name is historical.
  const handleAddLater = async () => {
    if (finalizing) return;
    setPressed('later');
    try {
      await completeWithWatchInHand();
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

        <Card
          elevation="low"
          onPress={() => setInviteSheetOpen(true)}
          disabled={finalizing}
          accessibilityLabel="Someone invited me. Enter the 6-digit code they shared and join their family circle."
          testID="family-watch-invited"
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
            Someone invited me
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              lineHeight: body.lineHeight,
              fontFamily: body.family,
            }}
          >
            I have a 6-digit code from a family member. Join their circle.
          </Text>
          {pressed === 'invited' && finalizing ? (
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: caption.size,
                fontFamily: caption.family,
                marginTop: theme.spacing.s,
              }}
              accessibilityLiveRegion="polite"
            >
              Joining the circle…
            </Text>
          ) : null}
        </Card>

        <Card
          elevation="low"
          onPress={handleAddLater}
          disabled={finalizing}
          accessibilityLabel="Add a watch later. Finish setup now and pair a watch from Settings when you're ready."
          testID="family-watch-later"
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
            Add a watch later
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              lineHeight: body.lineHeight,
              fontFamily: body.family,
            }}
          >
            Finish setting up now. You can pair a watch from Settings whenever it's ready.
          </Text>
          {pressed === 'later' && finalizing ? (
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
      {/* Sprint 16.6 Issue #1 — accept-invite sheet for invited
          caregivers. showSuccessState=false so the sheet closes
          immediately on success and we finalize onboarding atomically
          via completeViaInvite. */}
      <AcceptInviteSheet
        visible={inviteSheetOpen}
        onDismiss={() => setInviteSheetOpen(false)}
        initialEmail={profileEmail}
        showSuccessState={false}
        onSuccess={async ({ familyId }) => {
          setInviteSheetOpen(false);
          setPressed('invited');
          try {
            await completeViaInvite(familyId);
          } catch {
            // finalizeError surfaces via the inline error message
            // beneath the cards.
            setPressed(null);
          }
        }}
        testID="family-watch-accept"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
