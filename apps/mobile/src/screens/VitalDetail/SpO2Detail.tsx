// SpO2Detail — Sprint 8.5 (vital-detail screens, D13 §8.4).
//
// Per-vital detail surface for blood oxygen. Composes the Sprint 8.5
// foundation primitives (DetailShell, VitalHero, StatTrio, VitalTrendChart,
// VitalInsightCard, RecentReadingsList) into the SpO2 layout from the
// design's leiko-detail-screens.jsx (lines 190–242).
//
// Voice rules (docs/05-voice-and-claims.md) — SpO2 is the closest
// surface to a clinical signal in the entire app, so the bar is higher:
//   - Frame any low value as "worth mentioning at your next visit" or
//     "share with your doctor" — never "dangerous", "critical",
//     "abnormal", or "low oxygen" alone.
//   - "Wellness oxygen estimate", never "medical-grade SpO2" or
//     "clinical SpO2".
//   - For overnight dips, lean on "Healthy sleep often shows small,
//     transient dips like this" framing.
//   - Forbidden everywhere: patient, diagnose, predict, dangerous,
//     critical, silent killer, medical-grade, clinical SpO2, loved one,
//     you may have, we detected, abnormal.
//
// Tier-aware copy:
//   - in_pattern        → "Steady through the night" + reassuring insight.
//   - calm_concerned    → "Worth a look — share with your doctor at your
//                          next visit." + insight that names the dip
//                          calmly and points to the next visit.
//   - confirmed_urgent  → "We recommend talking to your doctor soon."
//                          + insight phrased per the spec ("held below 90
//                          on a few recent nights — worth mentioning at
//                          your next doctor visit"). Still calm, never
//                          panicky; matches Tone D from D5 §3.5.
//   - null              → empty welcome state (no chart, no readings).
//
// Sprint 8.5 ships a placeholder data path: the chart prefers real
// overnight samples from `useSpO2().recent` when available; otherwise it
// falls back to the design's mock array so the surface still reads
// completely. Sprint 12.5 wires the real generator.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailShell } from '../../components/DetailShell';
import { VitalHero } from '../../components/VitalHero';
import { StatTrio } from '../../components/StatTrio';
import { VitalTrendChart } from '../../components/VitalTrendChart';
import { VitalInsightCard } from '../../components/VitalInsightCard';
import { type RecentReading } from '../../components/RecentReadingsList';
import { RecentReadingsSection } from '../../components/RecentReadingsSection';
import { useDailyPulseData } from '../../state/dailyPulse';
import { useSpO2 } from '../../state/spo2';
import { spo2Fill } from '../../utils/vitalThemes';
import { useTheme } from '../../theme';
import type { ClassificationTier } from '../../utils/classification';
import type { SpO2Sample } from '../../types/vitals';

export interface SpO2DetailProps {
  onBack: () => void;
}

// Design fallback — used only when the user has no real overnight samples
// yet but we still want to show a populated chart on the very first visit.
// Sprint 8.5 design source: leiko-detail-screens.jsx line 193.
const FALLBACK_OVERNIGHT_SAMPLES = [97, 97, 96, 95, 94, 95, 96, 97, 97, 98, 98];
const OVERNIGHT_DISPLAY_POINTS = 11;
const OVERNIGHT_WINDOW_START_HOUR = 22;
const OVERNIGHT_WINDOW_END_HOUR = 6;

interface RangeCopy {
  /** Hero `range` line under the value. */
  hero: string;
  /** Voice-clean Insight body for this tier. */
  insight: string;
}

/**
 * Tier → copy. Every string here passes the docs/05-voice-and-claims.md
 * rules. The confirmed-urgent line still uses the calm Direct tone (D5
 * §3.5 Tone D) — it does not say "dangerous" or "critical".
 */
