// Caregiver Home — Sprint 7.
//
// Per docs/04-screens/caregiver-home.md + the founder-approved
// architecture intent (memory/sprint_7_architecture_intent.md).
//
// Layout (top → bottom):
//   - Header (logo text + Settings affordance, 24pt)
//   - Anomaly banner slot — most-severe-wins; placeholder UI for
//     Sprint 7 (full anomaly engine ships in Sprint 15)
//   - Weekly snapshot row — static heuristic copy, gated behind a
//     feature flag for Tier-C drop-in (Sprint 11)
//   - Parent cards (one per family the caregiver is in)
//     • Empty: no family memberships → "Your family circle is quiet for now"
//     • Empty: parents added but no readings → "No readings yet" / pair watch
//     • Populated: ReadingCard with sparkline trail
//   - Pull-to-refresh: forces a sync orchestrator run + invalidates
//     the realtime query.
//
// Voice rules (docs/05-voice-and-claims.md): every user-visible string
// here is from the verified empty-state copy in caregiver-home.md or
// is calm-warm-dignified per the spec. No "patient", no "diagnose",
// no fear language.

import { useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { ReadingCard } from '../../components/ReadingCard';
import { Sparkline } from '../../components/Sparkline';
import { useTheme, type Theme } from '../../theme';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';
import { usePairing } from '../../state/pairing';
import { useReadings } from '../../state/readings';
import { useSyncOrchestrator } from '../../state/syncOrchestrator';
import { classifyReading } from '../../utils/classification';
import type { CaregiverStackParamList } from '../../navigation/types';
import type { ParentSummary, ReadingSummary } from '../../services/families/fetchParentSummaries';
import type { LocalReading } from '../../state/readings';

type Nav = NativeStackNavigationProp<CaregiverStackParamList>;

export function CaregiverHome() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { parents, isLoading, isRefreshing, error, refresh } = useFamilyReadings();
  const pairedDevice = usePairing((s) => s.pairedDevice);
  const localLatest = useReadings((s) => s.latest());
  const syncStatus = useSyncOrchestrator((s) => s.status);

  // The owning phone (the one paired to the watch) treats local MMKV
  // readings as authoritative for first paint, since /sync may not
  // have round-tripped yet. Merge: if the local latest is newer than
  // the server's view of the owner-family, prepend it.
  const merged = useMemo(
    () => mergeLocalLatest(parents, localLatest),
    [parents, localLatest],
  );

  const anomaly = useMemo(() => pickAnomaly(merged), [merged]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
    >
      <Header
        onSettingsPress={() => navigation.navigate('Settings')}
        theme={theme}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: theme.spacing.xxl,
            paddingTop: theme.spacing.l,
            paddingBottom: theme.spacing.xxxxl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.brand.primarySoft}
          />
        }
      >
        {anomaly ? <AnomalyBanner anomaly={anomaly} theme={theme} /> : null}

        {merged.length > 0 ? (
          <WeeklySnapshot parents={merged} theme={theme} />
        ) : null}

        {isLoading ? (
          <Skeleton theme={theme} />
        ) : merged.length === 0 ? (
          <EmptyNoParents theme={theme} />
        ) : (
          <View style={{ gap: theme.spacing.xl }}>
            {merged.map((parent) => (
              <ParentCard
                key={parent.familyId}
                parent={parent}
                hasPairedDevice={pairedDevice !== null}
                onPress={(reading) =>
                  navigation.navigate('ReadingDetail', {
                    readingLocalId: reading.id,
                  })
                }
                onPairPress={() => navigation.navigate('Pairing')}
                theme={theme}
              />
            ))}
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.type('caption').size,
                  fontFamily: theme.type('caption').family,
                  textAlign: 'center',
                  marginTop: theme.spacing.l,
                }}
              >
                {syncStatus === 'error'
                  ? "We're having trouble syncing right now. Your readings are saved."
                  : "We'll keep trying."}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Header — logo text + Settings entry. Smaller header than spec offers
// (24pt icon, 22pt logo) so screen real estate goes to the data.
// -----------------------------------------------------------------------------

