// Placeholder for Sprint 4 (self-buyer onboarding). Same shape as the
// caregiver placeholder; differentiated only by the headline so routing
// can be visually verified.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useAuth } from '../../state/auth';

export function SelfBuyerHomePlaceholder() {
  const theme = useTheme();
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);

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
          { paddingHorizontal: theme.spacing.xxl, paddingTop: theme.spacing.xxl },
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
          Self-buyer onboarding goes here
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
          Sprint 4 fills this in. For now, you're signed in.
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
            }}
          >
            {profile?.email ?? '—'}
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
