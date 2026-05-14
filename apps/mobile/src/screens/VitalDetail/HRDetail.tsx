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

import { useMemo, useState } from 'react';
import { DetailShell } from '../../components/DetailShell';
import { BaselineReference } from '../../components/BaselineReference';
import { StalenessHintRow } from '../../components/StalenessHintRow';
import type { TrendRange } from '../../components/TimeRangePills';
import { hrBaseline, formatHRBaseline, type HRBaseline } from '../../utils/vitalBaselines';

const RANGE_TO_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

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
import {
  RecentReadingsSection,
} from '../../components/RecentReadingsSection';
import type { RecentReading } from '../../components/RecentReadingsList';
import { useDailyPulseData } from '../../state/dailyPulse';
import { useHR } from '../../state/hr';
import { useSleep } from '../../state/sleep';
import { hrFill } from '../../utils/vitalThemes';
import { checkStaleness } from '../../utils/classification';
import { formatStalenessCaption } from '../../utils/stalenessCaption';
import type { HRSample, SleepSession } from '../../types/vitals';

const SECONDS_PER_DAY = 24 * 60 * 60;

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
 * Sprint 16.5f — Variability slot was a permanent "—" placeholder
 * (HRV needs RR intervals, not 5-min averages). Replaced with
 * "Range today" — max − min of today's samples. Real, useful,
 * computable from current data.
 *
 * - Resting: range-average of `restingBpmRecent` (rounded; null if empty)
 * - Peak: max bpm in the last 24h (null if no samples)
 * - Range today: today's max − min spread in bpm (null if < 2 samples)
 */
export function buildStats(
  samples: ReadonlyArray<HRSample>,
  restingBpmRecent: ReadonlyArray<number>,
  nowSec: number,
): {
  restingAvg: number | null;
  peakToday: number | null;
  rangeToday: number | null;
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
  let rangeToday: number | null = null;
  if (todays.length >= 2) {
    const minBpm = todays.reduce((a, b) => (b.bpm < a.bpm ? b : a)).bpm;
    const maxBpm = todays.reduce((a, b) => (b.bpm > a.bpm ? b : a)).bpm;
    rangeToday = Math.round(maxBpm - minBpm);
  }
  return { restingAvg, peakToday, rangeToday };
}

/** Dynamic Y-axis range for the today trend chart. Pre-16.5f was
 *  hardcoded [60, 95], which clipped activity peaks (110+) out of
 *  view. Returns a band rounded to the nearest 10 with a floor of 40
 *  and a ceiling of max(95, dataMax + 10). */
export function dynamicHRChartRange(data: ReadonlyArray<number>): [number, number] {
  if (data.length === 0) return [60, 95];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const lo = Math.max(40, Math.floor((min - 5) / 10) * 10);
  const hi = Math.max(95, Math.ceil((max + 5) / 10) * 10);
  return [lo, hi];
}

/**
 * Build the sleep × resting-HR correlation series for the chosen range.
 * Pre-16.5e was hardcoded to last-7-days; now takes `days` so the
 * chart re-derives when the user taps 30d / 90d. Each entry uses
 * sessionEndSec as the t-axis value (ms) so CorrelationStrip's tBounds
 * can frame the window correctly.
 */
export function buildSleepHRCorrelation(
  hrRecent: ReadonlyArray<number>,
  sleepSessions: ReadonlyArray<SleepSession>,
  days: number = 7,
): { hr: VitalSeries; sleep: VitalSeries } | null {
  if (hrRecent.length < 2 || sleepSessions.length < 2) return null;
  const sleepOrdered = [...sleepSessions].sort(
    (a, b) => a.sessionEndSec - b.sessionEndSec,
  );
  const recentSleep = sleepOrdered.slice(-days);
  const recentHR = hrRecent.slice(-days);
  const n = Math.min(recentSleep.length, recentHR.length);
  if (n < 2) return null;
  const sleepWindow = recentSleep.slice(-n);
  const hrWindow = recentHR.slice(-n);
  // Pair the i-th sleep session with the i-th resting HR — both are
  // oldest → newest, so the alignment is positional. t uses the sleep
  // session's end time in ms so the strip can frame the window.
  const hr: VitalSeries = {
    type: 'hr',
    points: hrWindow.map((v, i) => ({
      t: sleepWindow[i].sessionEndSec * 1000,
      value: v,
    })),
  };
  const sleep: VitalSeries = {
    type: 'sleep',
    points: sleepWindow.map((s) => ({
      t: s.sessionEndSec * 1000,
      value: s.totalMinutes,
    })),
  };
  return { hr, sleep };
}

