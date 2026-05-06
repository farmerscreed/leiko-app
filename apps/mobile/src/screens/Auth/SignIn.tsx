// SignIn — for returning users. Same shape as SignUp but doesn't pass
// account_type metadata: the user's row already exists in public.users
// with their immutable choice baked in. shouldCreateUser=false guards
// against accidental account creation if a typo'd email doesn't match
// any existing user.

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen({ navigation }: AuthScreenProps<'SignIn'>) {
  const theme = useTheme();
  const signInWithOtp = useAuth((s) => s.signInWithOtp);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim();
  const valid = EMAIL_RE.test(trimmed);

  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  const label = theme.type('label');

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithOtp(trimmed);
      navigation.navigate('OTPVerify', { email: trimmed, mode: 'signin' });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't send your code. Try again.");
    } finally {
      setSubmitting(false);
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
            Welcome back
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
            Sign in with the email you used last time. We'll send a 6-digit code.
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
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.text.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            accessibilityLabel="Email address"
            testID="signin-email"
            style={{
              backgroundColor: theme.colors.surface.elevated,
              borderRadius: theme.radii.m,
              paddingHorizontal: theme.spacing.l,
              paddingVertical: theme.spacing.m,
              fontSize: body.size,
              fontFamily: body.family,
              color: theme.colors.text.primary,
              borderWidth: 1,
              borderColor: error ? theme.colors.state.urgent : theme.colors.border.default,
              minHeight: theme.minTapTarget,
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

          <View style={{ height: theme.spacing.xxxl }} />

          <Button
            variant="primary"
            onPress={handleSubmit}
            disabled={!valid}
            loading={submitting}
            testID="signin-submit"
            style={{ width: '100%' }}
          >
            Send code
          </Button>
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
