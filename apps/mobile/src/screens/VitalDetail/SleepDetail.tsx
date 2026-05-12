// SleepDetail — Sprint 8.5 (D13 §8.5).
//
// Per-vital detail screen for sleep. Composes the Sprint 8.5 foundation
// primitives (DetailShell, VitalHero, StatTrio, VitalInsightCard,
// CorrelationStrip, RecentReadingsList) with the bespoke SleepHypnogram
// chart for last-night's stage timeline.
//
// Risk note (sprint card, D13 §8.5): "Sleep stage data accuracy from the
// watch is decent but not clinical. Don't surface stage data with false
// precision — broad bands only." Stage minutes are rounded to whole
// minutes (no millisecond precision), the hypnogram is pre-binned to 30
// broad bands, and copy uses "about" / "roughly" / "tends to" framing
// rather than diagnostic claims.
//
// Voice rules: every user-visible string in this file passes
// docs/05-voice-and-claims.md — descriptive, calm, no "patient",
// "diagnose", "predict", "dangerous", "critical", "silent killer", "you
// may have", "we detected", "loved one", "smartwatch".
//
// Stack: RN 0.81.5, react-native-svg, react-native-reanimated v3,
// phosphor-react-native v3 (per docs/00-tech-stack.md).

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DetailShell } from '../../components/DetailShell';
import { VitalHero } from '../../components/VitalHero';
import { StatTrio, type StatTrioItem } from '../../components/StatTrio';
import { type RecentReading } from '../../components/RecentReadingsList';
import { RecentReadingsSection } from '../../components/RecentReadingsSection';
import { VitalInsightCard } from '../../components/VitalInsightCard';
import { VitalExplainerAnchor } from '../../components/VitalExplainerAnchor';
import {
  CorrelationStrip,
  type VitalSeries,
} from '../../components/CorrelationStrip';
import { SleepHypnogram } from '../../components/SleepHypnogram';
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

/**
 * Voice-rule-clean range copy mapped from sleep score (0..100). We deliberately
 * stay descriptive — no "good", "bad", "dangerous". The bands lean on
 * "tends to" / "looks like" framing.
 */
export function rangeCopyForSleepScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '';
  if (score >= 80) return 'A quieter night than last week';
  if (score >= 65) return 'Roughly in line with your usual';
  if (score >= 50) return 'A lighter night than your usual';
  return 'A more restless night than your usual';
}

/**
 * Voice-rule-clean insight body. Reads as a single calm paragraph; uses
 * "about", "tends to", and "your usual" — no medical claims, no precision
 * the watch can't deliver.
 */
function insightBody(session: SleepSession | null): string {
  if (session === null) {
    return 'Wear the watch to bed and your sleep shape will land here in the morning. We highlight the night\'s stages and how they tend to line up with your morning readings.';
  }
  const deep = session.deepMinutes;
  const total = session.totalMinutes;
  const deepPct = pctOfTotal(deep, total);
  // Generic, descriptive copy — no diagnostic, no "predict".
  if (deepPct >= 22) {
    return `Deep sleep landed around ${deepPct}% of the night, a touch above your usual. Heart rate tends to settle earlier on nights like this, which often shows up as a calmer morning reading.`;
  }
  if (deepPct >= 14) {
    return `Deep sleep made up about ${deepPct}% of the night — roughly your usual. We'll keep watching how this connects to your morning readings.`;
  }
  return `Deep sleep was about ${deepPct}% of the night, a little under your usual. A lighter night often pairs with a slightly higher morning reading; we'll keep an eye on how this week shapes up.`;
}

/**
 * "Last night" sub-line: "Last night · in bed 11:14 pm".
 */
