// AskLeikoScreen — Sprint 11 task 10.
//
// Minimal "Ask Leiko" surface: single TextInput + Send button +
// response display. Sprint 11 ships the local Tier-A router behind
// it; Sprint 12 layers Tier-B (LiteLLM/Haiku) over the placeholder
// fallthrough.
//
// Single-shot, not a chat thread — multi-turn history is Sprint 12+
// territory. The screen surfaces ANSWER / EDUCATE / DEFER + the
// Tier-B placeholder cleanly without trying to be more than that.
//
// Sourced from:
//   plans/sprint-11-ai-tier-a.md (deliverables list)
//   docs/_reference/D14-ambient-ai-architecture.md §9 (conversational surface)

import {
  ActivityIndicator,
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
import { useState } from 'react';
import { useTheme } from '../../theme';
import { AIResponseRenderer } from '../../components/AIResponseRenderer';
import { classifyIntent } from '../../services/ai/intentRouter';
import { askTierB, type TierBDeferTrigger } from '../../services/ai/tierB';
import { DEFER_TEMPLATES } from '../../services/ai/deferTemplates';
import type { IntentMatch } from '../../services/ai/types';
import type { CaregiverScreenProps, SelfBuyerScreenProps } from '../../navigation/types';

// Voice-clean copy for Tier-B states. Every string passes the voice
// rules — no fear language, no exclamation points, no clinical
// authority claims.
const TIER_B_COPY = {
  loading: 'Thinking…',
  error: "I couldn't reach Leiko right now. Try again in a moment.",
  quotaExceeded:
    "You've used your AI questions for this month. They reset on the 1st.",
} as const;

type TierBState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; body: string }
  | { kind: 'defer'; trigger: TierBDeferTrigger }
  | { kind: 'quota_exceeded' }
  | { kind: 'error' };

type AskLeikoNavigation =
  | CaregiverScreenProps<'AskLeiko'>
  | SelfBuyerScreenProps<'AskLeiko'>
  | {
      navigation: {
        goBack: () => void;
        navigate: (screen: string, params?: unknown) => void;
      };
    };

