// HRDetail — Sprint 8.5 (per-vital detail screen).
//
// One of five vital-detail screens (BP, HR, SpO2, Sleep, Activity). Built
// on the shared DetailShell + VitalHero + StatTrio + VitalTrendChart +
// VitalInsightCard primitives, plus the HR-specific HRZonesCard and a
// CorrelationStrip for sleep × resting-HR.
//
// Composition (per the brief):
//   1. VitalHero — vital="hr"; resting bpm + ring fill
//   2. StatTrio — Resting / Peak / Variability
//   3. VitalTrendChart — continuous HR through the day
//   4. HRZonesCard — 4-tier time-in-zones
//   5. CorrelationStrip — sleep × resting HR over the last 7 days (hidden
//      when either series has no data)
//   6. VitalInsightCard — Tier-B placeholder copy about HR + sleep
//
// Empty state (no resting bpm yet today): hero shows "—" + a calm
// onboarding line; trend chart + zones card are skipped; the correlation
// strip still renders if both vitals have history; insight card carries
// a welcome paragraph.
//
// Voice rules (docs/05-voice-and-claims.md): every user-visible string
// in this file is voice-checked. Forbidden: "patient", "diagnose",
// "predict", "dangerous level", "critical level", "silent killer", "you
// may have", "we detected", "loved one", "smartwatch". Preferred: "your
// reading", "talk to your doctor", calm/reassuring framing.
//
// Stack pin (docs/00-tech-stack.md): RN 0.81.5, react-native-svg 15.x,
// react-native-reanimated v3, phosphor-react-native v3. No new deps.

import { useMemo } from 'react';
import { DetailShell } from '../../components/DetailShell';
import { VitalHero } from '../../components/VitalHero';
import { StatTrio } from '../../components/StatTrio';
import { VitalTrendChart } from '../../components/VitalTrendChart';
import { VitalInsightCard } from '../../components/VitalInsightCard';
import { VitalExplainerAnchor } from '../../components/VitalExplainerAnchor';
import {
  CorrelationStrip,
  type VitalSeries,
} from '../../components/CorrelationStrip';
import { HRZonesCard, type HRZone } from '../../components/HRZonesCard';
import { useDailyPulseData } from '../../state/dailyPulse';
import { useHR } from '../../state/hr';
import { useSleep } from '../../state/sleep';
import { hrFill } from '../../utils/vitalThemes';
import { checkStaleness } from '../../utils/classification';
import { formatStalenessCaption } from '../../utils/stalenessCaption';
import type { HRSample, SleepSession } from '../../types/vitals';

const SECONDS_PER_DAY = 24 * 60 * 60;
const TREND_RANGE_BPM: [number, number] = [60, 95];

/**
 * Build the trend-chart series for "today". Bins all available HR samples
 * for the last 24h and returns up to 16 evenly spaced rolling-average
 * points. Returns an empty array when there are < 2 samples — the trend
 * chart hides itself in that case.
 */
export function buildTodayTrendData(
  samples: ReadonlyArray<HRSample>,
  nowSec: number,
): number[] {
  if (samples.length < 2) return [];
  const cutoff = nowSec - SECONDS_PER_DAY;
  const todays = samples
    .filter((s) => s.measuredAtSec >= cutoff && s.measuredAtSec <= nowSec)
    .sort((a, b) => a.measuredAtSec - b.measuredAtSec);
  if (todays.length < 2) return [];
  // Bin into ~16 buckets across the 24h window — matches the design's
  // 16-point sample. Each bucket carries the bucket-mean BPM; empty
  // buckets fall back to the previous bucket's value (so the line stays
  // continuous instead of going to zero).
  const BUCKETS = 16;
  const bucketSpan = SECONDS_PER_DAY / BUCKETS;
  const sums = new Array<number>(BUCKETS).fill(0);
  const counts = new Array<number>(BUCKETS).fill(0);
  for (const s of todays) {
    const idx = Math.min(
      BUCKETS - 1,
      Math.max(0, Math.floor((s.measuredAtSec - cutoff) / bucketSpan)),
    );
    sums[idx] += s.bpm;
    counts[idx] += 1;
  }
  const out: number[] = [];
  let last = todays[0].bpm;
  for (let i = 0; i < BUCKETS; i++) {
    if (counts[i] > 0) {
      last = sums[i] / counts[i];
      out.push(Math.round(last));
    } else {
      out.push(Math.round(last));
    }
  }
  return out;
}

/**
 * Compute the four HR zones from a window of samples. Each zone carries
 * the share of samples falling into its BPM band. When the input is
 * empty, returns four zones with pct = 0 (the consumer can hide the card).
 */
