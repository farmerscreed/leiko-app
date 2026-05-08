// BPDetail — Sprint 8.5 (per-vital detail screens, BP slice).
//
// Composition (top → bottom), per docs/04-screens/vital-detail-bp.md +
// design source `leiko-detail-screens.jsx` lines 4-111:
//
//   1. DetailShell                 — owns back chevron, vital-tinted bg,
//                                    range pills, scroll container
//   2. VitalHero (slot)            — 122/78 ring + classification-aware
//                                    range copy + "Latest · {time}"
//   3. StatTrio                    — 7-day avg · lowest · highest
//   4. BPTwinLineChart (in card)   — today's twin sys/dia hourly chart
//   5. VitalInsightCard            — Tier-B placeholder paragraph
//   6. RecentReadingsList          — last 4 BP readings, tappable
//
// Empty-state branch: when no BP exists (`data.bp.latest === null`),
// the screen renders a calm placeholder VitalHero + welcome
// VitalInsightCard. No chart, no readings list. Range pills still
// render; they are no-ops until data arrives, which matches the
// behaviour the user expects (the pills are still affordable for
// "this is where trends will live").
//
// Voice rules (docs/05-voice-and-claims.md): every visible string in
// this file is reassuring or informative. No "patient", "diagnose",
// "predict", "dangerous", "critical". Calm-concerned copy mirrors the
// existing tier mapping in utils/classification.ts:tierChipText().
//
// Hook surface: this screen is presentational. It pulls data via
// `useDailyPulseData()` + `useReadings()`, but does NOT call
// `useNavigation`. The router (built separately) wires `onBack` +
// `onSelectReading`. Tests can mount the screen directly with mocked
// hooks — no NavigationContainer needed.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailShell } from '../../components/DetailShell';
import { VitalHero } from '../../components/VitalHero';
import { StatTrio, type StatTrioItem } from '../../components/StatTrio';
import { type RecentReading } from '../../components/RecentReadingsList';
import { RecentReadingsSection } from '../../components/RecentReadingsSection';
import { VitalInsightCard } from '../../components/VitalInsightCard';
import { BPTwinLineChart } from '../../components/BPTwinLineChart';
import { useDailyPulseData } from '../../state/dailyPulse';
import { useReadings, type LocalReading } from '../../state/readings';
import { bpFillFromTier } from '../../utils/vitalThemes';
import { useTheme } from '../../theme';
import type { ClassificationTier } from '../../utils/classification';

// ---------------------------------------------------------------------------
// Voice-clean copy
// ---------------------------------------------------------------------------

const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
const SYS_RANGE: [number, number] = [110, 130];

// Sprint 8.5 ships a placeholder Tier-B paragraph; Sprint 12.5 wires the
// real ambient-AI generator. The placeholder paraphrases the design's
// "morning-coffee BP rise" insight in a voice-clean way.
const INSIGHT_BODY_DEFAULT =
  "Your morning numbers tend to climb roughly 8 points after coffee — a normal physiological response. The afternoon dip you usually see is here too. Talk to your doctor if you'd like to understand the morning band.";

const INSIGHT_BODY_EMPTY =
  "Once you take your first reading, this is where you'll see how it lands compared to your usual range. Patterns appear after a few days of readings.";

// Range-line copy keyed to the BP classification tier. Mirrors the
// in-app `tierChipText()` (utils/classification.ts) so the same calm
// vocabulary is used wherever a tier is surfaced. "—" branch handles
// the rare case of a BP reading whose classification is null.
function rangeCopyForTier(tier: ClassificationTier | null | undefined): string {
  switch (tier) {
    case 'in_pattern':
      return 'mmHg · within your range';
    case 'calm_concerned':
      return 'mmHg · worth a look';
    case 'confirmed_urgent':
      return 'mmHg · talk to your doctor today';
    default:
      return 'mmHg';
  }
}

// ---------------------------------------------------------------------------
// Pure formatting helpers — exported for tests
// ---------------------------------------------------------------------------

