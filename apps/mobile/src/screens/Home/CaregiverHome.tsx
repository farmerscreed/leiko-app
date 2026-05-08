// Caregiver Home — Sprint 7.7a (Family Constellation, bird's-eye view).
//
// Replaces the BP-only Sprint 7 card-stack home with the Family
// Constellation design (`leiko-caregiver-unified.html`). Each loved one
// is a glowing orb in a starfield around a centre "You" mark. A legend
// below carries status pills + headlines. The bottom action bar offers
// "+ Add someone" when the caregiver has invite capacity.
//
// Sprint 7.7b will add the editorial-card view + segmented toggle +
// cinematic transition. The MMKV-backed view-preference hook is plumbed
// here (`useCaregiverViewMode`) but only `birds` renders in 7.7a — the
// `cards` branch is wired in 7.7b.
//
// Drill-in: tapping any orb (or legend row) navigates to ReadingDetail
// for that parent's latest reading, matching the legacy behaviour.
// Sprint 8.5 will introduce a per-parent immersive DailyPulseHero
// screen as the proper drill target.
//
// Voice rules (docs/05-voice-and-claims.md): every user-visible string
// here is calm + plain + in-voice. No "patient", no fear language.
// "+ Add someone" / "all in your circle" / "Your family circle is quiet
// for now" / "Add a family member to start sharing care." — all
// existing voice-rule-clean copy preserved from the legacy screen.

import { useCallback, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AnomalyBanner } from '../../components/AnomalyBanner';
import { Button } from '../../components/Button';
import { CaregiverActionBar } from '../../components/CaregiverActionBar';
import {
  ConstellationField,
  type ConstellationPerson,
} from '../../components/ConstellationField';
import {
  ConstellationLegend,
  type LegendPerson,
} from '../../components/ConstellationLegend';
import { useCaregiverFamily } from '../../hooks/useCaregiverFamily';
import { useCaregiverViewMode } from '../../hooks/useCaregiverViewMode';
import { useTheme, type Theme } from '../../theme';
import { usePairing } from '../../state/pairing';
import { useReadings } from '../../state/readings';
import type { CaregiverStackParamList } from '../../navigation/types';
import type {
  ParentSummary,
  ReadingSummary,
} from '../../services/families/fetchParentSummaries';
import type { LocalReading } from '../../state/readings';
import {
  caregiverPeopleFromParents,
  type CaregiverPerson,
} from '../../utils/caregiverPerson';

type Nav = NativeStackNavigationProp<CaregiverStackParamList>;

// Sprint 7.7a wires invite capacity off — `family_owner` capability
// + Plus tier check land alongside Settings work in Sprint 10. Until
// then the "+ Add someone" affordance never renders and the bar shows
// just the count.
const CAN_INVITE_FOR_NOW = false;

export function CaregiverHome() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { parents, people, isLoading, isRefreshing, refresh } = useCaregiverFamily();
  const pairedDevice = usePairing((s) => s.pairedDevice);
  const localLatest = useReadings((s) => s.latest());
  // Plumbed for 7.7b — `viewMode` is intentionally unread here in 7.7a;
  // only the bird's-eye branch renders.
  useCaregiverViewMode();

  // Owning-phone first-paint merge: if local latest is newer than the
  // server view, prepend it. Same logic the legacy screen used.
  const merged = useMemo(
    () => mergeLocalLatest(parents, localLatest),
    [parents, localLatest],
  );
  const mergedPeople = useMemo(
    () =>
      merged === parents
        ? people
        : caregiverPeopleFromParents(merged, Date.now()),
    [merged, parents, people],
  );

  const anomaly = useMemo(() => pickAnomalyForBanner(mergedPeople), [mergedPeople]);

  const handlePersonPress = useCallback(
    (id: string) => {
      const target = merged.find((p) => p.familyId === id);
      if (!target) return;
      if (target.latestReading) {
        navigation.navigate('ReadingDetail', {
          readingLocalId: target.latestReading.id,
        });
      } else if (!pairedDevice) {
        navigation.navigate('Pairing');
      }
      // Has parent, has watch, but no readings yet → no-op for now.
      // Sprint 8.5 routes this to the per-parent immersive view.
    },
    [merged, navigation, pairedDevice],
  );

  const constellationPeople: ConstellationPerson[] = mergedPeople.map((p) => ({
    id: p.id,
    initial: p.initial,
    fullName: p.fullName,
    accent: theme.colors.person[p.accentIndex],
    status: p.status,
    bpLabel: p.bpLabel,
  }));

  const legendPeople: LegendPerson[] = mergedPeople.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    relation: p.relation,
    accent: theme.colors.person[p.accentIndex],
    status: p.status,
    headline: p.headline,
  }));

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: theme.spacing.l,
            paddingTop: theme.spacing.m,
            paddingBottom: theme.spacing.xxxxl + theme.spacing.xxl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.brand.coral}
          />
        }
      >
        <SharedHeader theme={theme} />

        {anomaly ? (
          <View style={{ marginTop: theme.spacing.l }}>
            <AnomalyBanner
              severity={anomaly.severity}
              title={anomaly.title}
              body={anomaly.body}
              cta={{
                label: 'Open reading',
                onPress: () => handlePersonPress(anomaly.personId),
              }}
            />
          </View>
        ) : null}

        {isLoading ? (
          <Skeleton theme={theme} />
        ) : merged.length === 0 ? (
          <EmptyNoFamily theme={theme} />
        ) : (
          <>
            <View style={{ marginTop: theme.spacing.l }}>
              <ConstellationField
                people={constellationPeople}
                onSelectPerson={handlePersonPress}
                testID="caregiver-home-constellation"
              />
            </View>
            <View style={{ marginTop: theme.spacing.xl }}>
              <ConstellationLegend
                people={legendPeople}
                onSelectPerson={handlePersonPress}
                testID="caregiver-home-legend"
              />
            </View>
          </>
        )}
      </ScrollView>

      {merged.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: theme.spacing.l,
            right: theme.spacing.l,
            bottom: theme.spacing.xxl,
          }}
        >
          <CaregiverActionBar
            count={merged.length}
            canInvite={CAN_INVITE_FOR_NOW}
            testID="caregiver-home-action-bar"
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// SharedHeader — eyebrow + date + greeting. Mono uppercase per the design.
// -----------------------------------------------------------------------------