export function buildZones(samples: ReadonlyArray<HRSample>): [HRZone, HRZone, HRZone, HRZone] {
  let resting = 0;
  let calm = 0;
  let active = 0;
  let vigorous = 0;
  for (const s of samples) {
    if (s.bpm < 60) resting += 1;
    else if (s.bpm < 80) calm += 1;
    else if (s.bpm < 110) active += 1;
    else vigorous += 1;
  }
  const total = resting + calm + active + vigorous;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  return [
    { name: 'Resting', range: '< 60', pct: pct(resting) },
    { name: 'Calm', range: '60–80', pct: pct(calm) },
    { name: 'Active', range: '80–110', pct: pct(active) },
    { name: 'Vigorous', range: '110+', pct: pct(vigorous) },
  ];
}

/**
 * Compute the headline "stats trio" inputs from the live HR data.
 * - Resting: 7-day average of `restingBpmRecent` (rounded; null if empty)
 * - Peak: max bpm in the last 24h (null if no samples)
 * - Variability: not yet derived from the watch firmware — placeholder
 *   "—" until Sprint 15 (HR streaming).
 */
export function buildStats(
  samples: ReadonlyArray<HRSample>,
  restingBpmRecent: ReadonlyArray<number>,
  nowSec: number,
): {
  restingAvg: number | null;
  peakToday: number | null;
} {
  const restingAvg =
    restingBpmRecent.length === 0
      ? null
      : Math.round(
          restingBpmRecent.reduce((a, b) => a + b, 0) / restingBpmRecent.length,
        );
  const cutoff = nowSec - SECONDS_PER_DAY;
  const todays = samples.filter(
    (s) => s.measuredAtSec >= cutoff && s.measuredAtSec <= nowSec,
  );
  const peakToday =
    todays.length === 0
      ? null
      : todays.reduce((a, b) => (b.bpm > a.bpm ? b : a)).bpm;
  return { restingAvg, peakToday };
}

/**
 * Build the seven-day sleep-x-restingHR correlation series. Each day's
 * resting HR is paired with the same day's sleep-session totalMinutes —
 * we anchor on session end-of-day so a 23:00–06:00 session bucketed as
 * "the morning of the 7th" lines up with the resting HR computed from
 * that same window. Returns null when either side has < 2 days of data.
 */
export function buildSleepHRCorrelation(
  hrRecent: ReadonlyArray<number>,
  sleepSessions: ReadonlyArray<SleepSession>,
): { hr: VitalSeries; sleep: VitalSeries } | null {
  if (hrRecent.length < 2 || sleepSessions.length < 2) return null;
  // The HR slice produces `restingBpmRecent` ordered oldest → newest. For
  // sleep, we anchor by sessionEndSec and take the most recent 7 ordered
  // oldest → newest. We then truncate both to the same length so the t
  // axis lines up index-by-index.
  const sleepOrdered = [...sleepSessions].sort(
    (a, b) => a.sessionEndSec - b.sessionEndSec,
  );
  const recentSleep = sleepOrdered.slice(-7);
  const recentHR = hrRecent.slice(-7);
  const n = Math.min(recentSleep.length, recentHR.length);
  if (n < 2) return null;
  const sleepWindow = recentSleep.slice(-n);
  const hrWindow = recentHR.slice(-n);
  const hr: VitalSeries = {
    type: 'hr',
    points: hrWindow.map((v, i) => ({ t: i, value: v })),
  };
  const sleep: VitalSeries = {
    type: 'sleep',
    points: sleepWindow.map((s, i) => ({ t: i, value: s.totalMinutes })),
  };
  return { hr, sleep };
}

const INSIGHT_BODY_HAS_DATA =
  "Your resting heart rate has settled three points lower than last month. That tracks with the better sleep we've seen — they tend to move together. A calm wake again this morning.";

const INSIGHT_BODY_EMPTY =
  "Wear the watch to start tracking your heart rate. After a few nights of sleep, you'll see how it moves with your rest.";

export interface HRDetailProps {
  onBack: () => void;
  onArticleOpen?: (articleId: string) => void;
  onLearnOpen?: () => void;
}

