// Caregiver Intro 1 — docs/04-screens/caregiver-onboarding.md §4.2.1.
// First of three intros that set the emotional register. No skip on this
// screen (skip is only available from Intro 2 onward per the spec).

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { PageIndicator } from '../../../components/PageIndicator';
import { useTheme } from '../../../theme';
import type { CaregiverOnboardingScreenProps } from '../../../navigation/types';

export function CaregiverIntro1Screen({
  navigation,
}: CaregiverOnboardingScreenProps<'Intro1'>) {
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
          accessibilityLabel="Two hands, gently holding"
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
          Stay close to the people who shaped you.
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
          Leiko is a calm way to keep an eye on a parent's health, even from far away.
        </Text>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          <PageIndicator total={3} current={1} testID="caregiver-intro-pager" />
        </View>

        <Button
          variant="primary"
          onPress={() => navigation.navigate('Intro2')}
          testID="caregiver-intro1-continue"
          style={{ width: '100%' }}
        >
          Continue
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
