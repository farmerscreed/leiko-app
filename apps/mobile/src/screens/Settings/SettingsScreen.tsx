// SettingsScreen — Sprint 10b.1 + 10b.2.
//
// Sourced from docs/04-screens/settings.md (D8 §4.11 + D8a §10) — the
// new Settings hub. Sprint 10b.1 landed the foundation + Profile +
// Watch + About + Sign-out. Sprint 10b.2 adds Vital streams + Goals +
// Apple Health / Health Connect + AI. Notifications + Privacy land
// in 10b.3.
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

import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import { updateProfile } from '../../services/users/updateProfile';
import { useAuth } from '../../state/auth';
import { usePairing } from '../../state/pairing';
import {
  SLEEP_TARGET_MAX,
  SLEEP_TARGET_MIN,
  SLEEP_TARGET_STEP,
  STEPS_TARGET_MAX,
  STEPS_TARGET_MIN,
  STEPS_TARGET_STEP,
  useVitalSetup,
} from '../../state/vitalSetup';
import { useHealthPlatformToggles } from '../../services/health-platform/toggles';
import {
  ALL_READ_KINDS,
  ALL_WRITE_KINDS,
  type ReadVitalKind,
  type WriteVitalKind,
} from '../../services/health-platform/types';
import {
  getQuotaSnapshot,
  reconcileFromAuditLog,
} from '../../services/ai/quotaCounter';
import { usePlusEntitlement } from '../../hooks/usePlusEntitlement';
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

const WRITE_VITAL_LABEL: Record<WriteVitalKind, string> = {
  bp: 'Blood pressure',
  hr: 'Heart rate',
  spo2: 'Oxygen',
  sleep: 'Sleep',
  steps: 'Steps',
  calories: 'Calories',
};

const READ_VITAL_LABEL: Record<ReadVitalKind, string> = {
  weight: 'Weight',
  height: 'Height',
  blood_glucose: 'Blood glucose',
};

