// Self-Buyer Intro 3 — docs/04-screens/self-buyer-onboarding.md §4.2.6
// (D8a §3.3). Final intro; primary CTA is button.accent.

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/Button';
import { PageIndicator } from '../../../components/PageIndicator';
import { useTheme } from '../../../theme';
import type { SelfBuyerOnboardingScreenProps } from '../../../navigation/types';

export function SelfBuyerIntro3Screen({
  navigation,
}: SelfBuyerOnboardingScreenProps<'Intro3'>) {
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
          accessibilityLabel="A hand passing a folded note across a table"
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
          See your trends. Show them to your doctor.
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
          A clear weekly summary, the kind you can save and share at your next appointment.
        </Text>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          <PageIndicator total={3} current={3} testID="self-buyer-intro-pager" />
        </View>

        <Button
          variant="accent"
          onPress={() => navigation.navigate('You')}
          testID="self-buyer-intro3-get-started"
          style={{ width: '100%', marginBottom: theme.spacing.s }}
        >
          Get started
        </Button>

        <Button
          variant="ghost"
          onPress={() => navigation.navigate('You')}
          testID="self-buyer-intro3-skip"
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
