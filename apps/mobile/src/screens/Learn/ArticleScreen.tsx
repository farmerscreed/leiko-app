// ArticleScreen — Sprint 13 task 4 part 2.
//
// Full article reader. Header with back, scrollable body rendered
// through <ArticleRenderer>. CardLink taps push another ArticleScreen
// onto the stack, so the user can drill across related cards.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArticleRenderer } from '../../components/ArticleRenderer';
import { useTheme } from '../../theme';
import { ARTICLES_BY_ID } from '../../learn/articleIndex.gen';
import type { CaregiverScreenProps, SelfBuyerScreenProps } from '../../navigation/types';

type ArticleNavigation =
  | CaregiverScreenProps<'Article'>
  | SelfBuyerScreenProps<'Article'>
  | {
      navigation: {
        goBack: () => void;
        navigate: (screen: string, params?: unknown) => void;
        push?: (screen: string, params?: unknown) => void;
      };
      route: { params: { articleId: string } };
    };

export function ArticleScreen({ navigation, route }: ArticleNavigation) {
  const theme = useTheme();
  const bodyStyle = theme.type('bodyL');
  const article = ARTICLES_BY_ID[route.params.articleId];

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID={`article-screen-${route.params.articleId}`}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.m,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="article-back"
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

          {article ? (
            <ArticleRenderer
              article={article}
              onCardLinkPress={cardId => {
                // Push a new ArticleScreen for the linked card. We use
                // navigate (not push) — react-navigation's stack will
                // push when navigating to the same route name with new
                // params on a native-stack.
                const nav = navigation as {
                  push?: (screen: string, params?: unknown) => void;
                  navigate: (screen: string, params?: unknown) => void;
                };
                if (nav.push) {
                  nav.push('Article', { articleId: cardId });
                } else {
                  nav.navigate('Article', { articleId: cardId });
                }
              }}
            />
          ) : (
            <View testID="article-not-found">
              <Text
                style={{
                  color: theme.colors.text.primary,
                  fontSize: bodyStyle.size,
                  lineHeight: bodyStyle.lineHeight,
                  fontFamily: bodyStyle.family,
                }}
              >
                That card has not arrived yet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
