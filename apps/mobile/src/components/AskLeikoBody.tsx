// AskLeikoBody — Sprint 12 follow-up.
//
// The reusable input + response surface for "Ask Leiko". Lifted out
// of AskLeikoScreen.tsx so both the full-screen route and the new
// bottom-sheet popup (AskLeikoSheet) can share the question-input,
// Tier-A intent classification, Tier-B fall-through state machine,
// and rendered result without duplicating the logic.
//
// Single-shot per submit — the user types a question, taps Send, and
// sees a result. Editing the input + tapping Send again replaces the
// result. Multi-turn chat is intentionally NOT here (Sprint 12+).
//
// Voice rules apply to every string emitted from here. The Tier-B
// fall-through copy is voice-clean per D11 §3 / D14 §14.2.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { AIResponseRenderer } from './AIResponseRenderer';
import { classifyIntent } from '../services/ai/intentRouter';
import { askTierB, type TierBDeferTrigger } from '../services/ai/tierB';
import { DEFER_TEMPLATES } from '../services/ai/deferTemplates';
import type { IntentMatch } from '../services/ai/types';

export const ASK_LEIKO_COPY = {
  helper: 'A short, plain-language question works best.',
  placeholder: 'What is blood pressure?',
  send: 'Send',
  loading: 'Thinking…',
  error: "I couldn't reach Leiko right now. Try again in a moment.",
  // Verbatim from D14 §14.2.
  quotaExceeded:
    "You've used your AI questions for this month. They reset on the 1st.",
  youAsked: 'You asked',
} as const;

type TierBState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; body: string }
  | { kind: 'defer'; trigger: TierBDeferTrigger }
  | { kind: 'quota_exceeded' }
  | { kind: 'error' };

export interface AskLeikoBodyProps {
  /** Called when an EDUCATE response surface taps a Learn card link. */
  onArticleOpen: (articleId: string) => void;
  testID?: string;
}

export function AskLeikoBody({ onArticleOpen, testID }: AskLeikoBodyProps) {
  const theme = useTheme();
  const bodyStyle = theme.type('bodyL');
  const captionStyle = theme.type('caption');

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
    <View testID={testID ?? 'ask-leiko-body'}>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: bodyStyle.size,
          fontFamily: bodyStyle.family,
          lineHeight: bodyStyle.lineHeight,
          marginBottom: theme.spacing.l,
        }}
      >
        {ASK_LEIKO_COPY.helper}
      </Text>

      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder={ASK_LEIKO_COPY.placeholder}
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
          marginBottom: theme.spacing.xl,
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
          {ASK_LEIKO_COPY.send}
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
            {ASK_LEIKO_COPY.youAsked}
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
              onArticleOpen={onArticleOpen}
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
                {ASK_LEIKO_COPY.loading}
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
              {ASK_LEIKO_COPY.quotaExceeded}
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
              {ASK_LEIKO_COPY.error}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
