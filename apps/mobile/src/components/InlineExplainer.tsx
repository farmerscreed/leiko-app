// InlineExplainer — Sprint 13 task 5.
//
// Bottom-sheet "What does this mean?" surface. Reached from Reading
// Detail and the per-vital detail screens. Header carries the tier
// interpretation, sub-header the numeric anchor, body the lead
// paragraph from the matched Learn article, then up to one or two
// related cards, and a "Read more in Learn" CTA.
//
// Sourced from:
//   docs/08-learn-module.md §4.2 (Surface B — Inline Explainer Sheet)
//   docs/_reference/D9-editorial.md §3.3 (Reading-context mapping)
//   docs/03-components/bottom-sheet.md (Sheet contract)
//
// The component is navigation-agnostic: the caller passes
// onArticleOpen / onLearnOpen so the same sheet works from both the
// caregiver and self-buyer stacks.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { BottomSheet } from './BottomSheet';
import { InlineRun } from './ArticleRenderer';
import { useTheme } from '../theme';
import { ARTICLES } from '../learn/articleIndex.gen';
import {
  selectExplainerForVital,
  selectInlineExplainerArticles,
  type ExplainerVital,
} from '../services/learn/filters';
import { bpTier, type BPTier } from '../services/learn/types';
import type { CompiledArticle } from '../services/learn/ast';

export type ExplainerContext =
  | { type: 'bp'; reading: { systolic: number; diastolic: number } }
  | { type: 'hr'; restingHr: number | null }
  | { type: 'spo2'; latestSpO2: number | null }
  | { type: 'sleep' }
  | { type: 'activity' };

export interface InlineExplainerProps {
  visible: boolean;
  onDismiss: () => void;
  context: ExplainerContext;
  /** Tap any related card → navigate to the full article. */
  onArticleOpen?: (articleId: string) => void;
  /** Tap "Read more in Learn" → navigate to the Learn home. */
  onLearnOpen?: () => void;
  testID?: string;
}

