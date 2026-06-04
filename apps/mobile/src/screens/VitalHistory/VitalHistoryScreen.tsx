// VitalHistory — "spool ALL data for the selected period" (founder
// direction 2026-06-03; ADR-0008 follow-up). Reached from a VitalDetail
// screen's "View all · N" link; pages the FULL server window for the
// vital + range, grouped by the wearer's local day, newest first.
//
// HR routes are deliberately not served by this flat list (~26k rows /
// 90d) — HR's full-window browse is the per-day drill-down planned on
// hr_range_summary.per_day.
//
// Voice: factual, calm. Counts are the TRUE server totals — the honest
// companion to the capped offline lists on the detail screens.

import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { TrendRange } from '../../components/TimeRangePills';
import { useVitalHistory } from '../../hooks/useVitalHistory';
import type { VitalHistoryKind, VitalHistoryRow } from '../../services/vitalHistory';
import {
  dayKeyInZone,
  monthDayInZone,
  timeInZone,
  weekdayInZone,
} from '../../utils/timeInZone';
import { useTheme } from '../../theme';

export interface VitalHistoryParams {
  vital: VitalHistoryKind;
  range: TrendRange;
  /** Resolved by the caller: the viewed family (self or caregiver path). */
  familyId: string;
  /** Resolved wearer timezone — the detail screen already computed it. */
  timeZone: string;
}

// Structural typing (Settings precedent): the screen is registered on both
// stacks, so we accept the common surface instead of a per-stack generic.
type Props = {
  navigation: { goBack: () => void };
  route: { params: VitalHistoryParams };
};

const KIND_TITLE: Record<VitalHistoryKind, string> = {
  bp: 'Blood pressure',
  spo2: 'Blood oxygen',
  sleep: 'Sleep',
  activity: 'Activity',
};

const KIND_NOUN: Record<VitalHistoryKind, string> = {
  bp: 'readings',
  spo2: 'readings',
  sleep: 'nights',
  activity: 'days',
};

const RANGE_LABEL: Record<TrendRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

export interface HistorySection {
  key: string;
  title: string;
  data: VitalHistoryRow[];
}

/** Group rows (already newest-first) into wearer-local-day sections.
 *  Exported for tests. */
export function groupRowsByDay(
  rows: VitalHistoryRow[],
  timeZone: string,
): HistorySection[] {
  const sections: HistorySection[] = [];
  let current: HistorySection | null = null;
  for (const row of rows) {
    const ms = row.measuredAtSec * 1000;
    const key = dayKeyInZone(ms, timeZone);
    if (!current || current.key !== key) {
      current = {
        key,
        title: `${weekdayInZone(ms, timeZone, 'long')} · ${monthDayInZone(ms, timeZone)}`,
        data: [],
      };
      sections.push(current);
    }
    current.data.push(row);
  }
  return sections;
}

/** Per-row time label. Sleep rows are night-keyed (the synthesized end is
 *  a storage key, never shown as a real time — ADR-0008 D2); activity rows
 *  are whole-day totals, so neither gets a clock. */
export function rowTimeLabel(
  kind: VitalHistoryKind,
  measuredAtSec: number,
  timeZone: string,
): string {
  if (kind === 'sleep') return 'night';
  if (kind === 'activity') return '';
  return timeInZone(measuredAtSec * 1000, timeZone);
}

export function VitalHistoryScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { vital, range, familyId, timeZone } = route.params;
  const history = useVitalHistory(vital, familyId, range);

  const sections = useMemo(
    () => groupRowsByDay(history.rows, timeZone),
    [history.rows, timeZone],
  );

  const bodyStyle = theme.type('bodyM');
  const labelStyle = theme.type('labelUppercase');
  const captionStyle = theme.type('caption');
  const headlineStyle = theme.type('headline');
  const numericStyle = theme.type('numericM');

  const countLabel =
    history.totalCount !== null
      ? `${history.totalCount} ${KIND_NOUN[vital]}`
      : '…';

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="vital-history"
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.m,
          paddingBottom: theme.spacing.l,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          testID="vital-history-back"
          style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.l }}
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              fontWeight: '500',
            }}
          >
            Back
          </Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headlineStyle.size,
            lineHeight: headlineStyle.lineHeight,
            fontWeight: headlineStyle.weight as '700',
            fontFamily: headlineStyle.family,
          }}
        >
          {KIND_TITLE[vital]}
        </Text>
        <Text
          testID="vital-history-sub"
          style={{
            marginTop: theme.spacing.xs,
            color: theme.colors.text.secondary,
            fontSize: captionStyle.size,
            lineHeight: captionStyle.lineHeight,
            fontFamily: captionStyle.family,
          }}
        >
          {RANGE_LABEL[range]} · {countLabel}
        </Text>
      </View>

      {history.isLoading ? (
        <LoadingState testID="vital-history-loading" />
      ) : history.error ? (
        <ErrorState
          onRetry={() => void history.refresh()}
          testID="vital-history-error"
        />
      ) : history.rows.length === 0 ? (
        <View
          style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl }}
          testID="vital-history-empty"
        >
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              lineHeight: bodyStyle.lineHeight,
              fontFamily: bodyStyle.family,
            }}
          >
            Nothing recorded in this period yet. New data lands here as the
            watch syncs.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          onEndReachedThreshold={0.4}
          onEndReached={history.loadMore}
          contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
          testID="vital-history-list"
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                paddingHorizontal: theme.spacing.xl,
                paddingTop: theme.spacing.l,
                paddingBottom: theme.spacing.s,
                color: theme.colors.text.tertiary,
                fontSize: labelStyle.size,
                letterSpacing: labelStyle.letterSpacing,
                fontFamily: labelStyle.family,
                textTransform: 'uppercase',
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: theme.spacing.xl,
                  paddingVertical: theme.spacing.m,
                  borderBottomColor: theme.colors.border.subtle,
                },
              ]}
            >
              <Text
                style={{
                  width: 86,
                  color: theme.colors.text.tertiary,
                  fontSize: captionStyle.size,
                  fontFamily: captionStyle.family,
                }}
              >
                {rowTimeLabel(vital, item.measuredAtSec, timeZone)}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: theme.colors.text.primary,
                  fontSize: numericStyle.size,
                  fontFamily: theme.fontFamilies.numeric,
                }}
              >
                {item.value}
              </Text>
              {item.detail ? (
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: captionStyle.size,
                    fontFamily: captionStyle.family,
                  }}
                >
                  {item.detail}
                </Text>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            history.isFetchingMore ? (
              <ActivityIndicator
                style={{ paddingVertical: theme.spacing.l }}
                color={theme.colors.text.tertiary}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
