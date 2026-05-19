// AcceptInviteSheet — Sprint 16.6 (Issue #1).
//
// Reusable bottom-sheet form for redeeming a 6-digit family-invite
// code. Extracted from the original inline implementation in
// SettingsScreen so it can also serve the caregiver Home empty-state
// CTA and the FamilyWatch onboarding "Someone invited me" path.
//
// Three consumers, three slightly different flows:
//   · Settings → shows the in-sheet success state ("You're in"); the
//     family auto-appears on Home via the realtime channel.
//   · CaregiverHome empty state → same success state, then the empty
//     state unmounts as soon as the family list refresh comes in.
//   · FamilyWatch onboarding → skips the in-sheet success state so the
//     caller can finalize onboarding atomically (familyId from invite
//     result + completeViaInvite).
// `showSuccessState` (default true) controls the in-sheet behaviour;
// `onSuccess` always fires with the resolved familyId so consumers
// can react regardless.
//
// State resets every time the sheet opens (visible: false → true) so a
// dismissed-but-not-completed previous attempt doesn't leak.

import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { acceptFamilyInvite } from '../services/families/manageInvites';
import { useTheme } from '../theme';

export interface AcceptInviteSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Pre-fills the email field. The signed-in user's email is the
   *  natural default for every consumer. */
  initialEmail?: string;
  /** Called after a successful invite acceptance with the resolved
   *  familyId. The consumer decides what happens next (close the
   *  sheet, navigate, finalize onboarding, etc.). */
  onSuccess?: (result: { familyId: string }) => void;
  /** When true (default), the sheet swaps to a "You're in" confirmation
   *  state on success and waits for the user to tap Done. When false,
   *  the sheet closes immediately on success and fires onSuccess —
   *  better for onboarding flows that want to finalize atomically. */
  showSuccessState?: boolean;
  testID?: string;
}

const SHEET_TITLE_IDLE = 'Join a family circle';
const SHEET_TITLE_SUCCESS = "You're in";

export function AcceptInviteSheet({
  visible,
  onDismiss,
  initialEmail = '',
  onSuccess,
  showSuccessState = true,
  testID = 'accept-invite-sheet',
}: AcceptInviteSheetProps) {
  const theme = useTheme();
  const bodyStyle = theme.type('bodyM');

  const [code, setCode] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset on open so a dismissed previous attempt doesn't leak.
  useEffect(() => {
    if (visible) {
      setCode('');
      setEmail(initialEmail);
      setPending(false);
      setError(null);
      setSuccess(false);
    }
  }, [visible, initialEmail]);

  const handleSubmit = async () => {
    setError(null);
    setPending(true);
    try {
      const result = await acceptFamilyInvite({
        code,
        email: email.trim(),
      });
      if (showSuccessState) {
        setSuccess(true);
      }
      onSuccess?.(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      setError(
        /invitation_not_found/i.test(msg)
          ? "We couldn't find that code. Double-check and try again."
          : /email_mismatch/i.test(msg)
            ? "That email doesn't match the invite."
            : /invitation_expired/i.test(msg)
              ? 'That code has expired. Ask for a new one.'
              : /invitation_already_accepted/i.test(msg)
                ? "You're already in this circle."
                : "We couldn't join the circle. Try again in a moment.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      size="default"
      surface="solid"
      title={success ? SHEET_TITLE_SUCCESS : SHEET_TITLE_IDLE}
      testID={testID}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.l,
          paddingBottom: theme.spacing.l,
        }}
      >
        {success ? (
          <>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: bodyStyle.size,
                lineHeight: bodyStyle.lineHeight,
                fontFamily: bodyStyle.family,
                marginBottom: theme.spacing.m,
              }}
            >
              You&apos;ve joined the circle. Their readings will appear on your
              home screen.
            </Text>
            <Button
              variant="primary"
              onPress={onDismiss}
              accessibilityLabel="Done"
              testID={`${testID}-done`}
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: bodyStyle.size,
                lineHeight: bodyStyle.lineHeight,
                fontFamily: bodyStyle.family,
                marginBottom: theme.spacing.m,
              }}
            >
              Type the email the inviter used and the 6-digit code they shared
              with you.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              placeholderTextColor={theme.colors.text.tertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radii.m,
                paddingHorizontal: theme.spacing.m,
                paddingVertical: theme.spacing.s,
                color: theme.colors.text.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                marginBottom: theme.spacing.m,
              }}
              testID={`${testID}-email-input`}
            />
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={theme.colors.text.tertiary}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radii.m,
                paddingHorizontal: theme.spacing.m,
                paddingVertical: theme.spacing.s,
                color: theme.colors.text.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                marginBottom: theme.spacing.m,
                letterSpacing: 4,
              }}
              testID={`${testID}-code-input`}
            />
            {error ? (
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.type('label').size,
                  fontFamily: theme.type('label').family,
                  marginBottom: theme.spacing.m,
                }}
                testID={`${testID}-error`}
              >
                {error}
              </Text>
            ) : null}
            <Button
              variant="primary"
              disabled={
                pending || code.length !== 6 || email.trim().length === 0
              }
              loading={pending}
              onPress={handleSubmit}
              accessibilityLabel="Join family circle"
              testID={`${testID}-join`}
            >
              Join family circle
            </Button>
            <View style={{ marginTop: theme.spacing.s }}>
              <Button
                variant="ghost"
                onPress={onDismiss}
                accessibilityLabel="Cancel"
                testID={`${testID}-cancel`}
              >
                Cancel
              </Button>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