// Sprint 16.5c — recent-readings row helpers.
//
// HR has the highest sample density of any vital (5-min auto cadence →
// ~200 samples in the slice's recent cap). The user asked for the same
// "Recent readings + Show more picker" affordance the other vitals have
// so they can audit when each sample was captured. We pass the full
// sorted list to RecentReadingsSection; its picker handles paging.

function hrRowContext(bpm: number, ageHours: number, isFirst: boolean): string {
  // The 0x15 history packet doesn't carry per-sample motion state, so
  // we lean on the BPM zones for readable copy. Matches the HRZones
  // bands (Resting / Steady / Elevated / Active) without re-inventing
  // colour semantics.
  const zone =
    bpm < 65
      ? 'Resting'
      : bpm < 95
        ? 'Steady'
        : bpm < 125
          ? 'Elevated'
          : 'Active';
  if (isFirst && ageHours < 1.5) return `Latest · ${zone.toLowerCase()}`;
  if (ageHours < 24) return zone;
  if (ageHours < 48) return `${zone} · yesterday`;
  return zone;
}

function hrRowTime(measuredAtSec: number, nowMs: number): string {
  const d = new Date(measuredAtSec * 1000);
  const ageHours = (nowMs - measuredAtSec * 1000) / 3_600_000;
  if (ageHours < 24) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (ageHours < 48) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short' });
}

function buildHRRecentRows(samples: ReadonlyArray<HRSample>): RecentReading[] {
  if (samples.length === 0) return [];
  const sorted = samples.slice().sort((a, b) => b.measuredAtSec - a.measuredAtSec);
  const nowMs = Date.now();
  return sorted.map((s, idx) => {
    const ageHours = (nowMs - s.measuredAtSec * 1000) / 3_600_000;
    return {
      id: `hr-${s.measuredAtSec}`,
      value: `${Math.round(s.bpm)}`,
      context: hrRowContext(s.bpm, ageHours, idx === 0),
      time: hrRowTime(s.measuredAtSec, nowMs),
    };
  });
}

const INSIGHT_BODY_EMPTY =
  "Wear the watch to start tracking your heart rate. After a few nights of sleep, you'll see how it moves with your rest.";

const INSIGHT_BODY_PRE_BASELINE =
  "After a few nights of sleep, this card will compare your resting heart rate to your usual band and call out anything worth noting.";

/** Deterministic HR insight body — describes the real numbers against
 *  the baseline. No fabricated month-over-month claims. */
function hrInsightBody(
  restingToday: number | null,
  baseline: HRBaseline | null,
): string {
  if (restingToday === null || baseline === null) {
    return INSIGHT_BODY_PRE_BASELINE;
  }
  const baselineMid = Math.round((baseline.bpmLow + baseline.bpmHigh) / 2);
  const diff = Math.round(restingToday) - baselineMid;
  const absDiff = Math.abs(diff);
  if (absDiff <= 2) {
    return `Your resting heart rate this morning (${Math.round(restingToday)} bpm) is right at your usual. Calm wake.`;
  }
  if (diff < 0) {
    return `Your resting heart rate this morning (${Math.round(restingToday)} bpm) is about ${absDiff} below your usual — a quieter night than last week.`;
  }
  return `Your resting heart rate this morning (${Math.round(restingToday)} bpm) is about ${absDiff} above your usual. Worth watching this week.`;
}

export interface HRDetailProps {
  onBack: () => void;
  onArticleOpen?: (articleId: string) => void;
  onLearnOpen?: () => void;
}