function formatSleepTarget(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatStepsTarget(value: number): string {
  return `${value.toLocaleString('en-US')} steps`;
}

function buildStepsOptions(): number[] {
  const out: number[] = [];
  for (let v = STEPS_TARGET_MIN; v <= STEPS_TARGET_MAX; v += STEPS_TARGET_STEP) {
    out.push(v);
  }
  return out;
}

function buildSleepOptions(): number[] {
  const out: number[] = [];
  for (let v = SLEEP_TARGET_MIN; v <= SLEEP_TARGET_MAX; v += SLEEP_TARGET_STEP) {
    out.push(v);
  }
  return out;
}

const STEPS_OPTIONS = buildStepsOptions();
const SLEEP_OPTIONS = buildSleepOptions();

type Props =
  | CaregiverScreenProps<'Settings'>
  | { navigation: { goBack: () => void; navigate: (route: string) => void } };

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.session?.user.id ?? null);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const signOut = useAuth((s) => s.signOut);
  const pairedDevice = usePairing((s) => s.pairedDevice);
  const forget = usePairing((s) => s.forget);

  // Vital setup (auto-HR / auto-SpO2 / goals).
  const autoHrEnabled = useVitalSetup((s) => s.autoHrEnabled);
  const autoSpo2Enabled = useVitalSetup((s) => s.autoSpo2Enabled);
  const stepsTarget = useVitalSetup((s) => s.stepsTarget);
  const sleepTargetMin = useVitalSetup((s) => s.sleepTargetMin);
  const setAutoHr = useVitalSetup((s) => s.setAutoHr);
  const setAutoSpo2 = useVitalSetup((s) => s.setAutoSpo2);
  const setStepsTarget = useVitalSetup((s) => s.setStepsTarget);
  const setSleepTargetMin = useVitalSetup((s) => s.setSleepTargetMin);

  // Health Platform toggles.
  const hpMaster = useHealthPlatformToggles((s) => s.master);
  const hpWrite = useHealthPlatformToggles((s) => s.perVitalWrite);
  const hpRead = useHealthPlatformToggles((s) => s.perVitalRead);
  const setHpMaster = useHealthPlatformToggles((s) => s.setMaster);
  const setHpWrite = useHealthPlatformToggles((s) => s.setWriteVital);
  const setHpRead = useHealthPlatformToggles((s) => s.setReadVital);

  // AI quota — read snapshot synchronously from MMKV cache; reconcile
  // against audit_log on mount so the surface is fresh.
  const { tier } = usePlusEntitlement();
  const [quota, setQuota] = useState(() =>
    userId ? getQuotaSnapshot(userId, tier) : null,
  );
  useEffect(() => {
    if (!userId) {
      setQuota(null);
      return;
    }
    setQuota(getQuotaSnapshot(userId, tier));
    // Best-effort reconcile — failures leave the cached value in place.
    void reconcileFromAuditLog(userId).then(() => {
      setQuota(getQuotaSnapshot(userId, tier));
    }).catch(() => undefined);
  }, [userId, tier]);

  const [confirmingForget, setConfirmingForget] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [hypertensionSheetOpen, setHypertensionSheetOpen] = useState(false);
  const [hypertensionWriting, setHypertensionWriting] = useState(false);
  const [picker, setPicker] = useState<'steps' | 'sleep' | null>(null);

  const isSelfBuyer = profile?.account_type === 'self_buyer';
  // Caregivers do not write OR read external vitals (D13 §12.5 + §12.6).
  // The Apple Health / Health Connect section is therefore self-buyer
  // only. Parent (own phone) reuses the same surface; self-buyer is the
  // primary case in this codebase.
  const showHealthPlatform = profile?.account_type !== 'caregiver';

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

        {/* Vital streams ---------------------------------------------- */}
        <SettingsSection title="Vital streams" testID="settings-section-vitals">
          <ListRow
            variant="toggle"
            title="Auto heart rate"
            subtitle="Watch samples your heart rate automatically through the day."
            switchValue={autoHrEnabled}
            onSwitchChange={setAutoHr}
            testID="settings-vitals-auto-hr"
          />
          <ListRow
            variant="toggle"
            title="Auto oxygen"
            subtitle="Watch samples your oxygen overnight. Off by default to save battery."
            switchValue={autoSpo2Enabled}
            onSwitchChange={setAutoSpo2}
            showDivider={false}
            testID="settings-vitals-auto-spo2"
          />
        </SettingsSection>

        {/* Goals ------------------------------------------------------- */}
        <SettingsSection title="Goals" testID="settings-section-goals">
          <ListRow
            variant="navigation"
            title="Steps target"
            value={formatStepsTarget(stepsTarget)}
            onPress={() => setPicker('steps')}
            testID="settings-goals-steps"
          />
          <ListRow
            variant="navigation"
            title="Sleep target"
            value={formatSleepTarget(sleepTargetMin)}
            onPress={() => setPicker('sleep')}
            showDivider={false}
            testID="settings-goals-sleep"
          />
        </SettingsSection>

        {/* Apple Health / Health Connect ------------------------------ */}
        {showHealthPlatform ? (
          <SettingsSection
            title="Apple Health & Health Connect"
            testID="settings-section-health-platform"
          >
            <ListRow
              variant="toggle"
              title="Connect to your phone's health app"
              subtitle="Keeps your numbers in one place across apps."
              switchValue={hpMaster}
              onSwitchChange={setHpMaster}
              showDivider={hpMaster}
              testID="settings-hp-master"
            />
            {hpMaster ? (
              <>
                {ALL_WRITE_KINDS.map((kind) => (
                  <ListRow
                    key={`write-${kind}`}
                    variant="toggle"
                    title={`Share ${WRITE_VITAL_LABEL[kind].toLowerCase()}`}
                    switchValue={hpWrite[kind] ?? false}
                    onSwitchChange={(v) => setHpWrite(kind, v)}
                    testID={`settings-hp-write-${kind}`}
                  />
                ))}
                {ALL_READ_KINDS.map((kind, idx) => (
                  <ListRow
                    key={`read-${kind}`}
                    variant="toggle"
                    title={`Read ${READ_VITAL_LABEL[kind].toLowerCase()}`}
                    switchValue={hpRead[kind] ?? false}
                    onSwitchChange={(v) => setHpRead(kind, v)}
                    showDivider={idx !== ALL_READ_KINDS.length - 1}
                    testID={`settings-hp-read-${kind}`}
                  />
                ))}
              </>
            ) : null}
          </SettingsSection>
        ) : null}

        {/* AI ---------------------------------------------------------- */}
        <SettingsSection title="AI" testID="settings-section-ai">
          <ListRow
            variant="data"
            title="Questions this month"
            subtitle="Resets on the 1st."
            value={
              quota
                ? `${quota.count} of ${quota.limit}`
                : '— of —'
            }
            testID="settings-ai-quota"
          />
          <ListRow
            variant="data"
            title="Your tier"
            value={tier === 'free' || tier === 'past_due' ? 'Free' : 'Plus'}
            subtitle={
              tier === 'free' || tier === 'past_due'
                ? 'Free includes 5 questions a month. Plus brings 100 plus weekly summaries.'
                : 'Plus brings 100 questions a month, weekly summaries, and a doctor-ready PDF.'
            }
            showDivider={false}
            testID="settings-ai-tier"
          />
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

      {/* Steps target picker */}
      <BottomSheet
        visible={picker === 'steps'}
        onDismiss={() => setPicker(null)}
        size="tall"
        title="Daily steps target"
        testID="settings-steps-sheet"
      >
        <ScrollView>
          {STEPS_OPTIONS.map((value, idx) => (
            <ListRow
              key={value}
              variant="select"
              title={formatStepsTarget(value)}
              selected={stepsTarget === value}
              onPress={() => {
                setStepsTarget(value);
                setPicker(null);
              }}
              showDivider={idx !== STEPS_OPTIONS.length - 1}
              testID={`settings-steps-option-${value}`}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Sleep target picker */}
      <BottomSheet
        visible={picker === 'sleep'}
        onDismiss={() => setPicker(null)}
        size="tall"
        title="Sleep target"
        testID="settings-sleep-sheet"
      >
        <ScrollView>
          {SLEEP_OPTIONS.map((value, idx) => (
            <ListRow
              key={value}
              variant="select"
              title={formatSleepTarget(value)}
              selected={sleepTargetMin === value}
              onPress={() => {
                setSleepTargetMin(value);
                setPicker(null);
              }}
              showDivider={idx !== SLEEP_OPTIONS.length - 1}
              testID={`settings-sleep-option-${value}`}
            />
          ))}
        </ScrollView>
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