export function HRDetail({ onBack, onArticleOpen, onLearnOpen }: HRDetailProps) {
  const data = useDailyPulseData();
  const restingToday = data.hr.restingToday;

  // Pull the live HR samples + the recent restingBpm series + last sleep
  // sessions. These selectors return the underlying arrays; for the
  // composed inputs (stats, zones, trend) we re-derive on every render —
  // these are O(samples) over short windows and the screen renders
  // infrequently. Sprint 9 introduces memoised selector hooks if needed.
  const hrPending = useHR((s) => s.pending);
  const hrRecent = useHR((s) => s.recent);
  const sleepPending = useSleep((s) => s.pending);
  const sleepRecent = useSleep((s) => s.recent);

  const allSamples = useMemo(
    () => [...hrPending, ...hrRecent],
    [hrPending, hrRecent],
  );
  const allSleepSessions = useMemo(
    () => [...sleepPending, ...sleepRecent],
    [sleepPending, sleepRecent],
  );

  const nowSec = Math.floor(Date.now() / 1000);

  const trendData = useMemo(
    () => buildTodayTrendData(allSamples, nowSec),
    [allSamples, nowSec],
  );
  const zones = useMemo(() => buildZones(allSamples), [allSamples]);
  const { restingAvg, peakToday } = useMemo(
    () =>
      buildStats(
        allSamples,
        // restingBpmRecent is computed on the slice; we ask for it
        // explicitly via getState() since it's a derived selector.
        useHR.getState().restingBpmRecent(nowSec),
        nowSec,
      ),
    [allSamples, nowSec],
  );

  const correlation = useMemo(
    () =>
      buildSleepHRCorrelation(
        useHR.getState().restingBpmRecent(nowSec),
        allSleepSessions,
      ),
    [allSleepSessions, nowSec],
  );

  const hasData = restingToday !== null;
  const hasZoneData = zones.some((z) => z.pct > 0);

  // Sprint 16 — per D13 §6.6, surface a stale caption when the latest
  // HR sample is older than 6h.
  const staleness = hasData
    ? checkStaleness('hr', data.hr.latestSampleSec, nowSec)
    : 'no_data';
  const staleCaption =
    staleness === 'stale'
      ? formatStalenessCaption(data.hr.latestSampleSec, nowSec)
      : null;

  // Hero copy — voice-rule clean. "Within your range" lifts from the
  // design source; the empty-state copy is plain language with no fear
  // framing per docs/05-voice-and-claims.md.
  const heroPrimary = hasData ? String(Math.round(restingToday!)) : '—';
  const heroSub = staleCaption ?? (hasData ? 'Now · resting' : 'Heart rate');
  const heroRange = hasData
    ? 'bpm · within your range'
    : 'Wear the watch to start tracking your heart rate.';

  return (
    <DetailShell
      vital="hr"
      onBack={onBack}
      hero={
        <VitalHero
          vital="hr"
          primary={heroPrimary}
          sub={heroSub}
          range={heroRange}
          ringFill={hrFill(restingToday)}
          livePulse={false}
          testID="hr-detail-hero"
        />
      }
      testID="hr-detail"
    >
      <StatTrio
        items={[
          {
            label: 'Resting',
            value: restingAvg !== null ? String(restingAvg) : '—',
            unit: restingAvg !== null ? 'bpm avg' : 'bpm',
          },
          {
            label: 'Peak',
            value: peakToday !== null ? String(peakToday) : '—',
            unit: peakToday !== null ? 'today' : 'bpm',
          },
          {
            label: 'Variability',
            value: '—',
            unit: 'ms',
          },
        ]}
        testID="hr-detail-stats"
      />

      {trendData.length > 0 ? (
        <VitalTrendChart
          vital="hr"
          data={trendData}
          range={TREND_RANGE_BPM}
          caption="Today · resting HR"
          subCaption="60–95 band"
          peak
          trough
          testID="hr-detail-trend"
          style={{ marginHorizontal: 20 }}
        />
      ) : null}

      {hasZoneData ? (
        <HRZonesCard
          zones={zones}
          testID="hr-detail-zones"
        />
      ) : null}

      {correlation ? (
        <CorrelationStrip
          vitalA={correlation.sleep}
          vitalB={correlation.hr}
          range="7d"
          caption="Sleep × resting HR — last 7 days"
          testID="hr-detail-correlation"
          style={{ marginHorizontal: 20 }}
        />
      ) : null}

      <VitalInsightCard
        vital="hr"
        body={hasData ? INSIGHT_BODY_HAS_DATA : INSIGHT_BODY_EMPTY}
        testID="hr-detail-insight"
      />

      <VitalExplainerAnchor
        context={{ type: 'hr', restingHr: restingToday ?? null }}
        onArticleOpen={onArticleOpen}
        onLearnOpen={onLearnOpen}
        testID="hr-detail-explainer-anchor"
      />
    </DetailShell>
  );
}
