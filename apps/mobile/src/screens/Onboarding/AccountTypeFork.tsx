// AccountTypeFork — ADR-0006 Phase 3 (unified model).
//
// HISTORY: this screen used to fork account_type into 'caregiver' vs
// 'self_buyer', which selected two entirely separate navigation trees and
// home screens. ADR-0006 collapses that: there is ONE unified experience
// (the constellation home where the viewer is a node and can both wear a
// watch and follow people they care for). So both CTAs now onboard the
// user as 'self_buyer' — the self-owning persona that the unified home is
// built on — and the screen reframes from "who are you setting up for?"
// (an identity fork) to a calm welcome that names what Leiko can do.
//
// We keep account_type = 'self_buyer' rather than ripping the column out:
// the root navigator still branches on it, and self_buyer resolves to the
// unified constellation home. Existing 'caregiver' accounts continue to
// work unchanged. account_type is committed at sign-up via
// raw_user_meta_data → handle_new_user; here we just cache the pending
// value in MMKV. (Removing the column / nav branch entirely is a later,
// higher-risk step deliberately deferred per ADR-0006.)

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
  const link = theme.type('bodyM');

  // ADR-0006 — every new user onboards as 'self_buyer' (the self-owning
  // persona the unified constellation home is built on). The two CTAs are
  // framing only — both lead to the same unified onboarding; the user
  // pairs their own watch and/or adds people they care for afterward, on
  // the home. account_type is no longer an identity fork.
  const UNIFIED_ACCOUNT_TYPE: AccountType = 'self_buyer';
  const handleContinue = () => {
    setPendingAccountType(UNIFIED_ACCOUNT_TYPE);
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
          Welcome to Leiko
        </Text>

        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: body.size,
            lineHeight: body.lineHeight,
            fontWeight: body.weight as '400',
            fontFamily: body.family,
            textAlign: 'center',
            maxWidth: 300,
            marginBottom: theme.spacing.xxxl,
          }}
        >
          Track your own readings and keep an eye on the people you care
          for — all in one place.
        </Text>

        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Get started"
          style={{ width: '100%', marginBottom: theme.spacing.xxl }}
        >
          <Button
            variant="primary"
            onPress={handleContinue}
            testID="fork-get-started"
            style={{ width: '100%' }}
          >
            Get started
          </Button>
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