function copyForTier(
  tier: ClassificationTier | null | undefined,
): RangeCopy {
  switch (tier) {
    case 'in_pattern':
      return {
        hero: 'Steady through the night',
        insight:
          "Your oxygen saturation held steady through the night with one brief dip around 4 am — nothing unusual. Healthy sleep often shows small, transient dips like this.",
      };
    case 'calm_concerned':
      return {
        hero: 'Worth a look — share with your doctor at your next visit',
        insight:
          'Your overnight oxygen has held below 92% on a few recent nights. Worth mentioning at your next doctor visit.',
      };
    case 'confirmed_urgent':
      return {
        hero: 'We recommend talking to your doctor soon',
        insight:
          'Your overnight oxygen has held below 90 on a few recent nights — worth mentioning at your next doctor visit.',
      };
    default:
      return {
        hero: 'No oxygen samples yet today',
        insight:
          'Wear the watch overnight to start tracking your oxygen. We will surface an estimate of your overnight pattern after the first night.',
      };
  }
}

/**
 * Pulls the latest overnight-window samples (22:00–06:00 UTC, matching
 * the spo2 slice's window) and returns the most recent N percent values
 * in chronological order. If we have fewer than 3 real overnight points,
 * returns the design fallback so the chart still reads.
 *
 * Pure helper — exported for potential reuse / tests.
 */
export function buildOvernightSeries(
  pendingAndRecent: readonly SpO2Sample[],
  points: number = OVERNIGHT_DISPLAY_POINTS,
): number[] {
  const overnight = pendingAndRecent
    .filter((s) => {
      const hr = new Date(s.measuredAtSec * 1000).getUTCHours();
      return (
        hr >= OVERNIGHT_WINDOW_START_HOUR || hr < OVERNIGHT_WINDOW_END_HOUR
      );
    })
    .slice()
    .sort((a, b) => a.measuredAtSec - b.measuredAtSec);

  if (overnight.length < 3) {
    return FALLBACK_OVERNIGHT_SAMPLES.slice(-points);
  }
  return overnight.slice(-points).map((s) => s.percent);
}

/**
 * Pulls the last N awake-window (07:00–21:00 UTC) samples for the recent
 * readings list. Awake samples are what the user took on-demand; they
 * read more naturally in the list than overnight averages.
 */
function buildRecentList(
  pendingAndRecent: readonly SpO2Sample[],
  overnightLowsRecent: readonly number[],
): RecentReading[] {
  if (pendingAndRecent.length === 0 && overnightLowsRecent.length === 0) {
    return [];
  }

  // Most recent sample = "Just now" headline row.
  const sortedByRecency = pendingAndRecent
    .slice()
    .sort((a, b) => b.measuredAtSec - a.measuredAtSec);
  const newest = sortedByRecency[0] ?? null;

  // Last overnight low for "Overnight average" context.
  const lastOvernightLow =
    overnightLowsRecent.length > 0
      ? overnightLowsRecent[overnightLowsRecent.length - 1]
      : null;

  // Pick a couple of distinct awake-window samples for the tail rows.
  const awake = sortedByRecency.filter((s) => {
    const hr = new Date(s.measuredAtSec * 1000).getUTCHours();
    return (
      hr >= OVERNIGHT_WINDOW_END_HOUR && hr < OVERNIGHT_WINDOW_START_HOUR
    );
  });

  const rows: RecentReading[] = [];
  if (newest) {
    rows.push({
      id: `spo2-${newest.measuredAtSec}`,
      value: `${newest.percent}%`,
      context: 'Just now',
      time: formatTimeShort(newest.measuredAtSec),
    });
  }
  if (lastOvernightLow !== null) {
    rows.push({
      id: 'spo2-overnight-avg',
      value: `${lastOvernightLow}%`,
      context: 'Overnight low',
      time: 'last night',
    });
  }
  for (const s of awake.slice(1, 3)) {
    rows.push({
      id: `spo2-${s.measuredAtSec}`,
      value: `${s.percent}%`,
      context: 'Awake reading',
      time: formatDayShort(s.measuredAtSec),
    });
  }
  // Pass full list — RecentReadingsSection handles slicing + the picker.
  return rows;
}