function SharedHeader({ theme }: { theme: Theme }) {
  const dateLabel = useMemo(() => formatHeaderDate(new Date()), []);
  return (
    <View
      accessibilityRole="header"
      style={{ paddingHorizontal: theme.spacing.s, paddingTop: theme.spacing.s }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.m,
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: 9.5,
            letterSpacing: 1.9,
            color: theme.colors.brand.coral,
            textTransform: 'uppercase',
          }}
        >
          Leiko · Family
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: 9.5,
            letterSpacing: 1.3,
            color: theme.colors.text.tertiary,
            textTransform: 'uppercase',
          }}
        >
          {dateLabel}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fontFamilies.numeric,
          fontSize: 9,
          letterSpacing: 1.6,
          color: theme.colors.text.tertiary,
          textTransform: 'uppercase',
        }}
      >
        Good morning
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// AnomalyBanner adapter — most-severe-wins across all family members.
// -----------------------------------------------------------------------------

interface BannerState {
  severity: 'calm-concerned' | 'confirmed-urgent';
  title: string;
  body: string;
  personId: string;
}

function pickAnomalyForBanner(people: CaregiverPerson[]): BannerState | null {
  // Confirmed-urgent wins outright. Otherwise, the first calm-concerned
  // person sets the banner. Order is preserved — caregiver sees the
  // earliest-listed urgent person as the "act now" surface.
  let best: BannerState | null = null;
  for (const p of people) {
    if (p.status === 'urgent') {
      const firstName = p.fullName.split(' ')[0];
      return {
        severity: 'confirmed-urgent',
        title: `Talk to ${firstName} now`,
        body: 'Their latest reading was above their usual range. A calm check-in helps.',
        personId: p.id,
      };
    }
    if (!best && p.status === 'attention') {
      const firstName = p.fullName.split(' ')[0];
      best = {
        severity: 'calm-concerned',
        title: `Worth a chat with ${firstName}`,
        body: "We've noticed a pattern worth a gentle check-in.",
        personId: p.id,
      };
    }
  }
  return best;
}

// -----------------------------------------------------------------------------
// Empty + skeleton states (preserved from the legacy screen, voice-rule-clean).
// -----------------------------------------------------------------------------

function EmptyNoFamily({ theme }: { theme: Theme }) {
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
        allowFontScaling={false}
        style={{
          fontFamily: theme.fontFamilies.editorial,
          fontSize: headline.size,
          lineHeight: headline.lineHeight,
          color: theme.colors.text.primary,
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
          marginBottom: theme.spacing.xxl,
        }}
      >
        Add a family member to start sharing care.
      </Text>
      <Button
        variant="primary"
        onPress={() => undefined}
        accessibilityLabel="Add a family member"
        testID="caregiver-home-add-family"
      >
        Add a family member
      </Button>
    </View>
  );
}

function Skeleton({ theme }: { theme: Theme }) {
  return (
    <View
      style={{
        marginTop: theme.spacing.xxl,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: theme.colors.surface.warmSubtle,
          opacity: 0.4,
        }}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Helpers (re-used from the legacy screen — kept here so this file is
// self-contained; legacy file still exports the original copy).
// -----------------------------------------------------------------------------

function formatHeaderDate(d: Date): string {
  const dayName = d.toLocaleDateString(undefined, { weekday: 'long' });
  const monthName = d.toLocaleDateString(undefined, { month: 'long' });
  return `${dayName} · ${monthName} ${d.getDate()}`;
}

export function mergeLocalLatest(
  parents: ParentSummary[],
  local: LocalReading | null,
): ParentSummary[] {
  if (!local || parents.length === 0) return parents;
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

export { pickAnomalyForBanner };

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
