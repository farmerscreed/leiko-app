// ActivityDetail — Sprint 8.5 (vital-detail · activity), range-wired
// in Sprint 16.5e.
//
// Per-vital detail screen for steps + calories + move minutes. Sourced
// from leiko-detail-screens.jsx lines 360–507 (ActivityDetail). Composes
// the bespoke `ActivityRingsHero` (three concentric rings) + standard
// detail-screen primitives + the `ActivityWeeklyBars` chart + the
// `ActivityGoalSheet` picker.
//
// Sections (top → bottom):
//   1. ActivityRingsHero     — bespoke 3-ring hero (steps / calories / move)
//   2. StatTrio              — Daily avg / Best day / Streak (over range)
//   3. ActivityWeeklyBars    — daily bars for 7d; weekly aggregates for 30d/90d
//   4. VitalInsightCard      — Tier-B placeholder; Sprint 12.5 generates
//   5. RecentReadingsList    — recent days history within the range
//   6. Goal config row       — tap → ActivityGoalSheet
//
// 7d / 30d / 90d range (Sprint 16.5e):
//   The DetailShell-owned TimeRangePills are now wired here through
//   `setRange`. Switching range filters:
//     - the chart (daily bars for 7d, weekly aggregates otherwise)
//     - the stat trio (Daily avg + Best day computed over the range;
//       Streak still measured from today backwards, range-independent)
//     - the Recent-days list (all non-zero days within the range, no
//       hard cap — pre-16.5e the list was capped at today + 3, which
//       hid history the user had asked to see)
//   The hero is unaffected — it always shows today's progress.
//
// Empty state: when `stepsToday === 0` AND no non-zero days exist in
// the range we render a soft welcome ring + a single insight card + the
// goal-config row. Bars + stat trio + recent days hide.
//
// Voice rules (docs/05-voice-and-claims.md):
//   - "Daily avg", "Best day", "Streak (days at goal)" — factual.
//   - "days at goal" — supportive framing per Activity-specific anti-
//     patterns; no gamification verbs anywhere in the rendered tree.
//   - "Take a walk this evening to close the ring" / equivalent — calm
//     supportive nudge, not pushy.
//   - "Recent days" / "Daily step goal" — neutral section labels.
//
// Persistence note: Sprint 8.5 surfaces the goal-config sheet but does
// not persist the new goal. `useActivity.setTargetSteps` does not exist
// yet; Sprint 10 wires it. The screen accepts an optional `onGoalChange`
// override so the parent navigator can wire it earlier if needed.

import { useMemo, useState, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DetailShell } from '../../components/DetailShell';
import { StatTrio } from '../../components/StatTrio';
import { VitalInsightCard } from '../../components/VitalInsightCard';
import { VitalExplainerAnchor } from '../../components/VitalExplainerAnchor';
import { type RecentReading } from '../../components/RecentReadingsList';
import { RecentReadingsSection } from '../../components/RecentReadingsSection';
import { ActivityRingsHero } from '../../components/ActivityRingsHero';
import { ActivityWeeklyBars } from '../../components/ActivityWeeklyBars';
import { ActivityGoalSheet } from '../../components/ActivityGoalSheet';
import type { TrendRange } from '../../components/TimeRangePills';
import { useDailyPulseData } from '../../state/dailyPulse';
import { checkStaleness } from '../../utils/classification';
import { formatStalenessCaption } from '../../utils/stalenessCaption';
import { useActivity } from '../../state/activity';
import { useTheme } from '../../theme';
import type { ActivityDay } from '../../types/vitals';

export interface ActivityDetailProps {
  onBack: () => void;
  /** Sprint 10 wires real persistence; Sprint 8.5 callers may override. */
  onGoalChange?: (newGoal: number) => void;
  onArticleOpen?: (articleId: string) => void;
  onLearnOpen?: () => void;
}

// Indexed by Date.getUTCDay(): 0=Sun, 1=Mon, ..., 6=Sat.
const DAY_INITIALS_BY_WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SECONDS_PER_DAY = 24 * 60 * 60;

const RANGE_TO_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const PLACEHOLDER_INSIGHT_POPULATED =
  "You hit your step goal four times this week — a quiet improvement. Today's still early; an evening walk would close the ring. Step count tends to track gently with calmer evening blood pressure.";

const PLACEHOLDER_INSIGHT_EMPTY =
  "Welcome. Once your steps start coming in, this is where you'll see how the day is shaping up — and a gentle nudge if you'd like one.";

const EMPTY_HERO_MESSAGE = 'Start moving to see your day fill in.';