/** "6:42 am" / "10:08 pm" — locale-light, deterministic. */
function formatTimeShort(sec: number): string {
  const d = new Date(sec * 1000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/** "Mon" / "Sun" — short weekday for older samples. */
function formatDayShort(sec: number): string {
  const d = new Date(sec * 1000);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function SpO2Detail({ onBack }: SpO2DetailProps) {
  const data = useDailyPulseData();
  const spo2Pending = useSpO2((s) => s.pending);
  const spo2Recent = useSpO2((s) => s.recent);

  const latestPercent = data.spo2.latestPercent;
  const tier = data.spo2.classification?.tier ?? null;
  const isEmpty = latestPercent === null;
  const range = copyForTier(tier);

  const allSamples = useMemo(
    () => [...spo2Pending, ...spo2Recent],
    [spo2Pending, spo2Recent],
  );

  // Overnight chart series — real data when present, otherwise the
  // design fallback so the screen reads fully on a fresh install.
  const overnightSeries = useMemo(
    () => buildOvernightSeries(allSamples),
    [allSamples],
  );

  // Stat-trio values — derived from real data when we have it; the
  // design's exact labels are preserved for tone consistency. The "—"
  // fallback covers the early-data path.
  const overnightLows = data.spo2.overnightLowsRecent;
  const lastOvernightLow =
    overnightLows.length > 0
      ? overnightLows[overnightLows.length - 1]
      : null;
  const overnightAvg = useMemo(() => {
    if (overnightSeries.length === 0) return null;
    const sum = overnightSeries.reduce((a, b) => a + b, 0);
    return Math.round(sum / overnightSeries.length);
  }, [overnightSeries]);
  const lowest = lastOvernightLow ?? Math.min(...overnightSeries);
  const awakeAvg = latestPercent;

  const recentRows = useMemo(
    () => buildRecentList(allSamples, overnightLows),
    [allSamples, overnightLows],
  );

  return (
    <DetailShell
      vital="spo2"
      onBack={onBack}
      testID="spo2-detail"
      hero={
        <VitalHero
          vital="spo2"
          primary={latestPercent === null ? '—' : String(latestPercent)}
          secondary={latestPercent === null ? undefined : '%'}
          sub={
            isEmpty ? 'No oxygen samples yet' : 'Now · oxygen saturation'
          }
          range={range.hero}
          ringFill={spo2Fill(latestPercent)}
          livePulse={false}
          testID="spo2-detail-hero"
        />
      }
    >
      {isEmpty ? (
        <>
          <EmptyHelperLine />
          <VitalInsightCard
            vital="spo2"
            body={range.insight}
            testID="spo2-detail-insight"
          />
        </>
      ) : (
        <>
          <StatTrio
            testID="spo2-detail-trio"
            items={[
              {
                label: 'Overnight avg',
                value: overnightAvg !== null ? String(overnightAvg) : '—',
                unit: '%',
              },
              {
                label: 'Lowest',
                value: Number.isFinite(lowest) ? String(lowest) : '—',
                unit: 'briefly · 4 am',
              },
              {
                label: 'Awake avg',
                value: awakeAvg !== null ? String(awakeAvg) : '—',
                unit: '%',
              },
            ]}
          />

          <View style={{ paddingHorizontal: 20 }}>
            <VitalTrendChart
              vital="spo2"
              data={overnightSeries}
              range={[95, 100]}
              caption="Overnight · oxygen"
              subCaption="95–100 band"
              peak
              trough
              testID="spo2-detail-chart"
            />
          </View>

          <VitalInsightCard
            vital="spo2"
            body={range.insight}
            testID="spo2-detail-insight"
          />

          <RecentReadingsSection
            vital="spo2"
            eyebrow="Recent readings"
            readings={recentRows}
            testID="spo2-detail-readings"
          />
        </>
      )}
    </DetailShell>
  );
}

/**
 * Empty-state helper line — calm welcome copy, not "no data". Voice
 * rules: leads with what *will* happen, not what's missing.
 */
function EmptyHelperLine() {
  const theme = useTheme();
  const captionStyle = theme.type('caption');
  return (
    <View style={[styles.emptyHelper, { paddingHorizontal: 20 }]}>
      <Text
        style={{
          fontFamily: theme.fontFamilies.numeric,
          fontSize: captionStyle.size,
          lineHeight: captionStyle.lineHeight,
          color: theme.colors.text.tertiary,
          textAlign: 'center',
          letterSpacing: 0.4,
        }}
      >
        Wear the watch overnight to start tracking your oxygen.
      </Text>
    </View>
  );
}


const styles = StyleSheet.create({
  emptyHelper: {
    alignItems: 'center',
  },
});
