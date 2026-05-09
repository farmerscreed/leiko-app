// SettingsScreen — Sprint 10b.1.
//
// Sourced from docs/04-screens/settings.md (D8 §4.11 + D8a §10) — the
// new Settings hub. Sprint 10b.1 lands the foundation + three sections:
// Profile, Watch, About + Sign-out. Vital streams / Health Platform /
// AI quota / Notifications / Privacy land in 10b.2 and 10b.3.
//
// Voice rules (docs/05-voice-and-claims.md): every authored string is
// sentence-case, plain, never urgent. "Talk to your doctor" not
// "consult a healthcare provider", etc.
//
// Anti-pattern guards (CLAUDE.md):
//   • Cancellation is dignified — Forget watch sheet has no "are you
//     sure" guilt. Sign-out has the same posture.
//   • Hypertension chip is opt-in — three states including "Prefer not
//     to say"; default null leaves the field unset.

import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import { updateProfile } from '../../services/users/updateProfile';
import { useAuth } from '../../state/auth';
import { usePairing } from '../../state/pairing';
import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useTheme } from '../../theme';
import type { CaregiverScreenProps } from '../../navigation/types';
import type { HypertensionStatus } from '../../types/database';

// App version is embedded at build time. Bump in lockstep with
// app.json + package.json on every version commit. Showing "build" as
// the EAS build number lands when EAS builds are wired (Sprint 17).
const APP_VERSION = '0.0.0';

const HYPERTENSION_LABEL: Record<HypertensionStatus, string> = {
  yes: 'Yes',
  no: 'No',
  prefer_not_say: 'Prefer not to say',
};

