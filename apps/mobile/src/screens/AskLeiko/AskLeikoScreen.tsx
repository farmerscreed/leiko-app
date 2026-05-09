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
import type { IntentMatch } from '../../services/ai/types';
import type { CaregiverScreenProps, SelfBuyerScreenProps } from '../../navigation/types';

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

  const onSubmit = () => {
    const trimmed = question.trim();
    if (trimmed.length === 0) return;
    const result = classifyIntent(trimmed);
    setSubmitted({ text: trimmed, result });
    setQuestion('');
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
              <AIResponseRenderer
                result={submitted.result}
                onArticleOpen={(id) =>
                  nav.navigate('Article', { articleId: id })
                }
              />
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
