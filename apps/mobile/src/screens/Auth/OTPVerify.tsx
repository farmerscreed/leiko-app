// OTPVerify — 6-digit code entry. On success, useAuth.verifyOtp resolves
// and the auth listener flips status to 'authenticated'; the navigator
// re-evaluates and routes to the persona stack. We do NOT navigate
// imperatively here — the navigator owns route selection.
//
// On failure we surface a calm message and let the user retry. The
// "Resend code" affordance simply re-runs signInWithOtp / signUpWithOtp
// for the same email.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme';
import { useAuth } from '../../state/auth';
import type { AuthScreenProps } from '../../navigation/types';

const CODE_RE = /^\d{6}$/;

export function OTPVerifyScreen({ navigation, route }: AuthScreenProps<'OTPVerify'>) {
  const { email, mode } = route.params;
  const theme = useTheme();
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const signUpWithOtp = useAuth((s) => s.signUpWithOtp);
  const signInWithOtp = useAuth((s) => s.signInWithOtp);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const valid = CODE_RE.test(code);

  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  const label = theme.type('label');

  const handleVerify = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await verifyOtp(email, code);
      // Navigator will reroute on the auth-state change. No explicit
      // navigate() here.
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('Token')
          ? "That code didn't work. Check the email and try again."
          : "We couldn't verify the code. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signup') await signUpWithOtp(email);
      else await signInWithOtp(email);
      setInfo('We sent another code.');
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't resend. Try again in a minute.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingHorizontal: theme.spacing.xxl,
              paddingTop: theme.spacing.xxl,
              paddingBottom: theme.spacing.xxl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.xxl }}
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
              marginBottom: theme.spacing.s,
            }}
          >
            Check your email
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
            We sent a 6-digit code to{' '}
            <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>{email}</Text>.
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
            6-digit code
          </Text>

          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^\d]/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            returnKeyType="go"
            onSubmitEditing={handleVerify}
            maxLength={6}
            accessibilityLabel="6-digit code"
            testID="otp-code"
            style={{
              backgroundColor: theme.colors.surface.elevated,
              borderRadius: theme.radii.m,
              paddingHorizontal: theme.spacing.l,
              paddingVertical: theme.spacing.m,
              fontSize: 28,
              letterSpacing: 4,
              fontFamily: theme.fontFamily.numeric,
              color: theme.colors.text.primary,
              borderWidth: 1,
              borderColor: error ? theme.colors.state.urgent : theme.colors.border.default,
              minHeight: theme.minTapTarget,
              textAlign: 'center',
            }}
          />

          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.state.urgent,
                fontSize: label.size,
                fontFamily: label.family,
                marginTop: theme.spacing.s,
              }}
            >
              {error}
            </Text>
          ) : null}
          {info ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.text.secondary,
                fontSize: label.size,
                fontFamily: label.family,
                marginTop: theme.spacing.s,
              }}
            >
              {info}
            </Text>
          ) : null}

          <View style={{ height: theme.spacing.xxxl }} />

          <Button
            variant="primary"
            onPress={handleVerify}
            disabled={!valid}
            loading={submitting}
            testID="otp-submit"
            style={{ width: '100%' }}
          >
            Verify
          </Button>

          <View style={{ height: theme.spacing.l }} />

          <Pressable
            onPress={handleResend}
            disabled={resending}
            accessibilityRole="button"
            accessibilityLabel="Resend code"
            testID="otp-resend"
            hitSlop={theme.spacing.s}
            style={{ paddingVertical: theme.spacing.s, alignItems: 'center' }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: body.size,
                fontFamily: body.family,
                opacity: resending ? theme.opacity.disabled : 1,
              }}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
});
