// SleepDetail — Sprint 8.5, fully reworked in Sprint 16.5c.
//
// Per-vital detail screen for sleep. Composes the Sprint 8.5 foundation
// primitives (DetailShell, VitalHero, StatTrio, VitalInsightCard,
// CorrelationStrip, RecentReadingsSection) with the bespoke
// SleepStagesBar (last-night composition) + SleepNightlyBars (range
// chart). The earlier SleepHypnogram was removed: it expected a
// transitions[] array, but the U16PRO_protocol_en.pdf §4.3 sleep
// packet has no field for transitions — total / deep / light minutes
// only — so the hypnogram was rendering as a single flat "light"
// band and gave the impression no stage data existed.
//
// 7d / 30d / 90d range:
//   The DetailShell-owned TimeRangePills are now wired through to
//   `setRange` here. Switching range filters:
//     - the nightly bar chart (window length)
//     - the "Recent nights" list (only sessions within the window)
//     - the morning-BP × sleep-score correlation (matching range)
//   The hero is unaffected — it always shows last night.
//
// Risk note (sprint card, D13 §8.5): "Sleep stage data accuracy from
// the watch is decent but not clinical. Don't surface stage data with
// false precision — broad bands only." We now show three broad bands
// (Deep / Light / Other) by duration; no per-minute precision.
//
// Voice rules: every user-visible string in this file passes
// docs/05-voice-and-claims.md — descriptive, calm, no "patient",
// "diagnose", "predict", "dangerous", "critical", "silent killer".

import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DetailShell } from '../../components/DetailShell';
import { VitalHero } from '../../components/VitalHero';
import { type RecentReading } from '../../components/RecentReadingsList';
import { RecentReadingsSection } from '../../components/RecentReadingsSection';
import { VitalInsightCard } from '../../components/VitalInsightCard';
import { VitalExplainerAnchor } from '../../components/VitalExplainerAnchor';
import {
  CorrelationStrip,
  type VitalSeries,
} from '../../components/CorrelationStrip';
import { SleepStagesBar } from '../../components/SleepStagesBar';
import { SleepNightlyBars } from '../../components/SleepNightlyBars';
import type { TrendRange } from '../../components/TimeRangePills';
import { useDailyPulseData } from '../../state/dailyPulse';
import { useSleep } from '../../state/sleep';
import { useReadings } from '../../state/readings';
import { sleepFill } from '../../utils/vitalThemes';
import { checkStaleness } from '../../utils/classification';
import { formatStalenessCaption } from '../../utils/stalenessCaption';
import type { SleepSession } from '../../types/vitals';

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests via the screen module)
// ---------------------------------------------------------------------------

