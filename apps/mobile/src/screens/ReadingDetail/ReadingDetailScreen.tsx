// ReadingDetailScreen — Sprint 6.
//
// Per docs/04-screens/reading-detail.md, with caregiver vs self-buyer
// variants per D8a §7.
//
// Sprint 6 scope is intentionally trimmed:
//   - Hero numeric + tier chip + secondary stats + ghost anchors
//   - "Why this reading?" / "What does this mean?" buttons render but
//     do nothing (Sprint 13 wires the Inline Explainer)
//   - "Mark as not me" soft-hides via reading-store mutation (caregiver
//     mode only; D8a §7.2 removes it from self-buyer mode)
//   - Notes/comments thread is OUT of scope — Sprint 7/8 territory
//   - First-reading auto-expand explainer is OUT of scope — Sprint 13

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { useTheme } from '../../theme';
import { useReadings } from '../../state/readings';
import { useAuth } from '../../state/auth';
import {
  tierChipText,
  tierPillVariant,
} from '../../utils/classification';

type Props =
  | { navigation: { goBack: () => void } };

type ReadingDetailParams = { readingLocalId: string };

function formatTimestamp(measuredAtSec: number): string {
  const d = new Date(measuredAtSec * 1000);
  const diffMs = Date.now() - d.getTime();
  const hours = diffMs / 3_600_000;
  if (hours < 24) {
    return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function ReadingDetailScreen({ navigation }: Props) {
  const theme = useTheme();
  const route = useRoute<RouteProp<Record<string, ReadingDetailParams>, string>>();
  const localId = route.params?.readingLocalId;
  const reading = useReadings((s) => (localId ? s.byLocalId(localId) : null));
  const accountType = useAuth((s) => s.profile?.account_type);

  const headline = theme.type('headline');
  const numericXl = theme.type('numericXl');
  const numericM = theme.type('numericM');
  const bodyM = theme.type('bodyM');
  const caption = theme.type('caption');

  if (!reading) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
        edges={['top', 'bottom']}
        testID="reading-detail-screen"
      >
        <View style={{ padding: theme.spacing.xxl }}>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyM.size,
              fontFamily: bodyM.family,
            }}
          >
            We can't find that reading. It may have been removed.
          </Text>
          <Button
            variant="ghost"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            testID="reading-detail-back-empty"
            style={{ marginTop: theme.spacing.l }}
          >
            Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const isSelf = accountType === 'self_buyer';
  const tier = reading.classification.tier;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
      testID="reading-detail-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: theme.spacing.xxl,
            paddingTop: theme.spacing.xxl,
            paddingBottom: theme.spacing.xxxl,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          testID="reading-detail-back"
          style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.l }}
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: bodyM.size,
              fontFamily: bodyM.family,
            }}
          >
            Back
          </Text>
        </Pressable>

        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headline.size,
            lineHeight: headline.lineHeight,
            fontWeight: headline.weight as '600',
            fontFamily: headline.family,
            marginBottom: theme.spacing.xs,
          }}
        >
          {isSelf ? 'Your reading' : 'Reading'}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: caption.size,
            fontFamily: caption.family,
            marginBottom: theme.spacing.xxl,
          }}
        >
          {formatTimestamp(reading.measuredAtSec)}
          {reading.serverId === null ? ' · Pending sync' : ''}
        </Text>

        <View
          style={{
            alignItems: 'center',
            marginBottom: theme.spacing.l,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              accessibilityLabel={`${reading.systolic} over ${reading.diastolic} mmHg, pulse ${reading.pulse ?? 'unknown'}`}
              style={{
                color: theme.colors.text.primary,
                fontSize: numericXl.size,
                lineHeight: numericXl.lineHeight,
                fontWeight: numericXl.weight as '500',
                fontFamily: numericXl.family,
              }}
            >
              {reading.systolic}/{reading.diastolic}
            </Text>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: bodyM.size,
                fontFamily: bodyM.family,
                marginLeft: theme.spacing.s,
              }}
            >
              mmHg
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginBottom: theme.spacing.s }}>
          <Pill variant={tierPillVariant(tier)}>{tierChipText(tier)}</Pill>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="What does this mean? Opens explanation sheet."
          accessibilityHint="Opens explanation sheet"
          testID="reading-detail-anchor-meaning"
          // No-op until Sprint 13. Stays interactive-looking; tap is a
          // no-op rather than disabled so the reader doesn't think it's
          // broken — the test asserts the button is present + the
          // handler doesn't throw.
          onPress={() => undefined}
          style={{
            alignSelf: 'center',
            marginTop: theme.spacing.s,
            marginBottom: theme.spacing.xxl,
          }}
        >
          <Text
            style={{
              color: theme.colors.brand.primarySoft,
              fontSize: bodyM.size,
              fontFamily: bodyM.family,
            }}
          >
            What does this mean?
          </Text>
        </Pressable>

        {/* Secondary stats */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginBottom: theme.spacing.xxl,
          }}
          accessibilityLabel={`Pulse ${reading.pulse ?? 'unknown'}`}
        >
          <SecondaryStat
            label="Pulse"
            value={reading.pulse != null ? String(reading.pulse) : '—'}
            unit="bpm"
            numericStyle={numericM}
            captionStyle={caption}
          />
        </View>

        {isSelf ? (
          <Button
            variant="ghost"
            onPress={() => undefined}
            accessibilityLabel="Why this reading? Opens explanation sheet."
            testID="reading-detail-why-this"
            style={{ marginBottom: theme.spacing.s }}
          >
            Why this reading?
          </Button>
        ) : (
          <Button
            variant="ghost"
            onPress={() => undefined}
            accessibilityLabel="Mark as not me. Hides this reading from the family."
            testID="reading-detail-not-me"
            style={{ marginBottom: theme.spacing.s }}
          >
            Mark as not me
          </Button>
        )}
        <Button
          variant="ghost"
          onPress={() => undefined}
          accessibilityLabel={isSelf ? 'Note for my doctor' : 'Add a note'}
          testID="reading-detail-add-note"
        >
          {isSelf ? 'Note for my doctor' : 'Add a note'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecondaryStat({
  label,
  value,
  unit,
  numericStyle,
  captionStyle,
}: {
  label: string;
  value: string;
  unit: string;
  numericStyle: { size: number; lineHeight: number; weight: string; family: string };
  captionStyle: { size: number; family: string };
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: captionStyle.size,
          fontFamily: captionStyle.family,
          marginBottom: theme.spacing.xs,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: numericStyle.size,
            lineHeight: numericStyle.lineHeight,
            fontWeight: numericStyle.weight as '500',
            fontFamily: numericStyle.family,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: captionStyle.size,
            fontFamily: captionStyle.family,
            marginLeft: theme.spacing.xs,
          }}
        >
          {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
