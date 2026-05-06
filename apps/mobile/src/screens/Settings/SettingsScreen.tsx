// SettingsScreen — Sprint 5.
//
// Lists the paired watch (or empty state) and exposes Forget. Tapping
// Forget opens a confirmation BottomSheet. Forget removes the device
// from MMKV; Sprint 6 will mirror that to Supabase via devices.unpaired_at.
//
// Per docs/04-screens/watch-pairing.md "Settings screens: paired
// devices, forget device, re-pair". This is the sprint-5 minimum;
// fuller Settings (notifications, language, account) lands in Sprint 10.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme';
import { usePairing } from '../../state/pairing';
import type { CaregiverScreenProps } from '../../navigation/types';

type Props =
  | CaregiverScreenProps<'Settings'>
  | { navigation: { goBack: () => void; navigate: (route: string) => void } };

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const pairedDevice = usePairing((s) => s.pairedDevice);
  const forget = usePairing((s) => s.forget);
  const [confirmingForget, setConfirmingForget] = useState(false);

  const headline = theme.type('displayM');
  const title = theme.type('title');
  const body = theme.type('bodyL');
  const label = theme.type('label');

  const handleForget = async () => {
    await forget();
    setConfirmingForget(false);
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
      testID="settings-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: theme.spacing.xxl,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.xxxl,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          testID="settings-back"
          style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.xl }}
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
            marginBottom: theme.spacing.xl,
          }}
        >
          Settings
        </Text>

        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: label.size,
            fontFamily: label.family,
            marginBottom: theme.spacing.s,
          }}
        >
          Watch
        </Text>

        {pairedDevice ? (
          <Card
            elevation="low"
            style={{ marginBottom: theme.spacing.l }}
            testID="settings-paired-card"
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
              {pairedDevice.name ?? 'Leiko Watch'}
            </Text>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: body.size,
                fontFamily: body.family,
                marginBottom: theme.spacing.l,
              }}
            >
              Ending {pairedDevice.macSuffix}
            </Text>
            <Button
              variant="ghost"
              onPress={() => setConfirmingForget(true)}
              accessibilityLabel="Forget this watch"
              testID="settings-forget"
            >
              Forget this watch
            </Button>
          </Card>
        ) : (
          <Card
            elevation="low"
            style={{ marginBottom: theme.spacing.l }}
            testID="settings-empty-card"
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
              No watch paired yet
            </Text>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: body.size,
                fontFamily: body.family,
                marginBottom: theme.spacing.l,
              }}
            >
              Pair a watch to start tracking readings.
            </Text>
            <Button
              variant="primary"
              onPress={() =>
                (navigation as { navigate: (r: string) => void }).navigate(
                  'Pairing',
                )
              }
              accessibilityLabel="Pair a watch"
              testID="settings-pair-cta"
            >
              Pair a watch
            </Button>
          </Card>
        )}

        {pairedDevice ? (
          <View style={{ marginTop: theme.spacing.s }}>
            <Button
              variant="secondary"
              onPress={() =>
                (navigation as { navigate: (r: string) => void }).navigate(
                  'Pairing',
                )
              }
              accessibilityLabel="Pair another watch"
              testID="settings-pair-another"
            >
              Pair another watch
            </Button>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={confirmingForget}
        onDismiss={() => setConfirmingForget(false)}
        size="compact"
        title="Forget this watch?"
        testID="settings-forget-sheet"
      >
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: body.size,
            lineHeight: body.lineHeight,
            fontFamily: body.family,
            marginBottom: theme.spacing.xl,
          }}
        >
          The watch will stop syncing with this phone. Past readings stay safe.
        </Text>
        <Button
          variant="primary"
          onPress={() => void handleForget()}
          accessibilityLabel="Yes, forget"
          testID="settings-forget-confirm"
          style={{ marginBottom: theme.spacing.s }}
        >
          Yes, forget
        </Button>
        <Button
          variant="ghost"
          onPress={() => setConfirmingForget(false)}
          accessibilityLabel="Keep paired"
          testID="settings-forget-cancel"
        >
          Keep paired
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