function Header({
  onSettingsPress,
  theme,
}: {
  onSettingsPress: () => void;
  theme: Theme;
}) {
  const headline = theme.type('headline');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.xxl,
        paddingVertical: theme.spacing.m,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text.primary,
          fontSize: headline.size,
          lineHeight: headline.lineHeight,
          fontFamily: headline.family,
          fontWeight: headline.weight as '600',
        }}
      >
        Leiko
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={onSettingsPress}
        hitSlop={12}
        testID="caregiver-home-settings"
        style={({ pressed }) => ({
          opacity: pressed ? 0.65 : 1,
          paddingHorizontal: theme.spacing.s,
          paddingVertical: theme.spacing.xs,
        })}
      >
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: 22,
            fontWeight: '300',
          }}
        >
          {/* Phosphor icon library lands in a later sprint. The "⚙" glyph
              is a deliberate placeholder so the affordance still reads
              as Settings without a dependency. */}
          {'⚙'}
        </Text>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// AnomalyBanner — calm-concerned or confirmed-urgent. Sprint 7 ships
// the visual; the engine that decides which (and surfaces the right
// reading_id) lands in Sprint 15.
// -----------------------------------------------------------------------------

interface AnomalyState {
  tier: 'calm_concerned' | 'confirmed_urgent';
  parentName: string;
  readingId: string;
}

function AnomalyBanner({
  anomaly,
  theme,
}: {
  anomaly: AnomalyState;
  theme: Theme;
}) {
  const isUrgent = anomaly.tier === 'confirmed_urgent';
  const headline = isUrgent
    ? `Talk to ${anomaly.parentName} now`
    : `Worth a chat with ${anomaly.parentName}`;
  const body = isUrgent
    ? 'Their latest reading was above their usual range. A calm check-in helps.'
    : "We've noticed a pattern worth a gentle check-in.";

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: isUrgent
          ? theme.colors.state.urgent
          : theme.colors.surface.subtle,
        borderRadius: theme.radii.l,
        padding: theme.spacing.l,
        marginBottom: theme.spacing.xl,
        borderLeftWidth: isUrgent ? 0 : 4,
        borderLeftColor: isUrgent ? 'transparent' : theme.colors.state.warning,
      }}
    >
      <Text
        style={{
          color: isUrgent ? theme.colors.text.onBrand : theme.colors.text.primary,
          fontSize: theme.type('title').size,
          lineHeight: theme.type('title').lineHeight,
          fontFamily: theme.type('title').family,
          fontWeight: theme.type('title').weight as '600',
          marginBottom: theme.spacing.xs,
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          color: isUrgent ? theme.colors.text.onBrand : theme.colors.text.secondary,
          fontSize: theme.type('bodyM').size,
          lineHeight: theme.type('bodyM').lineHeight,
          fontFamily: theme.type('bodyM').family,
          opacity: isUrgent ? 0.92 : 1,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// WeeklySnapshot — static heuristic copy. Gated for Tier-C swap in
// Sprint 11 via FEATURE_TIER_C_SNAPSHOT (currently false).
// -----------------------------------------------------------------------------

const FEATURE_TIER_C_SNAPSHOT = false;

function WeeklySnapshot({ parents, theme }: { parents: ParentSummary[]; theme: Theme }) {
  if (FEATURE_TIER_C_SNAPSHOT) {
    // Sprint 11 wires this to docs/07-ai-assistant.md Tier C.
    return null;
  }
  const mostActive = parents.find((p) => p.recentReadings.length >= 3);
  if (!mostActive) return null;
  const avg = averageRecent(mostActive.recentReadings.slice(0, 7));
  if (!avg) return null;

  const title = theme.type('label');
  const body = theme.type('bodyM');

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radii.m,
        padding: theme.spacing.l,
        marginBottom: theme.spacing.xl,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: title.size,
          fontFamily: title.family,
          fontWeight: title.weight as '500',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: theme.spacing.xs,
        }}
      >
        This week so far
      </Text>
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: body.size,
          lineHeight: body.lineHeight,
          fontFamily: body.family,
        }}
      >
        {`${mostActive.parentDisplayName}'s average is ${avg.systolic}/${avg.diastolic}. ${calmTrendCopy(avg.trend)}`}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// ParentCard — wraps ReadingCard + sparkline. Each card is a single
// tap target routing to the parent's reading list (or reading detail
// if there's a latest reading).
// -----------------------------------------------------------------------------

