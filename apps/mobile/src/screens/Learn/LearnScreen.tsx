// LearnScreen — Sprint 10c.2 polish placeholder.
//
// Self-buyer's 4th tab (replacing the dead "Family" tab per brand IA
// review — self-buyers' mental model is "understand my numbers", not
// family). Sprint 13/14 ships real Learn cards (Cluster A/B/C). Until
// then, this is a calm coming-soon surface with three teaser topics so
// the slot doesn't read empty.
//
// Voice rules (docs/05-voice-and-claims.md):
//   • "What's a normal reading?" — answer-first, plain language.
//   • No fear language ("dangerous", "silent killer" forbidden).
//   • "Talk to your doctor" preferred over "consult a healthcare provider".

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import { useTheme } from '../../theme';
import type { CaregiverScreenProps } from '../../navigation/types';

interface Teaser {
  title: string;
  body: string;
}

const TEASERS: Teaser[] = [
  {
    title: 'What is a normal blood pressure?',
    body: 'Most adults sit between 90/60 and 120/80. Your number is a snapshot — context matters.',
  },
  {
    title: 'Why morning readings are usually higher',
    body: 'BP follows your circadian rhythm. The first reading after waking is often the highest of the day.',
  },
  {
    title: 'What the second number means',
    body: 'Diastolic is the pressure between heartbeats. It tells a different story than the top number.',
  },
  {
    title: 'How sleep moves your morning numbers',
    body: 'Short or restless sleep often nudges morning BP up. Your weekly trend tells the real story.',
  },
];

type Props =
  | CaregiverScreenProps<'Learn'>
  | { navigation: { goBack: () => void } };

export function LearnScreen({ navigation }: Props) {
  const theme = useTheme();
  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');

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
            onPress={() => navigation.goBack()}
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

        <SettingsSection title="Coming soon" first testID="learn-coming-soon">
          {TEASERS.map((teaser, idx) => (
            <ListRow
              key={teaser.title}
              variant="data"
              title={teaser.title}
              subtitle={teaser.body}
              showDivider={idx !== TEASERS.length - 1}
              testID={`learn-teaser-${idx}`}
            />
          ))}
        </SettingsSection>

        <View
          style={{
            paddingHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.xxl,
          }}
        >
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: theme.type('bodyS').size,
              lineHeight: theme.type('bodyS').lineHeight,
              fontFamily: theme.type('bodyS').family,
              textAlign: 'center',
            }}
          >
            Full guides arrive in the next release. Talk to your doctor for personal questions about your readings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
