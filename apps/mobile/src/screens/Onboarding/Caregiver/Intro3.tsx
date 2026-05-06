// Caregiver Intro 3 — docs/04-screens/caregiver-onboarding.md §4.2 (sub-screen 3).
// Final intro. Primary CTA is button.accent ("Get started") per the spec.
// Skip remains available; routes to FamilyYou.

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { PageIndicator } from '../../../components/PageIndicator';
import { useTheme } from '../../../theme';
import type { CaregiverOnboardingScreenProps } from '../../../navigation/types';

export function CaregiverIntro3Screen({
  navigation,
}: CaregiverOnboardingScreenProps<'Intro3'>) {
  const theme = useTheme();
  const headline = theme.type('displayL');
  const body = theme.type('bodyL');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: theme.spacing.xxl,
            paddingTop: theme.spacing.xxxl,
            paddingBottom: theme.spacing.xxl,
          },
        ]}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="A caregiver and a parent, sharing a moment"
          style={[
            styles.illustration,
            {
              backgroundColor: theme.colors.surface.elevated,
              borderRadius: theme.radii.xl,
              marginBottom: theme.spacing.xxxl,
            },
          ]}
        />

        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headline.size,
            lineHeight: headline.lineHeight,
            fontWeight: headline.weight as '700',
            fontFamily: headline.family,
            textAlign: 'center',
            marginBottom: theme.spacing.m,
          }}
        >
          You drive. They wear.
        </Text>

        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: body.size,
            lineHeight: body.lineHeight,
            fontFamily: body.family,
            textAlign: 'center',
            maxWidth: 280,
            marginBottom: theme.spacing.xxxl,
          }}
        >
          You set up the watch and pay. They wear it and tap once a day. Everyone sees the same readings.
        </Text>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          <PageIndicator total={3} current={3} testID="caregiver-intro-pager" />
        </View>

        <Button
          variant="accent"
          onPress={() => navigation.navigate('FamilyYou')}
          testID="caregiver-intro3-get-started"
          style={{ width: '100%', marginBottom: theme.spacing.s }}
        >
          Get started
        </Button>

        <Button
          variant="ghost"
          onPress={() => navigation.navigate('FamilyYou')}
          testID="caregiver-intro3-skip"
          style={{ width: '100%' }}
        >
          Skip
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: 240, height: 180 },
});