function ParentCard({
  parent,
  hasPairedDevice,
  onPress,
  onPairPress,
  theme,
}: {
  parent: ParentSummary;
  hasPairedDevice: boolean;
  onPress: (reading: ReadingSummary) => void;
  onPairPress: () => void;
  theme: Theme;
}) {
  if (!parent.latestReading) {
    return (
      <NoReadingsCard
        parent={parent}
        hasPairedDevice={hasPairedDevice}
        onPairPress={onPairPress}
        theme={theme}
      />
    );
  }
  const localReading = readingSummaryToLocal(parent.latestReading);
  return (
    <View>
      <ReadingCard
        reading={localReading}
        ownerVariant="parent"
        parentName={parent.parentDisplayName}
        parentRelationship={parent.parentRelationship}
        onPress={() => onPress(parent.latestReading!)}
        testID={`parent-card-${parent.familyId}`}
      />
      {parent.recentReadings.length >= 3 ? (
        <View
          style={{
            marginTop: -theme.spacing.s,
            paddingHorizontal: theme.spacing.l,
            paddingTop: theme.spacing.s,
            paddingBottom: theme.spacing.l,
            backgroundColor: theme.colors.surface.subtle,
            borderBottomLeftRadius: theme.radii.m,
            borderBottomRightRadius: theme.radii.m,
          }}
          accessible={false}
        >
          <Sparkline
            values={parent.recentReadings.map((r) => r.systolic)}
            width={300}
            height={36}
            testID={`parent-sparkline-${parent.familyId}`}
          />
        </View>
      ) : null}
    </View>
  );
}

function NoReadingsCard({
  parent,
  hasPairedDevice,
  onPairPress,
  theme,
}: {
  parent: ParentSummary;
  hasPairedDevice: boolean;
  onPairPress: () => void;
  theme: Theme;
}) {
  const title = theme.type('title');
  const body = theme.type('bodyM');
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface.subtle,
        borderRadius: theme.radii.m,
        padding: theme.spacing.l,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: title.size,
          fontFamily: title.family,
          fontWeight: title.weight as '600',
          marginBottom: theme.spacing.xs,
        }}
      >
        {parent.parentDisplayName}
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: body.size,
          lineHeight: body.lineHeight,
          fontFamily: body.family,
          marginBottom: theme.spacing.l,
        }}
      >
        {hasPairedDevice
          ? `${parent.parentDisplayName}'s readings will appear here once the watch syncs.`
          : `${parent.parentDisplayName}'s watch will start syncing as soon as it's paired.`}
      </Text>
      {!hasPairedDevice ? (
        <Button
          variant="primary"
          onPress={onPairPress}
          accessibilityLabel="Pair the watch"
          testID={`parent-card-pair-${parent.familyId}`}
        >
          Pair watch
        </Button>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Empty + skeleton states
// -----------------------------------------------------------------------------

function EmptyNoParents({ theme }: { theme: Theme }) {
  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  return (
    <View
      style={{
        marginTop: theme.spacing.xxxxl,
        paddingHorizontal: theme.spacing.xl,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: headline.size,
          lineHeight: headline.lineHeight,
          fontFamily: headline.family,
          fontWeight: headline.weight as '700',
          textAlign: 'center',
          marginBottom: theme.spacing.m,
        }}
      >
        Your family circle is quiet for now
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: body.size,
          lineHeight: body.lineHeight,
          fontFamily: body.family,
          textAlign: 'center',
        }}
      >
        Add a family member to start sharing care.
      </Text>
    </View>
  );
}

