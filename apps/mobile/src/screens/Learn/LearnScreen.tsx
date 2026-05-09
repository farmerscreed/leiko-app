// LearnScreen — Sprint 13 task 4 part 2.
//
// The Learn tab destination. Cluster grid + featured row at the top
// per docs/08-learn-module.md §4 (Surface A) and §8 (default home
// order: featured → clusters → "more coming soon" footer).
//
// Replaces the Sprint 10 placeholder with the real surface backed by
// the precompiled articleIndex.gen.ts. Empty clusters are hidden
// until articles arrive.
//
// Voice rules (docs/05-voice-and-claims.md): plain-language, observation-
// only, no fear hooks. Cluster names match docs/_reference/D9-editorial.md
// §3 + D14 §10.1.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import { useTheme } from '../../theme';
import { ARTICLES } from '../../learn/articleIndex.gen';
import { filterByClinicalReviewGate } from '../../services/learn/filters';
import type { ArticleCategory } from '../../services/learn/types';
import type { CaregiverScreenProps, SelfBuyerScreenProps } from '../../navigation/types';

type LearnNavigation =
  | CaregiverScreenProps<'Learn'>
  | SelfBuyerScreenProps<'Learn'>
  | {
      navigation: {
        goBack: () => void;
        navigate: (screen: string, params?: unknown) => void;
      };
    };

const CLUSTER_DISPLAY_NAMES: Record<ArticleCategory, string> = {
  NUMBERS: 'Understanding your numbers',
  CHANGES: 'Why blood pressure changes',
  HR: 'Heart rate',
  SPO2: 'Blood oxygen',
  SLEEP: 'Sleep',
  ACTIVITY: 'Activity',
  CORRELATIONS: 'Patterns across vitals',
  OTHER: 'Other numbers on your watch',
  DAILY: 'Daily life and BP',
  CULTURAL: 'In your kitchen',
  DOCTOR: 'Conversations with your doctor',
};

// Order matches docs/08-learn-module.md §8: NUMBERS first, multi-vital
// clusters next (the headline of D14), then the supporting categories.
const CLUSTER_ORDER: ArticleCategory[] = [
  'NUMBERS',
  'CHANGES',
  'HR',
  'SPO2',
  'SLEEP',
  'ACTIVITY',
  'CORRELATIONS',
  'DAILY',
  'CULTURAL',
  'DOCTOR',
  'OTHER',
];

export function LearnScreen({ navigation }: LearnNavigation) {
  const theme = useTheme();
  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');
  const subtitleStyle = theme.type('bodyM');

  // The two stacks register the same Learn route. TypeScript can't
  // unify the typed `navigate` signatures across CaregiverStackParamList
  // and SelfBuyerStackParamList, so we narrow at the call site.
  const nav = navigation as {
    goBack: () => void;
    navigate: (screen: string, params?: unknown) => void;
  };

  const visibleArticles = useMemo(
    () =>
      filterByClinicalReviewGate(
        ARTICLES.map(a => ({ frontmatter: a.frontmatter, body: '' })),
        // Dev mode shows clinical-review-pending Cluster A so the
        // founder can walk articles before the advisor signs.
        { dev: __DEV__ },
      ),
    [],
  );

  const visibleIds = useMemo(
    () => new Set(visibleArticles.map(a => a.frontmatter.id)),
    [visibleArticles],
  );

  // Featured = the canonical first card per Learn module §8.1.
  const featured = ARTICLES.find(
    a => a.frontmatter.id === 'numbers-001' && visibleIds.has('numbers-001'),
  );

  // Build cluster groupings, hiding empty clusters.
  const clusters = useMemo(() => {
    return CLUSTER_ORDER.map(category => {
      const articles = ARTICLES.filter(
        a =>
          a.frontmatter.category === category && visibleIds.has(a.frontmatter.id),
      );
      return { category, articles };
    }).filter(c => c.articles.length > 0);
  }, [visibleIds]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="learn-screen"
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
            onPress={() => nav.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="learn-back"
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
              fontWeight: headlineStyle.weight as '700',
              fontFamily: headlineStyle.family,
              letterSpacing: -0.6,
              marginBottom: theme.spacing.s,
            }}
          >
            Learn
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              lineHeight: bodyStyle.lineHeight,
            }}
          >
            Plain-language explainers for what your numbers mean.
          </Text>
        </View>

        {/* Featured card */}
        {featured && (
          <SettingsSection title="Start here" first testID="learn-featured">
            <ListRow
              variant="navigation"
              title={featured.frontmatter.title}
              subtitle="The single card every reader starts with."
              onPress={() =>
                nav.navigate('Article', {
                  articleId: featured.frontmatter.id,
                })
              }
              testID="learn-featured-numbers-001"
            />
          </SettingsSection>
        )}

        {/* Cluster grid */}
        {clusters.map(({ category, articles }) => (
          <SettingsSection
            key={category}
            title={CLUSTER_DISPLAY_NAMES[category]}
            testID={`learn-cluster-${category.toLowerCase()}`}
          >
            <ListRow
              variant="navigation"
              title={`${articles.length} article${articles.length === 1 ? '' : 's'}`}
              subtitle={previewSubtitle(articles)}
              onPress={() =>
                nav.navigate('LearnCluster', { category })
              }
              testID={`learn-cluster-${category.toLowerCase()}-row`}
            />
          </SettingsSection>
        ))}

        {/* "More coming soon" footer per Learn module §8.4 */}
        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.xxxl,
          }}
        >
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: subtitleStyle.size,
              lineHeight: subtitleStyle.lineHeight,
              fontFamily: subtitleStyle.family,
              textAlign: 'center',
            }}
          >
            More cards arrive in the coming releases. Talk to your doctor for personal questions about your readings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function previewSubtitle(
  articles: ReadonlyArray<{ frontmatter: { title: string } }>,
): string {
  if (articles.length === 0) return '';
  if (articles.length === 1) return articles[0].frontmatter.title;
  return `${articles[0].frontmatter.title} · +${articles.length - 1} more`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