function formatHeroTime(measuredAtSec: number, nowMs: number = Date.now()): string {
  const d = new Date(measuredAtSec * 1000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const ageHours = (nowMs - d.getTime()) / 3_600_000;
  if (ageHours < 24) {
    return `Latest · ${time}`;
  }
  return `Latest · ${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

function formatRowTime(measuredAtSec: number, nowMs: number = Date.now()): string {
  const d = new Date(measuredAtSec * 1000);
  const ageHours = (nowMs - d.getTime()) / 3_600_000;
  if (ageHours < 24) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (ageHours < 48) {
    return 'Yesterday';
  }
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function rowContext(
  measuredAtSec: number,
  isFirst: boolean,
  nowMs: number = Date.now(),
): string {
  const d = new Date(measuredAtSec * 1000);
  const ageHours = (nowMs - d.getTime()) / 3_600_000;
  const hour = d.getHours();
  const partOfDay =
    hour < 5 ? 'overnight' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  if (isFirst && ageHours < 1) return 'Just now · resting';
  if (ageHours < 24) return `Today ${partOfDay}`;
  if (ageHours < 48) return `Yesterday ${partOfDay}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })} ${partOfDay}`;
}

/** Filters BP readings to those that fell on the local "today" of nowMs. */
export function readingsForToday(
  readings: LocalReading[],
  nowMs: number = Date.now(),
): LocalReading[] {
  const today = new Date(nowMs).toDateString();
  return readings.filter(
    (r) => new Date(r.measuredAtSec * 1000).toDateString() === today,
  );
}

/**
 * Bucket today's readings into the 8 hour-of-day slots used by the
 * BPTwinLineChart axis (12a, 3a, 6a, 9a, 12p, 3p, 6p, 9p). Each bucket
 * is the *average* of the readings landing in it; empty buckets fall
 * back to the design's mock data so the chart never renders an
 * incoherent flat line on partial-day data.
 */
export function bucketReadingsByHour(
  readings: LocalReading[],
  fallbackSys: number[],
  fallbackDia: number[],
): { sys: number[]; dia: number[] } {
  // Slot index = floor(hour / 3) — 8 slots covering 0-23h.
  const sysSums = new Array(8).fill(0) as number[];
  const diaSums = new Array(8).fill(0) as number[];
  const counts = new Array(8).fill(0) as number[];
  for (const r of readings) {
    const hour = new Date(r.measuredAtSec * 1000).getHours();
    const slot = Math.min(7, Math.floor(hour / 3));
    sysSums[slot] += r.systolic;
    diaSums[slot] += r.diastolic;
    counts[slot] += 1;
  }
  const sys = sysSums.map((sum, i) =>
    counts[i] > 0 ? Math.round(sum / counts[i]) : fallbackSys[i],
  );
  const dia = diaSums.map((sum, i) =>
    counts[i] > 0 ? Math.round(sum / counts[i]) : fallbackDia[i],
  );
  return { sys, dia };
}

/** Pure helper: 7-day stats from a list of BP readings. */
export function computeStats(readings: LocalReading[], nowMs: number = Date.now()): {
  avgSys: number | null;
  avgDia: number | null;
  lowSys: number | null;
  lowDia: number | null;
  lowDayLabel: string | null;
  highSys: number | null;
  highDia: number | null;
  highDayLabel: string | null;
} {
  const sevenDaysAgo = nowMs - 7 * 24 * 3_600_000;
  const window = readings.filter((r) => r.measuredAtSec * 1000 >= sevenDaysAgo);
  if (window.length === 0) {
    return {
      avgSys: null,
      avgDia: null,
      lowSys: null,
      lowDia: null,
      lowDayLabel: null,
      highSys: null,
      highDia: null,
      highDayLabel: null,
    };
  }
  const avgSys = Math.round(
    window.reduce((acc, r) => acc + r.systolic, 0) / window.length,
  );
  const avgDia = Math.round(
    window.reduce((acc, r) => acc + r.diastolic, 0) / window.length,
  );
  const low = window.reduce((a, b) => (b.systolic < a.systolic ? b : a));
  const high = window.reduce((a, b) => (b.systolic > a.systolic ? b : a));
  const labelFor = (r: LocalReading) =>
    new Date(r.measuredAtSec * 1000).toLocaleDateString(undefined, {
      weekday: 'short',
    });
  return {
    avgSys,
    avgDia,
    lowSys: low.systolic,
    lowDia: low.diastolic,
    lowDayLabel: labelFor(low),
    highSys: high.systolic,
    highDia: high.diastolic,
    highDayLabel: labelFor(high),
  };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export interface BPDetailProps {
  onBack: () => void;
  /** Wired by the router so a tap on a recent-readings row opens ReadingDetail. */
  onSelectReading?: (localId: string) => void;
}

export function BPDetail({ onBack, onSelectReading }: BPDetailProps) {
  const theme = useTheme();
  const data = useDailyPulseData();
  const recentReadings = useReadings((s) => s.recent);
  const pendingReadings = useReadings((s) => s.pending);

  const allBPReadings = useMemo(
    () => [...pendingReadings, ...recentReadings],
    [pendingReadings, recentReadings],
  );

  const tier = data.bp.classification?.tier ?? null;
  const ringFill = bpFillFromTier(tier);
  const isEmpty = data.bp.latest === null;

  // ----- Hero block ---------------------------------------------------
  const hero = isEmpty ? (
    <VitalHero
      vital="bp"
      primary="—"
      sub="No readings yet"
      range="Take your first reading whenever you're ready."
      ringFill={0}
      testID="bp-detail-hero"
    />
  ) : (
    <VitalHero
      vital="bp"
      primary={String(data.bp.latest!.systolic)}
      secondary={`/ ${data.bp.latest!.diastolic}`}
      sub={
        data.bp.latestSampleSec !== null
          ? formatHeroTime(data.bp.latestSampleSec)
          : 'Latest'
      }
      range={rangeCopyForTier(tier)}
      ringFill={ringFill}
      livePulse={false}
      testID="bp-detail-hero"
    />
  );

  // ----- Stat trio ----------------------------------------------------
  const stats = useMemo(() => computeStats(allBPReadings), [allBPReadings]);
  const statItems: [StatTrioItem, StatTrioItem, StatTrioItem] = [
    {
      label: '7-day avg',
      value:
        stats.avgSys !== null && stats.avgDia !== null
          ? `${stats.avgSys}/${stats.avgDia}`
          : '—',
      unit: 'mmHg',
    },
    {
      label: 'Lowest',
      value:
        stats.lowSys !== null && stats.lowDia !== null
          ? `${stats.lowSys}/${stats.lowDia}`
          : '—',
      unit: stats.lowDayLabel ?? 'last 7 days',
    },
    {
      label: 'Highest',
      value:
        stats.highSys !== null && stats.highDia !== null
          ? `${stats.highSys}/${stats.highDia}`
          : '—',
      unit: stats.highDayLabel ?? 'last 7 days',
    },
  ];

  // ----- Today twin chart ---------------------------------------------
  // Sprint 8.5 ships hour-bucketed averages of today's readings, with
  // the design's mock series as fallback for slots without data. This
  // keeps the chart visually coherent during the cold-start week, then
  // grows organically denser as more readings come in.
  const FALLBACK_SYS = [114, 110, 122, 124, 128, 130, 126, 120];
  const FALLBACK_DIA = [72, 70, 78, 79, 82, 84, 81, 76];
  const todayReadings = useMemo(
    () => readingsForToday(allBPReadings),
    [allBPReadings],
  );
  const { sys, dia } = useMemo(
    () => bucketReadingsByHour(todayReadings, FALLBACK_SYS, FALLBACK_DIA),
    [todayReadings],
  );

  // ----- Recent readings list — full list, sliced by RecentReadingsSection
  // (on-device review 2026-05-08: original sliced to 4; user couldn't
  // reach the rest of their server-side history. Pass everything; the
  // section wrapper owns the visible-count + picker UX).
  const recentRows: RecentReading[] = useMemo(() => {
    return allBPReadings
      .slice()
      .sort((a, b) => b.measuredAtSec - a.measuredAtSec)
      .map((r, idx) => ({
        id: r.localId,
        value: `${r.systolic}/${r.diastolic}`,
        context: rowContext(r.measuredAtSec, idx === 0),
        time: idx === 0 ? 'now' : formatRowTime(r.measuredAtSec),
      }));
  }, [allBPReadings]);

  return (
    <DetailShell
      vital="bp"
      onBack={onBack}
      hero={hero}
      testID="bp-detail"
    >
      {!isEmpty ? (
        <>
          <StatTrio items={statItems} testID="bp-detail-stats" />

          {/* Today twin chart */}
          <View
            style={[
              styles.section,
              { paddingHorizontal: theme.spacing.xl },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.type('labelUppercase').family,
                fontSize: theme.type('labelUppercase').size,
                lineHeight: theme.type('labelUppercase').lineHeight,
                letterSpacing: theme.type('labelUppercase').letterSpacing,
                color: theme.colors.text.tertiary,
                textTransform: 'uppercase',
                marginBottom: theme.spacing.s,
              }}
              testID="bp-detail-chart-eyebrow"
            >
              Today · systolic & diastolic
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.surface.warmSubtle,
                borderColor: theme.colors.border.rim,
                borderRadius: theme.radii.l,
                borderWidth: 0.5,
                padding: theme.spacing.l,
              }}
            >
              <BPTwinLineChart
                vital="bp"
                sys={sys}
                dia={dia}
                hourLabels={HOUR_LABELS}
                range={SYS_RANGE}
                testID="bp-detail-chart"
              />
            </View>
          </View>
        </>
      ) : null}

      <VitalInsightCard
        vital="bp"
        body={isEmpty ? INSIGHT_BODY_EMPTY : INSIGHT_BODY_DEFAULT}
        testID="bp-detail-insight"
      />

      {!isEmpty ? (
        <RecentReadingsSection
          vital="bp"
          eyebrow="Recent readings"
          readings={recentRows}
          onSelect={
            onSelectReading ? (r) => onSelectReading(r.id) : undefined
          }
          testID="bp-detail-readings"
        />
      ) : null}
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  section: {
    // section eyebrow + body wrap; horizontal padding matches the rest
    // of the screen content (hero / stat trio).
  },
});
