// ArticleRenderer — Sprint 13 task 4 part 2.
//
// Walks a CompiledArticle's BlockNode[] (and InlineNode children) into
// React Native nodes, with custom renderers for the four MDX
// components: Definition, CardLink, Reading, Source.
//
// Source-of-truth tokens (D12):
//   - Display title:        type('displayM') — section-heading scale
//   - Heading H2:           type('headline')
//   - Body:                 type('bodyL')
//   - Sources footer rows:  type('bodyM') text.tertiary
//   - Reading numeric inline: type('numericS') in numeric font
//
// Sourced from:
//   docs/08-learn-module.md §11 (MDX component mapping)
//   docs/_reference/D12-visual-system-v2.md §3 (typography), §4 (spacing)
//   docs/_reference/D9-editorial.md §2.4 (card format constraints)

import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type {
  BlockNode,
  CompiledArticle,
  InlineNode,
} from '../services/learn/ast';
import { useTheme } from '../theme';

export interface ArticleRendererProps {
  article: CompiledArticle;
  /** Tap handler for inline <CardLink id="..." /> — navigates to the
   *  linked article. Wired by the parent screen so the renderer stays
   *  navigation-agnostic (testable). */
  onCardLinkPress?: (cardId: string) => void;
  testID?: string;
}

export function ArticleRenderer({
  article,
  onCardLinkPress,
  testID,
}: ArticleRendererProps) {
  const theme = useTheme();
  const titleStyle = theme.type('displayM');
  const lastReviewedStyle = theme.type('caption');

  return (
    <View testID={testID}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text.primary,
          fontSize: titleStyle.size,
          lineHeight: titleStyle.lineHeight,
          fontFamily: titleStyle.family,
          fontWeight: titleStyle.weight as '700',
          letterSpacing: -0.6,
          marginBottom: theme.spacing.l,
        }}
      >
        {article.frontmatter.title}
      </Text>

      {/* Block list */}
      {article.blocks.map((block, idx) => (
        <BlockRenderer
          key={idx}
          block={block}
          onCardLinkPress={onCardLinkPress}
        />
      ))}

      {/* Sources footer — drawn from frontmatter, not from inline body. */}
      {article.frontmatter.sources.length > 0 && (
        <View
          style={{
            marginTop: theme.spacing.xxxl,
            paddingTop: theme.spacing.l,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border.subtle,
          }}
          testID="article-sources-footer"
        >
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: theme.type('labelUppercase').size,
              lineHeight: theme.type('labelUppercase').lineHeight,
              fontFamily: theme.type('labelUppercase').family,
              fontWeight: theme.type('labelUppercase').weight as '500',
              letterSpacing: theme.type('labelUppercase').letterSpacing,
              textTransform: 'uppercase',
              marginBottom: theme.spacing.s,
            }}
          >
            Sources
          </Text>
          {article.frontmatter.sources.map((src, i) => (
            <Text
              key={i}
              style={{
                color: theme.colors.text.tertiary,
                fontSize: theme.type('bodyM').size,
                lineHeight: theme.type('bodyM').lineHeight,
                fontFamily: theme.type('bodyM').family,
                marginBottom: theme.spacing.xs,
              }}
            >
              {src}
            </Text>
          ))}
        </View>
      )}

      {/* Last-reviewed line per Learn module §3 (mandatory). */}
      <Text
        style={{
          marginTop: theme.spacing.l,
          color: theme.colors.text.tertiary,
          fontSize: lastReviewedStyle.size,
          lineHeight: lastReviewedStyle.lineHeight,
          fontFamily: lastReviewedStyle.family,
        }}
        testID="article-last-reviewed"
      >
        Last reviewed {article.frontmatter.last_reviewed}
        {article.frontmatter.reviewed_by
          ? ` · ${article.frontmatter.reviewed_by}`
          : ''}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------
// Block renderer.
// -----------------------------------------------------------------

interface BlockRendererProps {
  block: BlockNode;
  onCardLinkPress?: (cardId: string) => void;
}

