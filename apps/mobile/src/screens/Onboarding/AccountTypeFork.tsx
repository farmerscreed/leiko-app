// AccountTypeFork — D6 US-1, D8a §3.1, docs/04-screens/onboarding-fork.md.
//
// Both CTAs are button.primary by spec (D8a §3.1.2): equal visual weight
// respects the user's choice and avoids biasing self-buyers toward the
// caregiver path. The tertiary "Sign in" link below them is a Sprint 2
// extension for returning users (proposed in the sprint plan and added
// to onboarding-fork.md in the same commit).
//
// On tap, the choice is cached in MMKV via setPendingAccountType. The
// commit to public.users.account_type happens later, at sign-up, via
// raw_user_meta_data → handle_new_user trigger.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme';
import { useAuth } from '../../state/auth';
import type { AuthScreenProps } from '../../navigation/types';
import type { AccountType } from '../../types/database';

export function AccountTypeForkScreen({ navigation }: AuthScreenProps<'AccountTypeFork'>) {
  const theme = useTheme();
  const setPendingAccountType = useAuth((s) => s.setPendingAccountType);

  const headline = theme.type('displayL');
  const body = theme.type('bodyL');
  const caption = theme.type('caption');
  const link = theme.type('bodyM');

  const handleChoice = (kind: AccountType) => {
    setPendingAccountType(kind);
    navigation.navigate('SignUp');
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
            paddingTop: theme.spacing.xxxl,
            paddingBottom: theme.spacing.xxl,
          },
        ]}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Leiko"
          style={[
            styles.logo,
            {
              backgroundColor: theme.colors.brand.primary,
              borderRadius: theme.radii.full,
              marginBottom: theme.spacing.xxxl,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.text.onBrand,
              fontSize: 36,
              fontWeight: '700',
              fontFamily: theme.fontFamily.display,
            }}
          >
            L
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headline.size,
            lineHeight: headline.lineHeight,
            fontWeight: headline.weight as '700',
            fontFamily: headline.family,
            textAlign: 'center',
            marginBottom: theme.spacing.m,
          }}
        >
          Who are you setting up for?
        </Text>

        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: body.size,
            lineHeight: body.lineHeight,
            fontWeight: body.weight as '400',
            fontFamily: body.family,
            textAlign: 'center',
            maxWidth: 280,
            marginBottom: theme.spacing.xxxl,
          }}
        >
          Leiko works for both — the path just looks a little different.
        </Text>

        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Someone I care for. A parent, partner, or other family member."
          style={{ width: '100%', marginBottom: theme.spacing.l }}
        >
          <Button
            variant="primary"
            onPress={() => handleChoice('caregiver')}
            testID="fork-caregiver"
            style={{ width: '100%' }}
          >
            Someone I care for
          </Button>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: caption.size,
              lineHeight: caption.lineHeight,
              fontFamily: caption.family,
              textAlign: 'center',
              marginTop: theme.spacing.xs,
            }}
          >
            A parent, partner, or other family member
          </Text>
        </View>

        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Myself. I have or want to track my own blood pressure."
          style={{ width: '100%', marginBottom: theme.spacing.xxl }}
        >
          <Button
            variant="primary"
            onPress={() => handleChoice('self_buyer')}
            testID="fork-self-buyer"
            style={{ width: '100%' }}
          >
            Myself
          </Button>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: caption.size,
              lineHeight: caption.lineHeight,
              fontFamily: caption.family,
              textAlign: 'center',
              marginTop: theme.spacing.xs,
            }}
          >
            I have or want to track my own blood pressure
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('SignIn')}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Sign in."
          testID="fork-sign-in"
          hitSlop={theme.spacing.s}
          style={{ paddingVertical: theme.spacing.s }}
        >
          <Text
            style={{
              fontSize: link.size,
              lineHeight: link.lineHeight,
              fontFamily: link.family,
              textAlign: 'center',
              color: theme.colors.text.secondary,
            }}
          >
            Already have an account?{' '}
            <Text style={{ color: theme.colors.brand.primary, fontWeight: '600' }}>
              Sign in
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
});