export function HRDetail({ onBack, onArticleOpen, onLearnOpen }: HRDetailProps) {
  const data = useDailyPulseData();
  const restingToday = data.hr.restingToday;

  // Sprint 16.5e — mirror DetailShell's range so the recent-readings
  // list, the sleep × resting-HR correlation, and the zone-card
  // distribution react to 7d / 30d / 90d. The today trend chart stays
  // 24h-bound (it's literally "today").
  const [range, setRange] = useState<TrendRange>('7d');

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

  const rangedSamples = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - RANGE_TO_DAYS[range] * SECONDS_PER_DAY;
    return allSamples.filter((s) => s.measuredAtSec >= cutoff);
  }, [allSamples, range]);
  const allSleepSessions = useMemo(
    () => [...sleepPending, ...sleepRecent],
    [sleepPending, sleepRecent],
  );

  const nowSec = Math.floor(Date.now() / 1000);

  const trendData = useMemo(
    () => buildTodayTrendData(allSamples, nowSec),
    [allSamples, nowSec],
  );
  const trendChartRange = useMemo(
    () => dynamicHRChartRange(trendData),
    [trendData],
  );
  const zones = useMemo(() => buildZones(rangedSamples), [rangedSamples]);
  const { restingAvg, peakToday, rangeToday } = useMemo(
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

  // ----- Baseline reference (16.5f) -----------------------------------
  const baseline: HRBaseline | null = useMemo(
    () => hrBaseline(useHR.getState().restingBpmRecent(nowSec)),
    [nowSec, hrRecent, hrPending],
  );
  const baselineBody = baseline ? formatHRBaseline(baseline) : '';

  const correlation = useMemo(
    () =>
      buildSleepHRCorrelation(
        useHR.getState().restingBpmRecent(nowSec),
        allSleepSessions,
        RANGE_TO_DAYS[range],
      ),
    [allSleepSessions, nowSec, range],
  );

  const recentRows = useMemo(() => buildHRRecentRows(rangedSamples), [rangedSamples]);

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
      onRangeChange={setRange}
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
      {baselineBody ? (
        <BaselineReference
          body={baselineBody}
          eyebrow="Your usual resting"
          caption={`over the last ${baseline?.sampleCount ?? 14} nights`}
          testID="hr-detail-baseline"
        />
      ) : null}
      <StalenessHintRow stale={staleness === 'stale'} testID="hr-detail-staleness-hint" />
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
            label: 'Range today',
            value: rangeToday !== null ? String(rangeToday) : '—',
            unit: rangeToday !== null ? 'bpm spread' : 'bpm',
          },
        ]}
        testID="hr-detail-stats"
      />

      {trendData.length > 0 ? (
        <VitalTrendChart
          vital="hr"
          data={trendData}
          range={trendChartRange}
          caption="Today · heart rate"
          subCaption={`${trendChartRange[0]}–${trendChartRange[1]} band`}
          peak
          trough
          testID="hr-detail-trend"
          style={{ marginHorizontal: 20 }}
        />
      ) : null}

      {hasZoneData ? (
        <HRZonesCard
          zones={zones}
          label={`Time in zones · last ${RANGE_TO_DAYS[range]} days`}
          testID="hr-detail-zones"
        />
      ) : null}

      {correlation ? (
        <CorrelationStrip
          vitalA={correlation.sleep}
          vitalB={correlation.hr}
          range={range}
          caption={`Sleep × resting HR — last ${RANGE_TO_DAYS[range]} days`}
          tBounds={(() => {
            const nowMs = Date.now();
            const days = RANGE_TO_DAYS[range];
            return { tMin: nowMs - days * 24 * 60 * 60 * 1000, tMax: nowMs };
          })()}
          axisLabels={(() => {
            const nowMs = Date.now();
            const days = RANGE_TO_DAYS[range];
            const startMs = nowMs - days * 24 * 60 * 60 * 1000;
            const left = new Date(startMs).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });
            return { left, right: 'today' };
          })()}
          testID="hr-detail-correlation"
          style={{ marginHorizontal: 20 }}
        />
      ) : null}

      {recentRows.length > 0 ? (
        <RecentReadingsSection
          vital="hr"
          eyebrow="Recent readings"
          readings={recentRows}
          testID="hr-detail-recent"
        />
      ) : null}

      <VitalInsightCard
        vital="hr"
        body={hasData ? hrInsightBody(restingToday, baseline) : INSIGHT_BODY_EMPTY}
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
