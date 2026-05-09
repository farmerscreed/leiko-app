// LearnClusterScreen — Sprint 13 task 4 part 2.
//
// The article-list view inside a single cluster (NUMBERS, HR, SPO2,
// ...). Reached from LearnScreen → cluster row. Each article renders
// as a navigation ListRow; tap drills into ArticleScreen.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import { useTheme } from '../../theme';
import { ARTICLES } from '../../learn/articleIndex.gen';
import type { ArticleCategory } from '../../services/learn/types';
import type { CaregiverScreenProps, SelfBuyerScreenProps } from '../../navigation/types';

type LearnClusterNavigation =
  | CaregiverScreenProps<'LearnCluster'>
  | SelfBuyerScreenProps<'LearnCluster'>
  | {
      navigation: {
        goBack: () => void;
        navigate: (screen: string, params?: unknown) => void;
      };
      route: { params: { category: ArticleCategory } };
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

const CLUSTER_BLURBS: Partial<Record<ArticleCategory, string>> = {
  NUMBERS: 'What the two numbers mean and how the ranges work.',
  HR: 'How your heart rate responds to the day.',
  SPO2: 'What blood oxygen tells you, and what it does not.',
  SLEEP: 'How the watch estimates sleep, and why trends matter more than any one night.',
  ACTIVITY: 'How regular movement shows up in your readings.',
  CORRELATIONS: 'How your vitals move together across days and weeks.',
};

export function LearnClusterScreen({ navigation, route }: LearnClusterNavigation) {
  const theme = useTheme();
  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');
  const subtitleStyle = theme.type('bodyM');

  // Multi-stack navigation type narrowing — see LearnScreen for the
  // same pattern.
  const nav = navigation as {
    goBack: () => void;
    navigate: (screen: string, params?: unknown) => void;
  };

  const category = route.params.category;
  const display = CLUSTER_DISPLAY_NAMES[category] ?? category;
  const blurb = CLUSTER_BLURBS[category];

  const articles = useMemo(
    () =>
      ARTICLES.filter(a => a.frontmatter.category === category).filter(
        // Dev exposes clinical-review-pending Cluster A so the founder
        // can walk articles before the advisor signs.
        a => __DEV__ || !a.frontmatter.clinical_review_required || a.frontmatter.clinical_reviewed_at !== null,
      ),
    [category],
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID={`learn-cluster-screen-${category.toLowerCase()}`}
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
            testID="learn-cluster-back"
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
            {display}
          </Text>
          {blurb ? (
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                lineHeight: bodyStyle.lineHeight,
              }}
            >
              {blurb}
            </Text>
          ) : null}
        </View>

        {articles.length === 0 ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.xl,
              paddingTop: theme.spacing.l,
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
              Cards in this cluster arrive in the coming releases.
            </Text>
          </View>
        ) : (
          <SettingsSection title="Articles" first>
            {articles.map((article, idx) => (
              <ListRow
                key={article.frontmatter.id}
                variant="navigation"
                title={article.frontmatter.title}
                subtitle={
                  article.frontmatter.clinical_review_required &&
                  article.frontmatter.clinical_reviewed_at === null
                    ? 'Awaiting clinical review · dev only'
                    : undefined
                }
                onPress={() =>
                  nav.navigate('Article', {
                    articleId: article.frontmatter.id,
                  })
                }
                showDivider={idx !== articles.length - 1}
                testID={`learn-cluster-article-${article.frontmatter.id}`}
              />
            ))}
          </SettingsSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