function BlockRenderer({ block, onCardLinkPress }: BlockRendererProps) {
  const theme = useTheme();

  if (block.type === 'heading') {
    const style = theme.type('headline');
    return (
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text.primary,
          fontSize: style.size,
          lineHeight: style.lineHeight,
          fontFamily: style.family,
          fontWeight: style.weight as '600',
          marginTop: theme.spacing.xxl,
          marginBottom: theme.spacing.s,
        }}
      >
        <InlineRun nodes={block.children} onCardLinkPress={onCardLinkPress} />
      </Text>
    );
  }

  if (block.type === 'paragraph') {
    const style = theme.type('bodyL');
    return (
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: style.size,
          lineHeight: style.lineHeight,
          fontFamily: style.family,
          marginBottom: theme.spacing.l,
        }}
      >
        <InlineRun nodes={block.children} onCardLinkPress={onCardLinkPress} />
      </Text>
    );
  }

  // List
  const style = theme.type('bodyL');
  return (
    <View style={{ marginBottom: theme.spacing.l }}>
      {block.items.map((item, idx) => (
        <View
          key={idx}
          style={{
            flexDirection: 'row',
            marginBottom: theme.spacing.s,
            paddingLeft: theme.spacing.xs,
          }}
        >
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: style.size,
              lineHeight: style.lineHeight,
              fontFamily: style.family,
              marginRight: theme.spacing.s,
              minWidth: block.ordered ? 22 : 12,
            }}
          >
            {block.ordered ? `${idx + 1}.` : '•'}
          </Text>
          <Text
            style={{
              flex: 1,
              color: theme.colors.text.primary,
              fontSize: style.size,
              lineHeight: style.lineHeight,
              fontFamily: style.family,
            }}
          >
            <InlineRun nodes={item} onCardLinkPress={onCardLinkPress} />
          </Text>
        </View>
      ))}
    </View>
  );
}

// -----------------------------------------------------------------
// Inline renderer.
// -----------------------------------------------------------------

interface InlineRunProps {
  nodes: InlineNode[];
  onCardLinkPress?: (cardId: string) => void;
}

/** Render a flat list of InlineNodes. Exported so the
 *  InlineExplainer (sprint 13 task 5) can render an article's lead
 *  paragraph inline without re-walking the full article. */
export function InlineRun({ nodes, onCardLinkPress }: InlineRunProps): ReactNode {
  return (
    <>
      {nodes.map((node, idx) => (
        <InlineNodeRenderer
          key={idx}
          node={node}
          onCardLinkPress={onCardLinkPress}
        />
      ))}
    </>
  );
}

interface InlineNodeRendererProps {
  node: InlineNode;
  onCardLinkPress?: (cardId: string) => void;
}

function InlineNodeRenderer({
  node,
  onCardLinkPress,
}: InlineNodeRendererProps): ReactNode {
  const theme = useTheme();

  if (node.type === 'text') return node.value;

  if (node.type === 'strong') {
    return (
      <Text style={{ fontFamily: theme.fontFamilies.bodySemiBold, fontWeight: '600' }}>
        <InlineRun nodes={node.children} onCardLinkPress={onCardLinkPress} />
      </Text>
    );
  }

  if (node.type === 'em') {
    return (
      <Text style={{ fontStyle: 'italic' }}>
        <InlineRun nodes={node.children} onCardLinkPress={onCardLinkPress} />
      </Text>
    );
  }

  if (node.type === 'code') {
    return (
      <Text
        style={{
          fontFamily: theme.fontFamilies.numeric,
          color: theme.colors.text.secondary,
        }}
      >
        {node.value}
      </Text>
    );
  }

  if (node.type === 'definition') {
    // The CHILDREN carry the explanation; the term is metadata used
    // for the screen reader. v1.0 styling is conservative: a subtle
    // accent color so the reader notices a definition is being made,
    // no tooltip yet (future enhancement).
    return (
      <Text
        accessibilityLabel={`Definition of ${node.term}`}
        style={{ color: theme.colors.text.primary }}
      >
        <InlineRun nodes={node.children} onCardLinkPress={onCardLinkPress} />
      </Text>
    );
  }

  if (node.type === 'reading') {
    const numStyle = theme.type('numericS');
    // Inline pill: the BP value rendered in the numeric font, slightly
    // tinted accent. Per Learn module §11.
    return (
      <Text
        accessibilityLabel={`Sample reading ${node.systolic} over ${node.diastolic} millimetres of mercury`}
        style={{
          fontFamily: numStyle.family,
          color: theme.colors.brand.primary,
        }}
      >
        {node.systolic}/{node.diastolic} mmHg
      </Text>
    );
  }

  if (node.type === 'cardlink') {
    // Inline tappable link to another card. We render a short label —
    // the parent screen owns navigation by passing onCardLinkPress.
    return (
      <Text
        onPress={onCardLinkPress ? () => onCardLinkPress(node.cardId) : undefined}
        accessibilityRole="link"
        accessibilityLabel={`Open card ${node.cardId}`}
        style={{
          color: theme.colors.brand.primary,
          textDecorationLine: 'underline',
        }}
      >
        {node.cardId}
      </Text>
    );
  }

  // Exhaustiveness check.
  const _exhaustive: never = node;
  return _exhaustive;
}