export function AskLeikoScreen({ navigation }: AskLeikoNavigation) {
  const theme = useTheme();
  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');
  const captionStyle = theme.type('caption');

  const nav = navigation as {
    goBack: () => void;
    navigate: (screen: string, params?: unknown) => void;
  };

  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState<{
    text: string;
    result: IntentMatch;
  } | null>(null);
  const [tierBState, setTierBState] = useState<TierBState>({ kind: 'idle' });

  const onSubmit = () => {
    const trimmed = question.trim();
    if (trimmed.length === 0) return;
    const result = classifyIntent(trimmed);
    setSubmitted({ text: trimmed, result });
    setQuestion('');

    if (result.responseMode === 'TIER_B_PLACEHOLDER') {
      setTierBState({ kind: 'loading' });
      void askTierB({ question: trimmed }).then((r) => {
        switch (r.status) {
          case 'ok':
            setTierBState({ kind: 'ok', body: r.body });
            break;
          case 'defer':
            setTierBState({ kind: 'defer', trigger: r.trigger });
            break;
          case 'quota_exceeded':
            setTierBState({ kind: 'quota_exceeded' });
            break;
          case 'error':
            setTierBState({ kind: 'error' });
            break;
        }
      });
    } else {
      setTierBState({ kind: 'idle' });
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="ask-leiko-screen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => nav.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="ask-leiko-back"
            style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.xxl }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
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
              fontSize: headlineStyle.size,
              lineHeight: headlineStyle.lineHeight,
              fontFamily: headlineStyle.family,
              fontWeight: headlineStyle.weight as '700',
              letterSpacing: -0.6,
              marginBottom: theme.spacing.s,
            }}
          >
            Ask Leiko
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              lineHeight: bodyStyle.lineHeight,
              marginBottom: theme.spacing.xxl,
            }}
          >
            A short, plain-language question works best.
          </Text>

          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="What is blood pressure?"
            placeholderTextColor={theme.colors.text.tertiary}
            multiline
            accessibilityLabel="Type your question"
            testID="ask-leiko-input"
            style={{
              minHeight: 64,
              backgroundColor: theme.colors.surface.warmElevated,
              borderTopColor: theme.colors.border.rim,
              borderTopWidth: 1,
              borderRadius: theme.radii.l,
              padding: theme.spacing.l,
              color: theme.colors.text.primary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              lineHeight: bodyStyle.lineHeight,
              marginBottom: theme.spacing.l,
            }}
          />

          <Pressable
            onPress={onSubmit}
            disabled={question.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Send question"
            testID="ask-leiko-send"
            style={({ pressed }) => ({
              backgroundColor:
                question.trim().length === 0
                  ? theme.colors.surface.warmSubtle
                  : theme.colors.brand.primary,
              borderRadius: theme.radii.l,
              paddingVertical: theme.spacing.m,
              alignItems: 'center',
              opacity: pressed ? 0.92 : 1,
              marginBottom: theme.spacing.xxxl,
            })}
          >
            <Text
              style={{
                color:
                  question.trim().length === 0
                    ? theme.colors.text.tertiary
                    : theme.colors.text.onBrand,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                fontWeight: '500',
              }}
            >
              Send
            </Text>
          </Pressable>

          {submitted ? (
            <View testID="ask-leiko-result">
              <Text
                allowFontScaling={false}
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: captionStyle.size,
                  fontFamily: captionStyle.family,
                  marginBottom: theme.spacing.s,
                }}
              >
                You asked
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: bodyStyle.size,
                  fontFamily: bodyStyle.family,
                  fontStyle: 'italic',
                  marginBottom: theme.spacing.xl,
                }}
              >
                {submitted.text}
              </Text>
              {tierBState.kind === 'idle' && (
                <AIResponseRenderer
                  result={submitted.result}
                  onArticleOpen={(id) =>
                    nav.navigate('Article', { articleId: id })
                  }
                />
              )}
              {tierBState.kind === 'loading' && (
                <View
                  testID="ask-leiko-tier-b-loading"
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.text.secondary}
                    style={{ marginRight: theme.spacing.s }}
                  />
                  <Text
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: bodyStyle.size,
                      lineHeight: bodyStyle.lineHeight,
                      fontFamily: bodyStyle.family,
                    }}
                  >
                    {TIER_B_COPY.loading}
                  </Text>
                </View>
              )}
              {tierBState.kind === 'ok' && (
                <Text
                  testID="ask-leiko-tier-b-body"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: bodyStyle.size,
                    lineHeight: bodyStyle.lineHeight,
                    fontFamily: bodyStyle.family,
                  }}
                >
                  {tierBState.body}
                </Text>
              )}
              {tierBState.kind === 'defer' && (
                <Text
                  testID={`ask-leiko-tier-b-defer-${tierBState.trigger}`}
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: bodyStyle.size,
                    lineHeight: bodyStyle.lineHeight,
                    fontFamily: bodyStyle.family,
                  }}
                >
                  {DEFER_TEMPLATES[tierBState.trigger]}
                </Text>
              )}
              {tierBState.kind === 'quota_exceeded' && (
                <Text
                  testID="ask-leiko-tier-b-quota"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: bodyStyle.size,
                    lineHeight: bodyStyle.lineHeight,
                    fontFamily: bodyStyle.family,
                  }}
                >
                  {TIER_B_COPY.quotaExceeded}
                </Text>
              )}
              {tierBState.kind === 'error' && (
                <Text
                  testID="ask-leiko-tier-b-error"
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: bodyStyle.size,
                    lineHeight: bodyStyle.lineHeight,
                    fontFamily: bodyStyle.family,
                  }}
                >
                  {TIER_B_COPY.error}
                </Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