export function ActivityDetail({
  onBack,
  onGoalChange,
  onArticleOpen,
  onLearnOpen,
}: ActivityDetailProps) {
  const data = useDailyPulseData();
  const recentStepsRows = useActivity((s) => s.recentSteps);
  const pendingStepsRows = useActivity((s) => s.pendingSteps);
  const todayCalories = useActivity((s) => s.todayCalories());

  const stepsToday = data.activity.stepsToday;
  const targetSteps = data.activity.targetSteps;

  // Sprint 16.5e — DetailShell's TimeRangePills are wired here. The
  // DetailShell still owns the internal state for the pills' appearance;
  // we mirror it so the screen's data selectors react to the choice.
  const [range, setRange] = useState<TrendRange>('7d');

  // ----- Chart series + recent-days source ---------------------------
  // For 7d we render the last 7 daily totals (today is the rightmost
  // bar). For 30d / 90d we aggregate into weekly bins so the bar count
  // stays legible on a phone screen.
  const chartSeries = useMemo(
    () => buildChartSeries(pendingStepsRows, recentStepsRows, targetSteps, range),
    [pendingStepsRows, recentStepsRows, targetSteps, range],
  );

  // ----- All non-zero days within the range, newest first ----------
  const rangedDays = useMemo(
    () => buildRangedDays(pendingStepsRows, recentStepsRows, range),
    [pendingStepsRows, recentStepsRows, range],
  );

  // ----- Today's calories + move minutes -----------------------------
  // Move minutes aren't tracked yet (Sprint 7.5 stubs); pass null.
  const caloriesToday = todayCalories?.activityKcal ?? null;
  const moveMinutesToday: number | null = null;

  // ----- Empty state detection ---------------------------------------
  const isEmpty = stepsToday === 0 && rangedDays.length === 0;

  // Sprint 16 — per D13 §6.6, stale when no step sync in last 6h. The
  // latest activity-day's `lastSampleAtSec` is the freshness signal.
  const activityStaleness = isEmpty
    ? 'no_data'
    : checkStaleness('activity', data.activity.latestSampleSec);
  const activityStaleCaption =
    activityStaleness === 'stale'
      ? formatStalenessCaption(data.activity.latestSampleSec)
      : null;

  // ----- Stat trio (over the chosen range) ---------------------------
  const dailyAvg = useMemo(() => {
    const non = rangedDays.filter((d) => d.totalSteps > 0);
    if (non.length === 0) return 0;
    return Math.round(
      non.reduce((a, b) => a + b.totalSteps, 0) / non.length,
    );
  }, [rangedDays]);

  const bestDay = useMemo(() => {
    let bestVal = 0;
    let bestLabel = rangeShortLabel(range);
    for (const d of rangedDays) {
      if (d.totalSteps > bestVal) {
        bestVal = d.totalSteps;
        bestLabel = dayContextLabel(d.dayLocal, range);
      }
    }
    return { value: bestVal, label: bestLabel };
  }, [rangedDays, range]);

  const streakDaysAtGoal = useMemo(
    () =>
      // Streak is a "current run" — always measured from today
      // backwards. Range-independent.
      computeStreakFromToday(rangedDays, targetSteps),
    [rangedDays, targetSteps],
  );

  // ----- Recent-days list (no hard cap) ------------------------------
  const recentReadings = useMemo<RecentReading[]>(
    () => buildRecentReadings(stepsToday, rangedDays, targetSteps),
    [stepsToday, rangedDays, targetSteps],
  );

  // ----- Goal sheet --------------------------------------------------
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const handleGoalSubmit = useCallback(
    (newGoal: number) => {
      onGoalChange?.(newGoal);
    },
    [onGoalChange],
  );

  return (
    <>
      <DetailShell
        vital="activity"
        onBack={onBack}
        onRangeChange={setRange}
        testID="activity-detail"
        hero={
          <ActivityRingsHero
            steps={stepsToday}
            target={targetSteps}
            calories={caloriesToday}
            moveMinutes={moveMinutesToday}
            empty={isEmpty}
            emptyMessage={isEmpty ? EMPTY_HERO_MESSAGE : undefined}
            staleCaption={activityStaleCaption}
            testID="activity-detail-hero"
          />
        }
      >
        {!isEmpty ? (
          <StatTrio
            testID="activity-detail-stat-trio"
            items={[
              {
                label: 'Daily avg',
                value: dailyAvg.toLocaleString(),
                unit: `steps · ${rangeShortLabel(range)}`,
              },
              {
                label: 'Best day',
                value: bestDay.value > 0 ? bestDay.value.toLocaleString() : '—',
                unit: bestDay.label,
              },
              {
                label: 'Streak',
                value: streakDaysAtGoal.toString(),
                unit: 'days at goal',
              },
            ]}
          />
        ) : null}

        {!isEmpty ? (
          <ActivityWeeklyBars
            days={chartSeries.values}
            dayLabels={chartSeries.labels}
            goal={chartSeries.goal}
            title={chartTitle(range)}
            testID="activity-detail-weekly-bars"
          />
        ) : null}

        <VitalInsightCard
          vital="activity"
          body={isEmpty ? PLACEHOLDER_INSIGHT_EMPTY : PLACEHOLDER_INSIGHT_POPULATED}
          testID="activity-detail-insight"
        />

        <VitalExplainerAnchor
          context={{ type: 'activity' }}
          onArticleOpen={onArticleOpen}
          onLearnOpen={onLearnOpen}
          testID="activity-detail-explainer-anchor"
        />

        {!isEmpty ? (
          <RecentReadingsSection
            vital="activity"
            eyebrow="Recent days"
            readings={recentReadings}
            testID="activity-detail-recent"
          />
        ) : null}

        <GoalConfigSection
          currentGoal={targetSteps}
          onPress={() => setGoalSheetOpen(true)}
        />
      </DetailShell>
      <ActivityGoalSheet
        open={goalSheetOpen}
        currentGoal={targetSteps}
        onSubmit={handleGoalSubmit}
        onClose={() => setGoalSheetOpen(false)}
        testID="activity-detail-goal-sheet"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Section: Goal config tappable row (label above + opener row below)
// ---------------------------------------------------------------------------

interface GoalConfigSectionProps {
  currentGoal: number;
  onPress: () => void;
}

function GoalConfigSection({ currentGoal, onPress }: GoalConfigSectionProps) {
  const theme = useTheme();
  const labelStyle = theme.type('labelUppercase');
  const valueStyle = theme.type('numericM');

  return (
    <View>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: labelStyle.family,
          fontSize: labelStyle.size,
          lineHeight: labelStyle.lineHeight,
          letterSpacing: labelStyle.letterSpacing,
          color: theme.colors.text.tertiary,
          textTransform: 'uppercase',
          marginHorizontal: 20,
          marginBottom: theme.spacing.s,
        }}
      >
        Daily step goal
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Daily step goal, ${currentGoal.toLocaleString()} steps. Tap to change.`}
        onPress={onPress}
        hitSlop={6}
        testID="activity-detail-goal-row"
        style={({ pressed }) => [
          styles.goalRow,
          {
            backgroundColor: theme.colors.surface.warmSubtle,
            borderColor: theme.colors.border.rim,
            borderRadius: theme.radii.l,
            marginHorizontal: 20,
            paddingHorizontal: theme.spacing.l,
            paddingVertical: theme.spacing.l,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fontFamilies.editorial,
              fontSize: valueStyle.size,
              lineHeight: valueStyle.lineHeight,
              color: theme.colors.text.primary,
            }}
          >
            {currentGoal.toLocaleString()}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fontFamilies.numeric,
              fontSize: 11,
              color: theme.colors.text.tertiary,
              letterSpacing: 0.4,
              marginTop: 2,
              textTransform: 'uppercase',
            }}
          >
            steps · tap to change
          </Text>
        </View>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: 22,
            color: theme.colors.text.tertiary,
          }}
        >
          ›
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit tests.
// ---------------------------------------------------------------------------

const FULL_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface ChartSeries {
  /** Values for each bar, oldest first. Length depends on range. */
  values: number[];
  /** Short labels for each bar, matching `values`. */
  labels: string[];
  /** Goal line — for 7d this is the daily goal; for weekly aggregates
   *  this is the WEEKLY goal (daily × 7). */
  goal: number;
}

function todayKey(nowSec: number): string {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

function shortMonthDay(date: Date): string {
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function rangeShortLabel(range: TrendRange): string {
  switch (range) {
    case '7d':
      return 'week';
    case '30d':
      return 'month';
    case '90d':
      return '90 days';
  }
}

export function chartTitle(range: TrendRange): string {
  switch (range) {
    case '7d':
      return 'This week vs goal';
    case '30d':
      return 'Last 30 days · weekly';
    case '90d':
      return 'Last 90 days · weekly';
  }
}

/** Build the chart series matching the selected range. For 7d we keep
 *  the original daily-bar layout (today is the rightmost bar, empty
 *  days zero-filled). For 30d / 90d we group consecutive 7-day windows
 *  ending today into weekly aggregates so the bar count stays legible
 *  (4-5 bars at 30d, 12-13 at 90d). */
export function buildChartSeries(
  pending: ActivityDay[],
  recent: ActivityDay[],
  dailyGoal: number,
  range: TrendRange,
  nowSec: number = Math.floor(Date.now() / 1000),
): ChartSeries {
  const all = [...pending, ...recent];
  const byDay = new Map<string, ActivityDay>();
  for (const d of all) {
    if (!byDay.has(d.dayLocal)) byDay.set(d.dayLocal, d);
  }
  if (range === '7d') {
    const values: number[] = [];
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const t = nowSec - i * SECONDS_PER_DAY;
      const key = todayKey(t);
      const day = byDay.get(key);
      values.push(day?.totalSteps ?? 0);
      labels.push(DAY_INITIALS_BY_WEEKDAY[new Date(t * 1000).getUTCDay()] ?? '');
    }
    return { values, labels, goal: dailyGoal };
  }
  const totalDays = RANGE_TO_DAYS[range];
  const binCount = Math.ceil(totalDays / 7);
  const values: number[] = [];
  const labels: string[] = [];
  // Bins are aligned to "today", oldest bin first. For 30d the oldest
  // bin may be a partial 2-day window; we still total its days.
  for (let bin = binCount - 1; bin >= 0; bin--) {
    let total = 0;
    let endKeyDate: Date | null = null;
    for (let d = 0; d < 7; d++) {
      const offset = bin * 7 + d;
      if (offset >= totalDays) break;
      const t = nowSec - offset * SECONDS_PER_DAY;
      const key = todayKey(t);
      const day = byDay.get(key);
      total += day?.totalSteps ?? 0;
      if (endKeyDate === null) endKeyDate = dayKeyToDate(key);
    }
    values.push(total);
    labels.push(endKeyDate ? shortMonthDay(endKeyDate) : '');
  }
  return { values, labels, goal: dailyGoal * 7 };
}

/** All days within the range, newest first. Includes days with zero
 *  steps so the empty-state heuristic + the Recent-days context lines
 *  can choose what to show. Today is always the first entry when a
 *  pending row for today exists. */
export function buildRangedDays(
  pending: ActivityDay[],
  recent: ActivityDay[],
  range: TrendRange,
  nowSec: number = Math.floor(Date.now() / 1000),
): ActivityDay[] {
  const days = RANGE_TO_DAYS[range];
  const all = [...pending, ...recent];
  const byDay = new Map<string, ActivityDay>();
  for (const d of all) {
    if (!byDay.has(d.dayLocal)) byDay.set(d.dayLocal, d);
  }
  const out: ActivityDay[] = [];
  for (let i = 0; i < days; i++) {
    const t = nowSec - i * SECONDS_PER_DAY;
    const key = todayKey(t);
    const day = byDay.get(key);
    if (day) out.push(day);
  }
  return out;
}

/** Walk back from today, count consecutive met-goal days. Stops at the
 *  first miss or first gap. Range-independent — looks at today / yesterday
 *  regardless of which pill is active. */
export function computeStreakFromToday(
  rangedDays: ActivityDay[],
  targetSteps: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): number {
  if (rangedDays.length === 0) return 0;
  const byDay = new Map<string, ActivityDay>();
  for (const d of rangedDays) byDay.set(d.dayLocal, d);
  let count = 0;
  for (let i = 0; i < rangedDays.length; i++) {
    const t = nowSec - i * SECONDS_PER_DAY;
    const key = todayKey(t);
    const day = byDay.get(key);
    if (!day || day.totalSteps < targetSteps || day.totalSteps === 0) break;
    count += 1;
  }
  return count;
}

function dayContextLabel(dayLocal: string, range: TrendRange): string {
  const todayKeyStr = new Date().toISOString().slice(0, 10);
  if (dayLocal === todayKeyStr) return 'Today';
  const date = dayKeyToDate(dayLocal);
  if (range === '7d') {
    return FULL_DAY_NAMES[date.getUTCDay()];
  }
  return shortMonthDay(date);
}

/** Pre-16.5e this function capped at "today + 3 prior days". The cap
 *  silently hid history the user had asked to see. Now we surface every
 *  non-zero day within the selected range, newest first. */
export function buildRecentReadings(
  stepsToday: number,
  rangedDays: ActivityDay[],
  goal: number,
): RecentReading[] {
  const todayKeyStr = new Date().toISOString().slice(0, 10);
  const rows: RecentReading[] = [];
  // Today is always the first row (in-progress framing).
  rows.push({
    id: 'today',
    value: stepsToday > 0 ? stepsToday.toLocaleString() : '—',
    context: 'Today · in progress',
    time: 'now',
  });
  // Every other day with non-zero steps, oldest excluded only when zero.
  for (const day of rangedDays) {
    if (day.dayLocal === todayKeyStr) continue;
    if (day.totalSteps === 0) continue;
    const date = dayKeyToDate(day.dayLocal);
    const dayName = FULL_DAY_NAMES[date.getUTCDay()];
    const meets = day.totalSteps >= goal;
    const ctx = meets ? `${dayName} · met goal` : `${dayName} · light day`;
    rows.push({
      id: `day-${day.dayLocal}`,
      value: day.totalSteps.toLocaleString(),
      context: ctx,
      time: shortMonthDay(date),
    });
  }
  return rows;
}

const styles = StyleSheet.create({
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
  },
});
