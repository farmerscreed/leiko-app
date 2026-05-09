// VitalExplainerAnchor — Sprint 13 task 11.
//
// Drop-in wrapper for the "What does this mean?" anchor + the
// InlineExplainer it opens. Each VitalDetail screen renders one of
// these alongside the vital hero and chart; the screen passes the
// context that matches the vital being viewed.
//
// Splits the state + sheet into a single component so the per-vital
// screens don't each carry the same useState boilerplate.

import { Pressable, Text } from 'react-native';
import { useState } from 'react';
import { InlineExplainer, type ExplainerContext } from './InlineExplainer';
import { useTheme } from '../theme';

export interface VitalExplainerAnchorProps {
  context: ExplainerContext;
  onArticleOpen?: (articleId: string) => void;
  onLearnOpen?: () => void;
  /** Override the default "What does this mean?" copy for cases where
   *  the surrounding text already implies the question. Optional. */
  label?: string;
  /** Anchors are commonly centred under the hero; some detail screens
   *  prefer left-aligned. Defaults to centre. */
  alignment?: 'center' | 'left';
  testID?: string;
}

export function VitalExplainerAnchor({
  context,
  onArticleOpen,
  onLearnOpen,
  label = 'What does this mean?',
  alignment = 'center',
  testID,
}: VitalExplainerAnchorProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const bodyM = theme.type('bodyM');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} Opens explanation sheet.`}
        accessibilityHint="Opens explanation sheet"
        testID={testID ?? 'vital-explainer-anchor'}
        hitSlop={theme.spacing.m}
        style={{
          alignSelf: alignment === 'center' ? 'center' : 'flex-start',
          paddingVertical: theme.spacing.s,
        }}
      >
        <Text
          style={{
            color: theme.colors.brand.primary,
            fontSize: bodyM.size,
            fontFamily: bodyM.family,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      </Pressable>

      <InlineExplainer
        visible={open}
        onDismiss={() => setOpen(false)}
        context={context}
        onArticleOpen={onArticleOpen}
        onLearnOpen={onLearnOpen}
      />
    </>
  );
}
