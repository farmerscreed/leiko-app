// ActivityDetail — Sprint 8.5 (vital-detail · activity).
//
// Per-vital detail screen for steps + calories + move minutes. Sourced
// from leiko-detail-screens.jsx lines 360–507 (ActivityDetail). Composes
// the bespoke `ActivityRingsHero` (three concentric rings) + standard
// detail-screen primitives + the `ActivityWeeklyBars` chart + the
// `ActivityGoalSheet` picker.
//
// Sections (top → bottom):
//   1. ActivityRingsHero     — bespoke 3-ring hero (steps / calories / move)
//   2. StatTrio              — Daily avg / Best day / Streak
//   3. ActivityWeeklyBars    — 7 day bars vs goal line
//   4. VitalInsightCard      — Tier-B placeholder; Sprint 12.5 generates
//   5. RecentReadingsList    — recent days history (used as a generic list)
//   6. Goal config row       — tap → ActivityGoalSheet
//
// Empty state: when `stepsToday === 0` AND `recentStepDays === []` we
// render a soft welcome ring + a single insight card + the goal-config
// row. Weekly bars + stat trio + recent days hide.
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
import { useDailyPulseData } from '../../state/dailyPulse';
import { checkStaleness } from '../../utils/classification';
import { formatStalenessCaption } from '../../utils/stalenessCaption';
import { useActivity } from '../../state/activity';
import { useAuth } from '../../state/auth';
import { useTheme } from '../../theme';
import type { ActivityDay } from '../../types/vitals';

export interface ActivityDetailProps {
  onBack: () => void;
  /** Sprint 10 wires real persistence; Sprint 8.5 callers may override. */
  onGoalChange?: (newGoal: number) => void;
  onArticleOpen?: (articleId: string) => void;
  onLearnOpen?: () => void;
}

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SECONDS_PER_DAY = 24 * 60 * 60;

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
  const timeZone = useAuth((s) => s.profile?.timezone ?? null);
  const todayCalories = useActivity((s) => s.todayCalories(undefined, timeZone));

  const stepsToday = data.activity.stepsToday;
  const targetSteps = data.activity.targetSteps;

  // ----- Weekly bars + stat trio source ------------------------------
  const last7 = useMemo(
    () => buildLast7Days(pendingStepsRows, recentStepsRows),
    [pendingStepsRows, recentStepsRows],
  );

  // ----- Today's calories + move minutes -----------------------------
  // Move minutes aren't tracked yet (Sprint 7.5 stubs); pass null.
  const caloriesToday = todayCalories?.activityKcal ?? null;
  const moveMinutesToday: number | null = null;

  // ----- Empty state detection ---------------------------------------
  const isEmpty = stepsToday === 0 && last7.values.every((v) => v === 0);

  // Sprint 16 — per D13 §6.6, stale when no step sync in last 6h. The
  // latest activity-day's `lastSampleAtSec` is the freshness signal.
  const activityStaleness = isEmpty
    ? 'no_data'
    : checkStaleness('activity', data.activity.latestSampleSec);
  const activityStaleCaption =
    activityStaleness === 'stale'
      ? formatStalenessCaption(data.activity.latestSampleSec)
      : null;

  // ----- Stat trio ---------------------------------------------------
  const dailyAvg = useMemo(() => {
    const non = last7.values.filter((v) => v > 0);
    if (non.length === 0) return 0;
    return Math.round(non.reduce((a, b) => a + b, 0) / non.length);
  }, [last7.values]);

  const bestDay = useMemo(() => {
    let bestVal = 0;
    let bestIdx = -1;
    for (let i = 0; i < last7.values.length; i++) {
      if (last7.values[i] > bestVal) {
        bestVal = last7.values[i];
        bestIdx = i;
      }
    }
    return {
      value: bestVal,
      label: bestIdx >= 0 ? last7.contextLabels[bestIdx] : 'this week',
    };
  }, [last7.values, last7.contextLabels]);

  const streakDaysAtGoal = useMemo(() => {
    // Walk back from today (last index in last7.values) and count
    // consecutive met-goal days. The streak ends as soon as a day
    // misses goal (or has zero data).
    let count = 0;
    for (let i = last7.values.length - 1; i >= 0; i--) {
      if (last7.values[i] >= targetSteps && last7.values[i] > 0) count += 1;
      else break;
    }
    return count;
  }, [last7.values, targetSteps]);

  // ----- Recent-days list --------------------------------------------
  // Use the generic RecentReadingsList primitive — its API works for any
  // value type (it formats whatever string the caller passes).
  const recentReadings = useMemo<RecentReading[]>(
    () => buildRecentReadings(stepsToday, last7.values, last7.contextLabels, targetSteps),
    [stepsToday, last7.values, last7.contextLabels, targetSteps],
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
                unit: 'steps · week',
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
            days={last7.values}
            dayLabels={DAY_INITIALS}
            goal={targetSteps}
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
// Pure helpers
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

interface Last7Result {
  /** Step counts oldest-first. Length 7. Today is index 6. Empty days
   *  zero-filled so the chart always renders 7 bars. */
  values: number[];
  /** Mono uppercase context labels for each day, oldest-first. */
  contextLabels: string[];
}

function todayKey(nowSec: number): string {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

function buildLast7Days(
  pending: ActivityDay[],
  recent: ActivityDay[],
): Last7Result {
  const nowSec = Math.floor(Date.now() / 1000);
  const all = [...pending, ...recent];
  const byDay = new Map<string, ActivityDay>();
  for (const d of all) {
    if (!byDay.has(d.dayLocal)) byDay.set(d.dayLocal, d);
  }
  const values: number[] = [];
  const contextLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const t = nowSec - i * SECONDS_PER_DAY;
    const key = todayKey(t);
    const day = byDay.get(key);
    values.push(day?.totalSteps ?? 0);
    if (i === 0) {
      contextLabels.push('Today');
    } else if (i === 1) {
      contextLabels.push('Yesterday');
    } else {
      contextLabels.push(FULL_DAY_NAMES[new Date(t * 1000).getDay()]);
    }
  }
  return { values, contextLabels };
}

function buildRecentReadings(
  stepsToday: number,
  weekValues: number[],
  contextLabels: string[],
  goal: number,
): RecentReading[] {
  // Today + most recent 3 prior days (any with non-zero steps).
  const rows: RecentReading[] = [];
  rows.push({
    id: 'today',
    value: stepsToday > 0 ? stepsToday.toLocaleString() : '—',
    context: 'Today · in progress',
    time: 'now',
  });
  // Walk backwards from yesterday (index 5) and pick up to 3 more.
  let added = 0;
  for (let i = weekValues.length - 2; i >= 0 && added < 3; i--) {
    const value = weekValues[i];
    if (value === 0) continue;
    const dayName = contextLabels[i];
    const meets = value >= goal;
    const ctx = meets ? `${dayName} · met goal` : `${dayName} · light day`;
    rows.push({
      id: `day-${i}`,
      value: value.toLocaleString(),
      context: ctx,
      time: dayName.slice(0, 3),
    });
    added += 1;
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
