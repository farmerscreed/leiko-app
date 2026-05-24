// AccountSwitchScreen — Sprint 19 Block 4.
//
// Lists every email that has successfully signed in on this device.
// Tap a non-current row → sign out current + OTP-in selected.
// Tap "Sign in with a different email" → routes back to the auth
// fork. "Forget this account" per non-current row removes it from
// MMKV (does NOT touch the server).
//
// Current account gets a "signed in" badge + a Delete-account button
// (surfaces the existing soft-delete flow with a typed-confirm).
//
// Voice rules: every authored string here is calm + plain.
// "Switch account" / "Forget this account" / "Delete account" /
// "Type DELETE to confirm" are descriptive, no fear language.

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import { navigationRef } from '../../navigation/navigationRef';
import { useAuth } from '../../state/auth';
import { useKnownAccounts } from '../../state/knownAccounts';
import { deleteAccount } from '../../services/users/accountActions';
import { useTheme } from '../../theme';

function formatLastSignedIn(ms: number, nowMs: number = Date.now()): string {
  const ageMs = Math.max(0, nowMs - ms);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

type SheetMode =
  | { kind: 'idle' }
  | { kind: 'forget'; email: string }
  | { kind: 'delete' }
  | { kind: 'switch'; email: string };

export function AccountSwitchScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const profile = useAuth((s) => s.profile);
  const status = useAuth((s) => s.status);
  const signOut = useAuth((s) => s.signOut);
  const signInWithOtp = useAuth((s) => s.signInWithOtp);
  const accounts = useKnownAccounts((s) => s.accounts);
  const forget = useKnownAccounts((s) => s.forget);

  const [sheet, setSheet] = useState<SheetMode>({ kind: 'idle' });
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const currentEmail = profile?.email ?? null;

  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  const caption = theme.type('caption');
  const label = theme.type('label');

  const closeSheet = () => {
    if (pending) return;
    setSheet({ kind: 'idle' });
    setConfirmText('');
    setActionError(null);
  };

  // Sprint 19 Block 9 — route the AuthStack to the right screen
  // post-signOut. Pre-Block-9 we tried to navigate via the local
  // CaregiverStack ref AFTER signOut had already unmounted it, which
  // silently no-op'd. The user landed on AccountTypeFork with no
  // signal that an OTP was already in their inbox.
  //
  // The fix: use the root `navigationRef` (attached to
  // NavigationContainer). After the RootNavigator re-renders the
  // AuthStack, the next macrotask tick has a mounted AuthStack we
  // can reset into. yield via setTimeout(0) so React commits the
  // stack swap before we dispatch.
  const resetAuthTo = (target: 'OTPVerify' | 'SignIn', otpEmail?: string) => {
    setTimeout(() => {
      if (!navigationRef.isReady()) return;
      const routes: Array<{ name: string; params?: Record<string, unknown> }> =
        target === 'OTPVerify' && otpEmail
          ? [
              { name: 'AccountTypeFork' },
              { name: 'OTPVerify', params: { email: otpEmail, mode: 'signin' } },
            ]
          : target === 'SignIn'
            ? [{ name: 'AccountTypeFork' }, { name: 'SignIn' }]
            : [{ name: 'AccountTypeFork' }];
      (navigationRef as unknown as {
        dispatch: (action: unknown) => void;
      }).dispatch(
        CommonActions.reset({ index: routes.length - 1, routes }),
      );
    }, 0);
  };

  const confirmSwitch = async () => {
    if (sheet.kind !== 'switch' || pending) return;
    setPending(true);
    setActionError(null);
    const email = sheet.email;
    try {
      await signOut();
      await signInWithOtp(email);
      // Land the user on OTPVerify with their email + signin mode so
      // the next thing they see is the code-entry screen, not a fork
      // they have to navigate themselves.
      setPending(false);
      closeSheet();
      resetAuthTo('OTPVerify', email);
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : "We couldn't start sign-in for that email. Try again.",
      );
      setPending(false);
    }
  };

  const confirmForget = () => {
    if (sheet.kind !== 'forget') return;
    forget(sheet.email);
    closeSheet();
  };

  const confirmDelete = async () => {
    if (sheet.kind !== 'delete' || !currentEmail || pending) return;
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setActionError('Type DELETE in the box above to confirm.');
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      await deleteAccount(currentEmail);
      // After server confirms, sign out + drop from known list.
      await signOut();
      forget(currentEmail);
      setPending(false);
      closeSheet();
      resetAuthTo('SignIn');
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : "We couldn't delete your account. Please try again.",
      );
      setPending(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="account-switch-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.m }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="account-switch-back"
            style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.xxl }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: body.size,
                fontFamily: body.family,
                fontWeight: '500',
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
              letterSpacing: -0.6,
              marginBottom: theme.spacing.s,
            }}
          >
            Switch account
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              fontFamily: body.family,
              marginBottom: theme.spacing.l,
            }}
          >
            Tap an account to sign in, or sign in with a new email.
          </Text>
        </View>

        {currentEmail ? (
          <SettingsSection title="Signed in" first testID="account-switch-current">
            <ListRow
              variant="data"
              title={currentEmail}
              subtitle={status === 'authenticated' ? 'Signed in on this device.' : 'Hydrating…'}
              showDivider
              testID="account-switch-current-row"
            />
            <ListRow
              variant="action"
              title="Delete account"
              subtitle="Removes your data from our servers."
              showDivider={false}
              onPress={() => {
                setConfirmText('');
                setActionError(null);
                setSheet({ kind: 'delete' });
              }}
              testID="account-switch-delete"
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title="On this device" testID="account-switch-known">
          {accounts.length === 0 ? (
            <Text
              style={{
                color: theme.colors.text.tertiary,
                fontSize: caption.size,
                fontFamily: caption.family,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.l,
              }}
              testID="account-switch-empty"
            >
              No other accounts saved on this device yet.
            </Text>
          ) : (
            accounts
              .filter((a) => a.email !== currentEmail?.toLowerCase())
              .map((a, idx, arr) => (
                <ListRow
                  key={a.email}
                  variant="navigation"
                  title={a.email}
                  subtitle={`Last signed in ${formatLastSignedIn(a.lastSignedInAtMs)}`}
                  showDivider={idx !== arr.length - 1}
                  onPress={() => {
                    setActionError(null);
                    setSheet({ kind: 'switch', email: a.email });
                  }}
                  testID={`account-switch-row-${a.email}`}
                />
              ))
          )}
        </SettingsSection>

        {accounts.length > 0 ? (
          <SettingsSection title="Manage" testID="account-switch-manage">
            {accounts
              .filter((a) => a.email !== currentEmail?.toLowerCase())
              .map((a, idx, arr) => (
                <ListRow
                  key={`forget-${a.email}`}
                  variant="action"
                  title={`Forget ${a.email}`}
                  subtitle="Remove from this device. Your data stays on our servers."
                  showDivider={idx !== arr.length - 1}
                  onPress={() => {
                    setActionError(null);
                    setSheet({ kind: 'forget', email: a.email });
                  }}
                  testID={`account-switch-forget-${a.email}`}
                />
              ))}
          </SettingsSection>
        ) : null}

        <View
          style={{ paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.l }}
        >
          <Button
            variant="primary"
            onPress={() => {
              // Sign out + drop the user on SignIn so they can type
              // a new email + receive an OTP. Pre-Block-9 this just
              // signed out + landed on AccountTypeFork.
              void (async () => {
                try {
                  await signOut();
                  resetAuthTo('SignIn');
                } catch {
                  // ignore; signOut errors surface via auth state
                }
              })();
            }}
            testID="account-switch-new"
            style={{ width: '100%' }}
          >
            Sign in with a different email
          </Button>
        </View>
      </ScrollView>

      {/* Switch confirm */}
      <BottomSheet
        visible={sheet.kind === 'switch'}
        onDismiss={closeSheet}
        size="compact"
        surface="solid"
        title="Switch to this account?"
        testID="account-switch-confirm-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              fontFamily: body.family,
              marginBottom: theme.spacing.l,
            }}
          >
            We'll sign you out and send a 6-digit code to{' '}
            <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
              {sheet.kind === 'switch' ? sheet.email : ''}
            </Text>
            .
          </Text>
          {actionError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.state.urgent,
                fontSize: body.size,
                fontFamily: body.family,
                marginBottom: theme.spacing.m,
              }}
            >
              {actionError}
            </Text>
          ) : null}
          <Button
            variant="primary"
            onPress={() => {
              void confirmSwitch();
            }}
            disabled={pending}
            testID="account-switch-confirm"
            style={{ width: '100%', marginBottom: theme.spacing.s }}
          >
            {pending ? 'Switching…' : 'Switch account'}
          </Button>
          <Button
            variant="secondary"
            onPress={closeSheet}
            disabled={pending}
            testID="account-switch-cancel"
            style={{ width: '100%' }}
          >
            Cancel
          </Button>
        </View>
      </BottomSheet>

      {/* Forget confirm */}
      <BottomSheet
        visible={sheet.kind === 'forget'}
        onDismiss={closeSheet}
        size="compact"
        surface="solid"
        title="Forget this account?"
        testID="account-switch-forget-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              fontFamily: body.family,
              marginBottom: theme.spacing.l,
            }}
          >
            Removes{' '}
            <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
              {sheet.kind === 'forget' ? sheet.email : ''}
            </Text>{' '}
            from this device. Your data stays on our servers and signing in again brings it back.
          </Text>
          <Button
            variant="primary"
            onPress={confirmForget}
            testID="account-switch-forget-confirm"
            style={{ width: '100%', marginBottom: theme.spacing.s }}
          >
            Forget
          </Button>
          <Button
            variant="secondary"
            onPress={closeSheet}
            testID="account-switch-forget-cancel"
            style={{ width: '100%' }}
          >
            Cancel
          </Button>
        </View>
      </BottomSheet>

      {/* Delete confirm */}
      <BottomSheet
        visible={sheet.kind === 'delete'}
        onDismiss={closeSheet}
        size="tall"
        surface="solid"
        title="Delete this account?"
        testID="account-switch-delete-sheet"
      >
        <View style={{ paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: body.size,
              fontFamily: body.family,
              marginBottom: theme.spacing.l,
            }}
          >
            This will remove your account and your data from our servers. You won't be able to sign in with{' '}
            <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
              {currentEmail ?? ''}
            </Text>{' '}
            again.
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: label.size,
              fontWeight: label.weight as '500',
              fontFamily: label.family,
              marginBottom: theme.spacing.s,
            }}
          >
            Type DELETE to confirm
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            placeholderTextColor={theme.colors.text.secondary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm"
            testID="account-switch-delete-input"
            style={{
              backgroundColor: theme.colors.surface.elevated,
              borderRadius: theme.radii.m,
              paddingHorizontal: theme.spacing.l,
              paddingVertical: theme.spacing.m,
              fontSize: body.size,
              fontFamily: body.family,
              color: theme.colors.text.primary,
              borderWidth: 1,
              borderColor: theme.colors.border.default,
              minHeight: theme.minTapTarget,
              marginBottom: theme.spacing.l,
            }}
          />
          {actionError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.state.urgent,
                fontSize: body.size,
                fontFamily: body.family,
                marginBottom: theme.spacing.m,
              }}
            >
              {actionError}
            </Text>
          ) : null}
          <Button
            variant="primary"
            onPress={() => {
              void confirmDelete();
            }}
            disabled={pending}
            testID="account-switch-delete-confirm"
            style={{ width: '100%', marginBottom: theme.spacing.s }}
          >
            {pending ? 'Deleting…' : 'Delete account'}
          </Button>
          <Button
            variant="secondary"
            onPress={closeSheet}
            disabled={pending}
            testID="account-switch-delete-cancel"
            style={{ width: '100%' }}
          >
            Cancel
          </Button>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});

export { formatLastSignedIn };