/** Format minutes as e.g. "7:42". Always two-digit minutes. */
export function formatHm(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Whole-number percent of total, clamped 0..100. */
function pctOfTotal(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function rangeCopyForSleepScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '';
  if (score >= 80) return 'A quieter night than last week';
  if (score >= 65) return 'Roughly in line with your usual';
  if (score >= 50) return 'A lighter night than your usual';
  return 'A more restless night than your usual';
}

function insightBody(session: SleepSession | null): string {
  if (session === null) {
    return 'Wear the watch to bed and your sleep shape will land here in the morning. We highlight the night\'s composition and how it tends to line up with your morning readings.';
  }
  const deep = session.deepMinutes;
  const total = session.totalMinutes;
  const deepPct = pctOfTotal(deep, total);
  if (deepPct >= 22) {
    return `Deep sleep landed around ${deepPct}% of the night, a touch above your usual. Heart rate tends to settle earlier on nights like this, which often shows up as a calmer morning reading.`;
  }
  if (deepPct >= 14) {
    return `Deep sleep made up about ${deepPct}% of the night — roughly your usual. We'll keep watching how this connects to your morning readings.`;
  }
  return `Deep sleep was about ${deepPct}% of the night, a little under your usual. A lighter night often pairs with a slightly higher morning reading; we'll keep an eye on how this week shapes up.`;
}

/** "Last night · 11:14 pm → 8:00 am" — bedtime AND wake-time in one
 *  line. Pre-16.5c only the bedtime appeared. */
export function bedTimeSub(
  sessionStartSec: number,
  sessionEndSec: number,
): string {
  const bed = new Date(sessionStartSec * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const wake = new Date(sessionEndSec * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Last night · ${bed} → ${wake}`;
}

function nightLabel(idx: number, sessionEndSec: number): string {
  if (idx === 0) return 'Last night';
  return new Date(sessionEndSec * 1000).toLocaleDateString([], {
    weekday: 'long',
  });
}

function nightTime(sessionEndSec: number): string {
  return new Date(sessionEndSec * 1000).toLocaleDateString([], {
    weekday: 'short',
  });
}

const RANGE_TO_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** Filter sessions to those ending within the last N days for the given
 *  range. Exported for tests. */
export function filterSessionsToRange(
  sessions: ReadonlyArray<SleepSession>,
  range: TrendRange,
  nowMs: number = Date.now(),
): SleepSession[] {
  const days = RANGE_TO_DAYS[range];
  const cutoffSec = Math.floor(nowMs / 1000) - days * 24 * 60 * 60;
  return sessions.filter((s) => s.sessionEndSec >= cutoffSec);
}

function buildMorningBPSeries(
  readings: { measuredAtSec: number; systolic: number }[],
  nowSec: number,
  days: number,
): { t: number; value: number }[] {
  const cutoffSec = nowSec - days * 24 * 60 * 60;
  const byDay = new Map<string, { sumSys: number; count: number; tMs: number }>();
  for (const r of readings) {
    if (r.measuredAtSec < cutoffSec) continue;
    const d = new Date(r.measuredAtSec * 1000);
    if (d.getHours() >= 12) continue;
    const key = d.toISOString().slice(0, 10);
    const slot = byDay.get(key) ?? { sumSys: 0, count: 0, tMs: r.measuredAtSec * 1000 };
    slot.sumSys += r.systolic;
    slot.count += 1;
    slot.tMs = r.measuredAtSec * 1000;
    byDay.set(key, slot);
  }
  const out: { t: number; value: number }[] = [];
  for (const [, slot] of byDay) {
    out.push({ t: slot.tMs, value: slot.sumSys / slot.count });
  }
  return out.sort((a, b) => a.t - b.t);
}

function buildSleepScoreSeries(
  sessions: ReadonlyArray<SleepSession>,
): { t: number; value: number }[] {
  return sessions
    .map((s) => ({ t: s.sessionEndSec * 1000, value: s.sleepScore }))
    .sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SleepDetailProps {
  onBack: () => void;
  onArticleOpen?: (articleId: string) => void;
  onLearnOpen?: () => void;
}

export function SleepDetail({ onBack, onArticleOpen, onLearnOpen }: SleepDetailProps) {
  const data = useDailyPulseData();
  const session = data.sleep.session;

  // Sprint 16.5c — DetailShell's TimeRangePills are now wired here.
  // The DetailShell still owns the internal state for the pills'
  // appearance; we mirror it into local state so the screen's data
  // selectors react to the choice.
  const [range, setRange] = useState<TrendRange>('7d');

  // All recorded sessions, newest-first.
  const sleepRecent = useSleep((s) => s.recent);
  const sleepPending = useSleep((s) => s.pending);
  const allNights = useMemo(() => {
    const all = [...sleepPending, ...sleepRecent];
    return all
      .slice()
      .sort((a, b) => b.sessionStartSec - a.sessionStartSec);
  }, [sleepRecent, sleepPending]);

  // Range-filtered slice for the chart, correlation, and list.
  const rangedNights = useMemo(
    () => filterSessionsToRange(allNights, range),
    [allNights, range],
  );

  // Morning BP × sleep score correlation, matching the selected range.
  const allReadings = useReadings((s) => [...s.pending, ...s.recent]);
  const correlationSeries = useMemo<{ a: VitalSeries; b: VitalSeries } | null>(() => {
    if (rangedNights.length < 2 || allReadings.length < 2) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const days = RANGE_TO_DAYS[range];
    const bpSeries = buildMorningBPSeries(allReadings, nowSec, days);
    const sleepSeries = buildSleepScoreSeries(rangedNights);
    if (bpSeries.length < 2 || sleepSeries.length < 2) return null;
    return {
      a: { type: 'sleep', points: sleepSeries },
      b: { type: 'bp', points: bpSeries },
    };
  }, [allReadings, rangedNights, range]);

  // ---- Empty state: no last-night session AT ALL ------------------------
  // If older nights exist we still render history below; only the
  // hero + stages-bar + "this morning's" insight need the empty path.
  const hasLastNight = session !== null;

  // ---- Hero ------------------------------------------------------------
  const heroPrimary = hasLastNight ? formatHm(session.totalMinutes) : '—';
  const sleepStaleness = hasLastNight
    ? checkStaleness('sleep', session.sessionEndSec)
    : 'no_data';
  const sleepStaleCaption =
    sleepStaleness === 'stale' && hasLastNight
      ? formatStalenessCaption(session.sessionEndSec)
      : null;
  const heroSub = hasLastNight
    ? (sleepStaleCaption ?? bedTimeSub(session.sessionStartSec, session.sessionEndSec))
    : 'No sleep recorded last night';
  const heroRange = hasLastNight
    ? rangeCopyForSleepScore(session.sleepScore)
    : 'Wear the watch overnight to track your sleep.';

  // Sleep composition values for SleepStagesBar (replaces the
  // duplicated StatTrio above the bar — both showed the same numbers).
  const totalMinutes = hasLastNight ? session.totalMinutes : 0;
  const deepMinutes = hasLastNight ? session.deepMinutes : 0;
  const lightMinutes = hasLastNight ? session.lightMinutes : 0;
  const otherMinutes = Math.max(0, totalMinutes - deepMinutes - lightMinutes);

  // ---- Recent nights list (within the selected range) ------------------
  const recentRows: RecentReading[] = rangedNights.map((s, idx) => {
    const deepP = pctOfTotal(s.deepMinutes, s.totalMinutes);
    return {
      id: `sleep-${s.sessionStartSec}`,
      value: formatHm(s.totalMinutes),
      context: `${nightLabel(idx, s.sessionEndSec)} · ${deepP}% deep`,
      time: idx === 0 ? 'now' : nightTime(s.sessionEndSec),
    };
  });

  return (
    <DetailShell
      vital="sleep"
      onBack={onBack}
      onRangeChange={setRange}
      testID="sleep-detail"
      hero={
        <VitalHero
          vital="sleep"
          primary={heroPrimary}
          secondary={hasLastNight ? 'hrs' : undefined}
          sub={heroSub}
          range={heroRange}
          ringFill={hasLastNight ? sleepFill(session.sleepScore) : 0}
          testID="sleep-detail-hero"
        />
      }
    >
      {hasLastNight ? (
        <SleepStagesBar
          totalMinutes={totalMinutes}
          deepMinutes={deepMinutes}
          lightMinutes={lightMinutes}
          otherMinutes={otherMinutes}
          sessionStartSec={session.sessionStartSec}
          sessionEndSec={session.sessionEndSec}
          testID="sleep-detail-stages"
        />
      ) : null}

      {/* Nightly chart for the selected range — shows historical
          context even when last night was missing. */}
      {allNights.length > 0 ? (
        <SleepNightlyBars
          sessions={allNights}
          range={range}
          testID="sleep-detail-nightly"
        />
      ) : null}

      {correlationSeries ? (
        <View style={styles.correlationWrap}>
          <CorrelationStrip
            vitalA={correlationSeries.a}
            vitalB={correlationSeries.b}
            range={range}
            caption={`Sleep × morning BP — last ${RANGE_TO_DAYS[range]} days`}
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
            testID="sleep-detail-correlation"
          />
        </View>
      ) : null}

      <VitalInsightCard
        vital="sleep"
        body={insightBody(hasLastNight ? session : null)}
        testID="sleep-detail-insight"
      />
      <VitalExplainerAnchor
        context={{ type: 'sleep' }}
        onArticleOpen={onArticleOpen}
        onLearnOpen={onLearnOpen}
        testID="sleep-detail-explainer-anchor"
      />
      {recentRows.length > 0 ? (
        <RecentReadingsSection
          vital="sleep"
          eyebrow="Recent nights"
          readings={recentRows}
          testID="sleep-detail-recent"
        />
      ) : null}
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  correlationWrap: {
    marginHorizontal: 20,
  },
});