type Props =
  | CaregiverScreenProps<'Settings'>
  | { navigation: { goBack: () => void; navigate: (route: string) => void } };

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const profile = useAuth((s) => s.profile);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const signOut = useAuth((s) => s.signOut);
  const pairedDevice = usePairing((s) => s.pairedDevice);
  const forget = usePairing((s) => s.forget);

  const [confirmingForget, setConfirmingForget] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [hypertensionSheetOpen, setHypertensionSheetOpen] = useState(false);
  const [hypertensionWriting, setHypertensionWriting] = useState(false);

  const isSelfBuyer = profile?.account_type === 'self_buyer';

  const handleForget = useCallback(async () => {
    await forget();
    setConfirmingForget(false);
  }, [forget]);

  const handleSignOut = useCallback(async () => {
    setConfirmingSignOut(false);
    await signOut();
  }, [signOut]);

  const handleHypertensionPick = useCallback(
    async (next: HypertensionStatus) => {
      if (!profile) return;
      setHypertensionWriting(true);
      try {
        await updateProfile(profile.id, { hypertension_status: next });
        await refreshProfile();
        setHypertensionSheetOpen(false);
      } finally {
        setHypertensionWriting(false);
      }
    },
    [profile, refreshProfile],
  );

  const lastSyncDisplay = useLastSyncDisplay(pairedDevice?.bleId ?? null);

  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="settings-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: theme.spacing.xxxl },
        ]}
      >
        {/* Header bar — Back + title */}
        <View
          style={{
            paddingHorizontal: theme.spacing.l,
            paddingTop: theme.spacing.l,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="settings-back"
            style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.l }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
              }}
            >
              Back
            </Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text.primary,
              fontSize: headlineStyle.size,
              lineHeight: headlineStyle.lineHeight,
              fontWeight: headlineStyle.weight as '700',
              fontFamily: headlineStyle.family,
            }}
          >
            Settings
          </Text>
        </View>

        {/* Profile ----------------------------------------------------- */}
        <SettingsSection title="Profile" first testID="settings-section-profile">
          <ListRow
            variant="data"
            title="Name"
            value={profile?.display_name ?? '—'}
            testID="settings-profile-name"
          />
          <ListRow
            variant="data"
            title="Photo"
            value={profile?.photo_url ? 'Set' : 'Not set'}
            testID="settings-profile-photo"
          />
          <ListRow
            variant="data"
            title="Timezone"
            value={profile?.timezone ?? '—'}
            testID="settings-profile-timezone"
          />
          <ListRow
            variant="data"
            title="Year of birth"
            value={profile?.year_of_birth ? String(profile.year_of_birth) : 'Not set'}
            testID="settings-profile-yob"
          />
          {isSelfBuyer ? (
            <ListRow
              variant="select"
              title="Diagnosed with hypertension?"
              value={
                profile?.hypertension_status
                  ? HYPERTENSION_LABEL[profile.hypertension_status]
                  : 'Not set'
              }
              onPress={() => setHypertensionSheetOpen(true)}
              showDivider={false}
              testID="settings-profile-hypertension"
            />
          ) : null}
        </SettingsSection>

        {/* Watch ------------------------------------------------------- */}
        <SettingsSection title="Watch" testID="settings-section-watch">
          {pairedDevice ? (
            <>
              <ListRow
                variant="data"
                title={pairedDevice.name ?? 'Leiko Watch'}
                subtitle={`Ending ${pairedDevice.macSuffix}`}
                value="Connected"
                testID="settings-watch-paired"
              />
              <ListRow
                variant="data"
                title="Last sync"
                value={lastSyncDisplay}
                testID="settings-watch-last-sync"
              />
              <ListRow
                variant="action"
                title="Pair another watch"
                onPress={() =>
                  (navigation as { navigate: (r: string) => void }).navigate('Pairing')
                }
                testID="settings-watch-pair-another"
              />
              <ListRow
                variant="action"
                title="Forget this watch"
                destructive
                onPress={() => setConfirmingForget(true)}
                showDivider={false}
                testID="settings-watch-forget"
              />
            </>
          ) : (
            <>
              <ListRow
                variant="data"
                title="No watch paired yet"
                subtitle="Pair a watch to start tracking readings."
                testID="settings-watch-empty"
              />
              <ListRow
                variant="action"
                title="Pair a watch"
                onPress={() =>
                  (navigation as { navigate: (r: string) => void }).navigate('Pairing')
                }
                showDivider={false}
                testID="settings-watch-pair-cta"
              />
            </>
          )}
        </SettingsSection>

        {/* About ------------------------------------------------------- */}
        <SettingsSection title="About" testID="settings-section-about">
          <ListRow
            variant="data"
            title="App version"
            value={APP_VERSION}
            testID="settings-about-version"
          />
          <ListRow
            variant="navigation"
            title="Terms of service"
            onPress={() => void Linking.openURL('https://leiko.app/terms')}
            testID="settings-about-terms"
          />
          <ListRow
            variant="navigation"
            title="Privacy policy"
            onPress={() => void Linking.openURL('https://leiko.app/privacy')}
            testID="settings-about-privacy"
          />
          <ListRow
            variant="action"
            title="Help"
            onPress={() => void Linking.openURL('mailto:support@leiko.app')}
            showDivider={false}
            testID="settings-about-help"
          />
        </SettingsSection>

        {/* Account ----------------------------------------------------- */}
        <SettingsSection title="Account" testID="settings-section-account">
          <ListRow
            variant="action"
            title="Sign out"
            destructive
            onPress={() => setConfirmingSignOut(true)}
            showDivider={false}
            testID="settings-account-signout"
          />
        </SettingsSection>
      </ScrollView>

      {/* Forget watch — preserved Sprint 5 sheet */}
      <BottomSheet
        visible={confirmingForget}
        onDismiss={() => setConfirmingForget(false)}
        size="compact"
        title="Forget this watch?"
        testID="settings-forget-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.xl,
            }}
          >
            The watch will stop syncing with this phone. Past readings stay safe.
          </Text>
          <Button
            variant="primary"
            onPress={() => void handleForget()}
            accessibilityLabel="Yes, forget this watch"
            testID="settings-forget-confirm"
          >
            Yes, forget
          </Button>
          <View style={{ marginTop: theme.spacing.s }}>
            <Button
              variant="ghost"
              onPress={() => setConfirmingForget(false)}
              accessibilityLabel="Keep paired"
              testID="settings-forget-cancel"
            >
              Keep paired
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Sign out — dignified, no guilt */}
      <BottomSheet
        visible={confirmingSignOut}
        onDismiss={() => setConfirmingSignOut(false)}
        size="compact"
        title="Sign out?"
        testID="settings-signout-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.xl,
            }}
          >
            You can sign back in any time. Your readings stay safe.
          </Text>
          <Button
            variant="primary"
            onPress={() => void handleSignOut()}
            accessibilityLabel="Yes, sign me out"
            testID="settings-signout-confirm"
          >
            Yes, sign me out
          </Button>
          <View style={{ marginTop: theme.spacing.s }}>
            <Button
              variant="ghost"
              onPress={() => setConfirmingSignOut(false)}
              accessibilityLabel="Stay signed in"
              testID="settings-signout-cancel"
            >
              Stay signed in
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Hypertension chip (D8a §10.1) — self-buyer only */}
      <BottomSheet
        visible={hypertensionSheetOpen}
        onDismiss={() => setHypertensionSheetOpen(false)}
        size="compact"
        title="Diagnosed with hypertension?"
        testID="settings-hypertension-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.l,
            }}
          >
            Sharing this is optional. We use it to add context to your trends.
          </Text>
          {(['yes', 'no', 'prefer_not_say'] as HypertensionStatus[]).map((value) => (
            <ListRow
              key={value}
              variant="select"
              title={HYPERTENSION_LABEL[value]}
              selected={profile?.hypertension_status === value}
              disabled={hypertensionWriting}
              onPress={() => void handleHypertensionPick(value)}
              testID={`settings-hypertension-${value}`}
            />
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------
// Helpers

function useLastSyncDisplay(bleId: string | null): string {
  if (!bleId) return '—';
  const raw = mmkv.getString(STORAGE_KEYS.lastSyncByDevice);
  if (!raw) return 'Not yet synced';
  try {
    const map = JSON.parse(raw) as Record<string, number>;
    const sec = map[bleId];
    if (!sec) return 'Not yet synced';
    const ms = sec * 1000;
    const minutesAgo = Math.floor((Date.now() - ms) / 60_000);
    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo < 60) return `${minutesAgo} min ago`;
    const hours = Math.floor(minutesAgo / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} d ago`;
  } catch {
    return '—';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