export function bedTimeSub(sessionStartSec: number): string {
  const time = new Date(sessionStartSec * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Last night · in bed ${time}`;
}

/**
 * Day-of-week or "last night" context label for the recent-nights list.
 * Most recent (idx 0) reads "Last night"; everything else reads as the
 * weekday of the session start.
 */
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

// Build a "morning BP" series — average systolic per day from BP readings
// captured before noon, last 7 days. Pure; takes already-filtered rows.
function buildMorningBPSeries(
  readings: { measuredAtSec: number; systolic: number }[],
  nowSec: number,
): { t: number; value: number }[] {
  const cutoffSec = nowSec - 7 * 24 * 60 * 60;
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
  sessions: SleepSession[],
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

  // Recent nights (last 4) — newest first for the list, the hypnogram
  // reads from `data.sleep.session` directly.
  const sleepRecent = useSleep((s) => s.recent);
  const sleepPending = useSleep((s) => s.pending);
  const recentNights = useMemo(() => {
    const all = [...sleepPending, ...sleepRecent];
    return all
      .slice()
      .sort((a, b) => b.sessionStartSec - a.sessionStartSec)
      .slice(0, 4);
  }, [sleepRecent, sleepPending]);

  // Morning BP × sleep score correlation, 7 days.
  const allReadings = useReadings((s) => [...s.pending, ...s.recent]);
  const correlationSeries = useMemo<{ a: VitalSeries; b: VitalSeries } | null>(() => {
    if (recentNights.length < 2 || allReadings.length < 2) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const bpSeries = buildMorningBPSeries(allReadings, nowSec);
    const sleepSeries = buildSleepScoreSeries(recentNights);
    if (bpSeries.length < 2 || sleepSeries.length < 2) return null;
    return {
      a: { type: 'sleep', points: sleepSeries },
      b: { type: 'bp', points: bpSeries },
    };
  }, [allReadings, recentNights]);

  // ---- Empty state: no session at all -----------------------------------
  if (session === null) {
    return (
      <DetailShell
        vital="sleep"
        onBack={onBack}
        testID="sleep-detail"
        hero={
          <VitalHero
            vital="sleep"
            primary="—"
            sub="No sleep recorded last night"
            range="Wear the watch overnight to track your sleep."
            ringFill={0}
            testID="sleep-detail-hero"
          />
        }
      >
        <VitalInsightCard
          vital="sleep"
          body={insightBody(null)}
          testID="sleep-detail-insight"
        />
      </DetailShell>
    );
  }

  // ---- Hero ------------------------------------------------------------
  const totalMinutes = session.totalMinutes;
  const heroPrimary = formatHm(totalMinutes);
  // Sprint 16 — per D13 §6.6, stale when no sleep session in last 24h.
  // The wake-up reference is sessionEndSec — that's the freshness signal.
  const sleepStaleness = checkStaleness('sleep', session.sessionEndSec);
  const sleepStaleCaption =
    sleepStaleness === 'stale'
      ? formatStalenessCaption(session.sessionEndSec)
      : null;
  const heroSub = sleepStaleCaption ?? bedTimeSub(session.sessionStartSec);
  const heroRange = rangeCopyForSleepScore(session.sleepScore);

  // ---- Stat trio: deep / rem / light, formatted "h:mm" + percent --------
  const deepPct = pctOfTotal(session.deepMinutes, totalMinutes);
  const remPct = pctOfTotal(session.remMinutes, totalMinutes);
  const lightPct = pctOfTotal(session.lightMinutes, totalMinutes);

  const statItems: [StatTrioItem, StatTrioItem, StatTrioItem] = [
    {
      label: 'Deep',
      value: formatHm(session.deepMinutes),
      unit: `hrs · ${deepPct}%`,
    },
    {
      label: 'REM',
      value: formatHm(session.remMinutes),
      unit: `hrs · ${remPct}%`,
    },
    {
      label: 'Light',
      value: formatHm(session.lightMinutes),
      unit: `hrs · ${lightPct}%`,
    },
  ];

  // ---- Recent nights list ----------------------------------------------
  const recentRows: RecentReading[] = recentNights.map((s, idx) => {
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
      testID="sleep-detail"
      hero={
        <VitalHero
          vital="sleep"
          primary={heroPrimary}
          secondary="hrs"
          sub={heroSub}
          range={heroRange}
          ringFill={sleepFill(session.sleepScore)}
          testID="sleep-detail-hero"
        />
      }
    >
      <StatTrio items={statItems} testID="sleep-detail-stats" />
      <SleepHypnogram session={session} testID="sleep-detail-hypnogram" />
      {correlationSeries ? (
        <View style={styles.correlationWrap}>
          <CorrelationStrip
            vitalA={correlationSeries.a}
            vitalB={correlationSeries.b}
            range="7d"
            caption="Sleep × morning BP — last 7 days"
            testID="sleep-detail-correlation"
          />
        </View>
      ) : null}
      <VitalInsightCard
        vital="sleep"
        body={insightBody(session)}
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
