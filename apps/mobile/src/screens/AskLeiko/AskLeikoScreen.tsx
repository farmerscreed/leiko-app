// AskLeikoScreen — Sprint 11 task 10 + Sprint 12 follow-up.
//
// Full-screen "Ask Leiko" route. Sprint 12 follow-up extracted the
// input + response logic into <AskLeikoBody/> so the same surface
// can be reused inside the home-screen bottom-sheet popup
// (AskLeikoSheet). The route stays alive — Settings / Learn deep
// links still navigate here.
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AskLeikoBody } from '../../components/AskLeikoBody';
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

  const nav = navigation as {
    goBack: () => void;
    navigate: (screen: string, params?: unknown) => void;
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
              marginBottom: theme.spacing.l,
            }}
          >
            Ask Leiko
          </Text>

          <View style={{ marginBottom: theme.spacing.xxxl }}>
            <AskLeikoBody
              onArticleOpen={(id) => nav.navigate('Article', { articleId: id })}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
