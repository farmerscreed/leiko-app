// Self-buyer post-onboarding placeholder. Until Sprint 5 ships real BLE
// pairing and Sprint 8 ships the self-buyer home screen, this is what a
// self-buyer sees after finishing onboarding by tapping "I have it" on
// the Watch screen. Mirrors the caregiver placeholder.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { ReadingCard } from '../../components/ReadingCard';
import { useTheme } from '../../theme';
import { useAuth } from '../../state/auth';
import { useOnboarding } from '../../state/onboarding';
import { usePairing } from '../../state/pairing';
import { useReadings } from '../../state/readings';
import type { SelfBuyerStackParamList } from '../../navigation/types';

export function SelfBuyerHomePlaceholder() {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<SelfBuyerStackParamList>>();
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const familyId = useOnboarding((s) => s.familyId);
  const pairedDevice = usePairing((s) => s.pairedDevice);
  const latestReading = useReadings((s) => s.latest());

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
          {pairedDevice
            ? `The watch ending ${pairedDevice.macSuffix} is paired and ready.`
            : "Next, pair the watch so we can start tracking your readings."}
        </Text>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          {pairedDevice ? (
            <Button
              variant="secondary"
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Open settings"
              testID="placeholder-open-settings"
            >
              Settings
            </Button>
          ) : (
            <Button
              variant="primary"
              onPress={() => navigation.navigate('Pairing')}
              accessibilityLabel="Pair your watch"
              testID="placeholder-pair-watch"
            >
              Pair your watch
            </Button>
          )}
        </View>

        {pairedDevice && latestReading ? (
          <View style={{ marginBottom: theme.spacing.xxl }}>
            <ReadingCard
              reading={latestReading}
              ownerVariant="self"
              onPress={() =>
                navigation.navigate('ReadingDetail', {
                  readingLocalId: latestReading.localId,
                })
              }
              testID="placeholder-latest-reading"
            />
          </View>
        ) : null}

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

      {pairedDevice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a reading"
          testID="placeholder-take-reading-fab"
          onPress={() => navigation.navigate('TakeReading')}
          style={({ pressed }) => ({
            position: 'absolute',
            right: theme.spacing.xxl,
            bottom: theme.spacing.xxl,
            backgroundColor: pressed
              ? theme.colors.brand.primarySoft
              : theme.colors.brand.primary,
            borderRadius: theme.radii.full,
            paddingVertical: theme.spacing.l,
            paddingHorizontal: theme.spacing.xl,
            ...theme.elevation.medium.ios,
            ...theme.elevation.medium.android,
          })}
        >
          <Text
            style={{
              color: theme.colors.text.onBrand,
              fontSize: body.size,
              fontFamily: body.family,
              fontWeight: '600',
            }}
          >
            Take a reading
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
