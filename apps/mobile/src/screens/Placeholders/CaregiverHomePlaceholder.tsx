// Caregiver post-onboarding placeholder. Until Sprint 5 ships real BLE
// pairing and Sprint 7 ships the home screen, this is what a caregiver
// sees after finishing onboarding by tapping "I have the watch with me"
// on FamilyWatch. Shows the bound family + the next step (pair the
// watch) so routing is visually verifiable.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useAuth } from '../../state/auth';
import { useOnboarding } from '../../state/onboarding';

export function CaregiverHomePlaceholder() {
  const theme = useTheme();
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const familyId = useOnboarding((s) => s.familyId);

  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  const label = theme.type('label');

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
          },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headline.size,
            lineHeight: headline.lineHeight,
            fontFamily: headline.family,
            fontWeight: headline.weight as '700',
            marginBottom: theme.spacing.l,
          }}
        >
          You're all set
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
          Next, we'll pair the watch. We're getting that part ready.
        </Text>

        <View
          style={{
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radii.m,
            padding: theme.spacing.l,
            marginBottom: theme.spacing.xxl,
          }}
        >
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: label.size,
              fontFamily: label.family,
              marginBottom: theme.spacing.xs,
            }}
          >
            Account type
          </Text>
          <Text
            testID="placeholder-account-type"
            style={{
              color: theme.colors.text.primary,
              fontSize: body.size,
              fontFamily: body.family,
              marginBottom: theme.spacing.l,
            }}
          >
            {profile?.account_type ?? '—'}
          </Text>

          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: label.size,
              fontFamily: label.family,
              marginBottom: theme.spacing.xs,
            }}
          >
            Email
          </Text>
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: body.size,
              fontFamily: body.family,
              marginBottom: theme.spacing.l,
            }}
          >
            {profile?.email ?? '—'}
          </Text>

          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: label.size,
              fontFamily: label.family,
              marginBottom: theme.spacing.xs,
            }}
          >
            Family
          </Text>
          <Text
            testID="placeholder-family-id"
            style={{
              color: theme.colors.text.primary,
              fontSize: body.size,
              fontFamily: body.family,
            }}
          >
            {familyId ?? '—'}
          </Text>
        </View>

        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          testID="placeholder-sign-out"
          style={{ paddingVertical: theme.spacing.s, alignSelf: 'flex-start' }}
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: body.size,
              fontFamily: body.family,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
