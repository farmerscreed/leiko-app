// Caregiver Intro 2 — docs/04-screens/caregiver-onboarding.md §4.2 (sub-screen 2).
// Skip becomes available here. Skip routes directly to FamilyYou (sub-screen 4).

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { PageIndicator } from '../../../components/PageIndicator';
import { useTheme } from '../../../theme';
import type { CaregiverOnboardingScreenProps } from '../../../navigation/types';

export function CaregiverIntro2Screen({
  navigation,
}: CaregiverOnboardingScreenProps<'Intro2'>) {
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
          accessibilityLabel="A watch on a wrist, calm"
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
          Their watch. Your peace of mind.
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
          When your parent's blood pressure changes, we let you know — gently. No surveillance, no panic.
        </Text>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          <PageIndicator total={3} current={2} testID="caregiver-intro-pager" />
        </View>

        <Button
          variant="primary"
          onPress={() => navigation.navigate('Intro3')}
          testID="caregiver-intro2-continue"
          style={{ width: '100%', marginBottom: theme.spacing.s }}
        >
          Continue
        </Button>

        <Button
          variant="ghost"
          onPress={() => navigation.navigate('FamilyYou')}
          testID="caregiver-intro2-skip"
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