export function InlineExplainer({
  visible,
  onDismiss,
  context,
  onArticleOpen,
  onLearnOpen,
  testID,
}: InlineExplainerProps) {
  const theme = useTheme();
  const articles = useMemo<CompiledArticle[]>(
    () => resolveArticlesForContext(context),
    [context],
  );

  // Lead = the first paragraph of the first article. Authors land the
  // answer in their first sentence per voice rules (D11 §3.4), so the
  // lead works as the explainer body.
  const lead = useMemo(() => extractLead(articles[0]), [articles]);

  const headerStyle = theme.type('title');
  const subHeaderStyle = theme.type('bodyM');
  const bodyStyle = theme.type('bodyL');
  const labelStyle = theme.type('labelUppercase');
  const captionStyle = theme.type('caption');

  const headerText = makeHeaderText(context);
  const subHeaderText = makeSubHeaderText(context);

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      size="default"
      surface="solid"
      testID={testID ?? 'inline-explainer'}
    >
      <View style={{ paddingHorizontal: theme.spacing.s }} testID="inline-explainer-body">
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headerStyle.size,
            lineHeight: headerStyle.lineHeight,
            fontFamily: headerStyle.family,
            fontWeight: headerStyle.weight as '600',
            marginBottom: theme.spacing.xs,
          }}
        >
          {headerText}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: subHeaderStyle.size,
            lineHeight: subHeaderStyle.lineHeight,
            fontFamily: subHeaderStyle.family,
            marginBottom: theme.spacing.l,
          }}
          testID="inline-explainer-subheader"
        >
          {subHeaderText}
        </Text>

        {lead ? (
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.xl,
            }}
            testID="inline-explainer-lead"
          >
            <InlineRun nodes={lead} />
          </Text>
        ) : (
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.xl,
            }}
            testID="inline-explainer-empty"
          >
            More cards on this arrive in the coming releases.
          </Text>
        )}

        {articles.length > 0 && (
          <View style={{ marginBottom: theme.spacing.l }}>
            <Text
              style={{
                color: theme.colors.text.tertiary,
                fontSize: labelStyle.size,
                lineHeight: labelStyle.lineHeight,
                fontFamily: labelStyle.family,
                fontWeight: labelStyle.weight as '500',
                letterSpacing: labelStyle.letterSpacing,
                textTransform: 'uppercase',
                marginBottom: theme.spacing.s,
              }}
            >
              Related
            </Text>
            {articles.map((a, idx) => (
              <Pressable
                key={a.frontmatter.id}
                onPress={
                  onArticleOpen
                    ? () => {
                        onDismiss();
                        onArticleOpen(a.frontmatter.id);
                      }
                    : undefined
                }
                accessibilityRole="link"
                accessibilityLabel={`Open ${a.frontmatter.title}`}
                testID={`inline-explainer-related-${a.frontmatter.id}`}
                style={{
                  paddingVertical: theme.spacing.s,
                  borderBottomWidth:
                    idx === articles.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.border.subtle,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: theme.colors.text.primary,
                    fontSize: bodyStyle.size,
                    fontFamily: bodyStyle.family,
                    fontWeight: '500',
                  }}
                >
                  {a.frontmatter.title}
                </Text>
                <Text
                  style={{
                    color: theme.colors.brand.primary,
                    fontSize: bodyStyle.size,
                    fontFamily: bodyStyle.family,
                  }}
                >
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={
            onLearnOpen
              ? () => {
                  onDismiss();
                  onLearnOpen();
                }
              : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Read more in Learn"
          testID="inline-explainer-cta-learn"
          style={{
            paddingVertical: theme.spacing.s,
            marginBottom: theme.spacing.l,
          }}
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              fontWeight: '500',
            }}
          >
            Read more in Learn
          </Text>
        </Pressable>

        <Text
          style={{
            color: theme.colors.text.tertiary,
            fontSize: captionStyle.size,
            lineHeight: captionStyle.lineHeight,
            fontFamily: captionStyle.family,
          }}
          testID="inline-explainer-disclaimer"
        >
          General information to help you understand the numbers. Talk to your doctor about what is right for you.
        </Text>
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------

function resolveArticlesForContext(context: ExplainerContext): CompiledArticle[] {
  const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  if (context.type === 'bp') {
    return selectInlineExplainerArticles({
      reading: context.reading,
      articles: ARTICLES as readonly CompiledArticle[] as CompiledArticle[],
      dev,
    });
  }
  return selectExplainerForVital({
    vital: context.type,
    articles: ARTICLES as readonly CompiledArticle[] as CompiledArticle[],
    dev,
  });
}

function extractLead(article: CompiledArticle | undefined) {
  if (!article) return null;
  for (const block of article.blocks) {
    if (block.type === 'paragraph') return block.children;
  }
  return null;
}

function makeHeaderText(context: ExplainerContext): string {
  if (context.type === 'bp') {
    const tier = bpTier(context.reading);
    return BP_HEADER_BY_TIER[tier];
  }
  return VITAL_HEADER[context.type];
}

const BP_HEADER_BY_TIER: Record<BPTier, string> = {
  normal: 'Your reading is in range.',
  elevated: 'Your reading is elevated.',
  stage1: 'Your reading is in Stage 1.',
  stage2: 'Your reading is in Stage 2.',
  crisis: 'Your reading is at the crisis threshold.',
};

const VITAL_HEADER: Record<ExplainerVital, string> = {
  hr: 'About your resting heart rate.',
  spo2: 'About blood oxygen.',
  sleep: 'About sleep tracking.',
  activity: 'About activity.',
};

function makeSubHeaderText(context: ExplainerContext): string {
  if (context.type === 'bp') {
    const { systolic, diastolic } = context.reading;
    const tier = bpTier(context.reading);
    const range = BP_RANGE_BY_TIER[tier];
    return `${systolic}/${diastolic} mmHg — ${range}.`;
  }
  if (context.type === 'hr') {
    return context.restingHr != null
      ? `${context.restingHr} bpm — typical range is 60 to 100.`
      : 'Typical range for healthy adults is 60 to 100 bpm.';
  }
  if (context.type === 'spo2') {
    return context.latestSpO2 != null
      ? `${context.latestSpO2}% — typical range is 95 to 100%.`
      : 'Typical range for healthy adults is 95 to 100%.';
  }
  if (context.type === 'sleep') {
    return 'The watch estimates the night from movement and heart rate.';
  }
  return 'Daily movement is one of the strongest signals in your trend chart.';
}

const BP_RANGE_BY_TIER: Record<BPTier, string> = {
  normal: 'in the standard range below 120/80 mmHg',
  elevated: 'systolic in the 120 to 129 range',
  stage1: 'in the 130 to 139 over 80 to 89 range',
  stage2: 'at or above 140 over 90 mmHg',
  crisis: 'at or above 180 over 120 mmHg',
};