function Skeleton({ theme }: { theme: Theme }) {
  return (
    <View style={{ gap: theme.spacing.xl }}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: theme.colors.surface.subtle,
            borderRadius: theme.radii.m,
            padding: theme.spacing.l,
            opacity: 0.6,
          }}
        >
          <View
            style={{
              width: '40%',
              height: 18,
              backgroundColor: theme.colors.border.default,
              borderRadius: theme.radii.s,
              marginBottom: theme.spacing.m,
            }}
          />
          <View
            style={{
              width: '50%',
              height: 36,
              backgroundColor: theme.colors.border.default,
              borderRadius: theme.radii.s,
              marginBottom: theme.spacing.s,
            }}
          />
          <View
            style={{
              width: '30%',
              height: 14,
              backgroundColor: theme.colors.border.default,
              borderRadius: theme.radii.s,
            }}
          />
        </View>
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function pickAnomaly(parents: ParentSummary[]): AnomalyState | null {
  // most-severe-wins per docs/04-screens/caregiver-home.md "only ONE
  // banner visible at a time".
  let best: AnomalyState | null = null;
  for (const p of parents) {
    const r = p.latestReading;
    if (!r) continue;
    const tier = classifyReading(
      { systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse },
      null,
    ).tier;
    if (tier === 'in_pattern') continue;
    if (tier === 'confirmed_urgent') {
      return {
        tier,
        parentName: p.parentDisplayName,
        readingId: r.id,
      };
    }
    if (!best && tier === 'calm_concerned') {
      best = {
        tier,
        parentName: p.parentDisplayName,
        readingId: r.id,
      };
    }
  }
  return best;
}

function averageRecent(rs: ReadingSummary[]): {
  systolic: number;
  diastolic: number;
  trend: 'in_line' | 'higher' | 'lower';
} | null {
  if (rs.length === 0) return null;
  const sys = Math.round(rs.reduce((a, r) => a + r.systolic, 0) / rs.length);
  const dia = Math.round(rs.reduce((a, r) => a + r.diastolic, 0) / rs.length);
  // Trend = first half vs second half. Diff > 4 mmHg systolic = noticeable.
  const half = Math.floor(rs.length / 2);
  if (half === 0) return { systolic: sys, diastolic: dia, trend: 'in_line' };
  const recent = rs.slice(0, half).reduce((a, r) => a + r.systolic, 0) / half;
  const earlier = rs.slice(half).reduce((a, r) => a + r.systolic, 0) / (rs.length - half);
  const delta = recent - earlier;
  const trend: 'in_line' | 'higher' | 'lower' =
    delta > 4 ? 'higher' : delta < -4 ? 'lower' : 'in_line';
  return { systolic: sys, diastolic: dia, trend };
}

function calmTrendCopy(trend: 'in_line' | 'higher' | 'lower'): string {
  switch (trend) {
    case 'in_line':
      return 'In line with last week.';
    case 'higher':
      return 'A little higher than last week.';
    case 'lower':
      return 'A little lower than last week.';
  }
}

function readingSummaryToLocal(r: ReadingSummary): LocalReading {
  // Synthesise a LocalReading shape so ReadingCard renders without
  // changes. Classification recomputes for the badge; serverId is
  // non-null because this came from the server.
  const measuredAtSec = Math.floor(Date.parse(r.measuredAt) / 1000);
  const classification = classifyReading(
    { systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse },
    null,
  );
  return {
    localId: r.id,
    serverId: r.id,
    measuredAtSec,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    source: 'watch',
    classification,
    deviceBleId: null,
    capturedAtMs: measuredAtSec * 1000,
  };
}

function mergeLocalLatest(
  parents: ParentSummary[],
  local: LocalReading | null,
): ParentSummary[] {
  if (!local || parents.length === 0) return parents;
  // Prepend local-latest into the first family if it's newer than that
  // family's current latest. The owning phone has exactly one family
  // for a single-watch household; multi-family caregivers aren't the
  // owning phone for >1 watch (intent memo §1).
  const first = parents[0];
  const firstLatestSec = first.latestReading
    ? Math.floor(Date.parse(first.latestReading.measuredAt) / 1000)
    : 0;
  if (local.measuredAtSec <= firstLatestSec) return parents;
  const localAsSummary: ReadingSummary = {
    id: local.localId,
    measuredAt: new Date(local.measuredAtSec * 1000).toISOString(),
    systolic: local.systolic,
    diastolic: local.diastolic,
    pulse: local.pulse,
    qualityScore: null,
  };
  const merged: ParentSummary = {
    ...first,
    latestReading: localAsSummary,
    recentReadings: [localAsSummary, ...first.recentReadings].slice(0, 14),
  };
  return [merged, ...parents.slice(1)];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});

// Re-export for tests + future imports
export { mergeLocalLatest, pickAnomaly, averageRecent };
export type { AnomalyState };
