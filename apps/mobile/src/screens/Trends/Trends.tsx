// Trends — Sprint 9 / D13 §10 + docs/04-screens/trends.md.
//
// Multi-vital trends + correlation cards + doctor-PDF export. Layered
// over useTrendsData (the data fetch + aggregator) and useTrendsCorrelations
// (the latest meaningful correlation rows). The chart and the paywall
// sheet are presentational; this screen does the wiring.
//
// Voice rules per docs/05-voice-and-claims.md — every user-visible
// string here passes the voice gate. No "patient", "diagnose",
// "predict", "dangerous", "critical", "silent killer".

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import {
  MultiVitalChart,
  type MultiVitalSeries,
} from '../../components/MultiVitalChart';
import { Pill } from '../../components/Pill';
import { Button } from '../../components/Button';
import { PaywallSheet, type PaywallTrigger } from '../../components/PaywallSheet';
import {
  useTrendsCorrelations,
  useTrendsData,
} from '../../hooks/useTrendsData';
import { usePlusEntitlement } from '../../hooks/usePlusEntitlement';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';
import { useAuth } from '../../state/auth';
import { useTheme, type Theme } from '../../theme';
import type { TrendsRange } from '../../utils/trends-aggregate';
import type { VitalType } from '../../components/VitalRing';
import type { CorrelationRow, AccountType } from '../../types/database';

// 'all_time' is appended only for self-buyers (D8a §9.5). Caregiver
// mode never shows the chip, so the per-mode RANGES below is filtered
// at render time.
const CAREGIVER_RANGES: TrendsRange[] = ['7d', '30d', '90d', '1y'];
const SELF_BUYER_RANGES: TrendsRange[] = ['7d', '30d', '90d', '1y', 'all_time'];
const FREE_RANGE: TrendsRange = '7d';
const RANGE_LABELS: Record<TrendsRange, string> = {
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  '1y': '1Y',
  all_time: 'All',
};

const ALL_VITALS: VitalType[] = ['bp', 'hr', 'spo2', 'sleep', 'activity'];
const DEFAULT_VISIBLE: Record<VitalType, boolean> = {
  bp: true,
  hr: true,
  spo2: false,
  sleep: true,
  activity: false,
};
const VITAL_CHIP_LABEL: Record<VitalType, string> = {
  bp: 'BP',
  hr: 'HR',
  spo2: 'SpO2',
  sleep: 'Sleep',
  activity: 'Activity',
};

const CORRELATION_TYPE_EYEBROW: Record<CorrelationRow['correlation_type'], string> = {
  sleep_x_morning_bp: 'Sleep · Blood pressure',
  activity_x_resting_hr: 'Activity · Heart rate',
  spo2_dip_x_sleep_score: 'SpO2 · Sleep',
};

interface PaywallState {
  visible: boolean;
  trigger: PaywallTrigger;
}

export function Trends() {
  const theme = useTheme();
  const profile = useAuth((s) => s.profile);
  const accountType: AccountType = profile?.account_type ?? 'caregiver';

  // Family scope: pick the first family the user is in. Sprint 10+ adds
  // a per-parent picker for the caregiver mode; Sprint 9 ships the
  // single-family path which covers self-buyer fully and caregiver
  // single-parent (the most common case).
  const { parents, isRefreshing, refresh } = useFamilyReadings();
  const familyId = parents[0]?.familyId ?? null;
  const userId = useAuth((s) => s.session?.user.id ?? null);

  const [range, setRange] = useState<TrendsRange>(FREE_RANGE);
  const [visible, setVisible] = useState<Record<VitalType, boolean>>(
    () => ({ ...DEFAULT_VISIBLE }),
  );
  const [paywall, setPaywall] = useState<PaywallState>({
    visible: false,
    trigger: 'range_extension',
  });

  const { isPlus } = usePlusEntitlement();
  const trends = useTrendsData(familyId, range);
  const correlations = useTrendsCorrelations(familyId, userId);

  const onRangeTap = useCallback(
    (next: TrendsRange) => {
      if (next !== FREE_RANGE && !isPlus) {
        // 'all_time' is the self-buyer-only trigger per D8a §9.5; the
        // other gated chips fire 'range_extension'.
        const trigger: PaywallTrigger =
          next === 'all_time' ? 'all_time_range' : 'range_extension';
        setPaywall({ visible: true, trigger });
        return;
      }
      setRange(next);
    },
    [isPlus],
  );

  const onVitalToggle = useCallback((kind: VitalType) => {
    setVisible((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }, []);

  const onExportTap = useCallback(() => {
    if (!isPlus) {
      setPaywall({ visible: true, trigger: 'pdf_export' });
      return;
    }
    // Sprint 9: the PDF preview sheet itself lands in P4 wiring; for
    // Sprint 9 acceptance the trigger flow + paywall gate are the
    // testable surfaces. Sprint 10 wires the navigation step.
  }, [isPlus]);

  const dismissPaywall = useCallback(
    () => setPaywall((prev) => ({ ...prev, visible: false })),
    [],
  );

  const series = useMemo<MultiVitalSeries[]>(
    () => buildSeries(trends.data, visible),
    [trends.data, visible],
  );

  const hasAnyData = series.some(
    (s) => s.visible && s.values.length > 0,
  );

  const headerTitle = accountType === 'self_buyer' ? 'Your trends' : 'Trends';

  return (
    <SafeAreaView
      style={[
        styles.root,
        { backgroundColor: theme.colors.surface.warmBase },
      ]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: theme.spacing.xxxxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.brand.coral}
          />
        }
        testID="trends-scroll"
      >
        <Header theme={theme} title={headerTitle} />

        {/* Range chips — 7d free, others Plus-gated */}
        <ChipRow
          theme={theme}
          testID="trends-range-row"
          label="Range"
        >
          {(accountType === 'self_buyer' ? SELF_BUYER_RANGES : CAREGIVER_RANGES).map((r) => (
            <Pill
              key={r}
              variant={range === r ? 'accent' : 'outline'}
              selected={range === r}
              onPress={() => onRangeTap(r)}
              testID={`trends-range:${r}`}
            >
              {RANGE_LABELS[r]}
            </Pill>
          ))}
        </ChipRow>

        {/* Vital toggle — five chips with current visibility */}
        <ChipRow
          theme={theme}
          testID="trends-vitals-row"
          label="Vitals"
        >
          {ALL_VITALS.map((v) => (
            <Pill
              key={v}
              variant={visible[v] ? 'accent' : 'outline'}
              selected={visible[v]}
              onPress={() => onVitalToggle(v)}
              testID={`trends-toggle:${v}`}
            >
              {VITAL_CHIP_LABEL[v]}
            </Pill>
          ))}
        </ChipRow>

        {/* Chart card — empty / loading / error / default states */}
        <View
          style={{
            paddingHorizontal: theme.spacing.l,
            marginTop: theme.spacing.l,
          }}
        >
          <Card>
            {trends.isLoading ? (
              <ChartLoading theme={theme} />
            ) : trends.error ? (
              <ChartError theme={theme} onRetry={refresh} />
            ) : !hasAnyData ? (
              <ChartEmpty theme={theme} />
            ) : (
              <MultiVitalChart
                series={series}
                caption="This range"
                subCaption={RANGE_LABELS[range]}
                testID="trends-chart"
              />
            )}
          </Card>
        </View>

        {/* Correlation cards — only meaningful, capped at 3 */}
        {correlations.correlations.length > 0 ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.l,
              marginTop: theme.spacing.l,
            }}
            testID="trends-correlations"
          >
            {correlations.correlations.map((c) => (
              <CorrelationCard
                key={c.id}
                theme={theme}
                row={c}
                testID={`trends-correlation:${c.correlation_type}`}
              />
            ))}
          </View>
        ) : null}

        {/* Weekly summary placeholder card — Sprint 12.5 swaps the body */}
        <View
          style={{
            paddingHorizontal: theme.spacing.l,
            marginTop: theme.spacing.l,
          }}
        >
          <WeeklySummaryPlaceholder theme={theme} />
        </View>

        {/* Doctor PDF CTA */}
        <View
          style={{
            paddingHorizontal: theme.spacing.l,
            marginTop: theme.spacing.xl,
          }}
        >
          <Button
            variant={accountType === 'self_buyer' ? 'secondary' : 'primary'}
            onPress={onExportTap}
            testID="trends-export-cta"
            accessibilityHint={
              isPlus
                ? 'Opens the doctor-ready PDF preview.'
                : 'Opens the Leiko Plus paywall.'
            }
          >
            {accountType === 'self_buyer'
              ? 'Save as PDF for my doctor'
              : 'Share with your doctor'}
          </Button>
        </View>
      </ScrollView>

      <PaywallSheet
        visible={paywall.visible}
        onDismiss={dismissPaywall}
        accountType={accountType}
        trigger={paywall.trigger}
      />
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components.

function Header({ theme, title }: { theme: Theme; title: string }) {
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.l,
        paddingTop: theme.spacing.l,
      }}
    >
      <Text
        style={[
          theme.type('headline'),
          { color: theme.colors.text.primary },
        ]}
        testID="trends-header-title"
      >
        {title}
      </Text>
    </View>
  );
}

function ChipRow({
  theme,
  label,
  children,
  testID,
}: {
  theme: Theme;
  label: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      style={{
        paddingTop: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
      }}
      testID={testID}
    >
      <Text
        accessibilityLabel={label}
        style={[
          theme.type('label'),
          {
            color: theme.colors.text.tertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: theme.spacing.xs,
          },
        ]}
      >
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ columnGap: theme.spacing.s }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function ChartLoading({ theme }: { theme: Theme }) {
  return (
    <View style={{ padding: theme.spacing.l, alignItems: 'center' }}>
      <ActivityIndicator color={theme.colors.brand.primary} />
      <Text
        style={[
          theme.type('bodyM'),
          {
            color: theme.colors.text.tertiary,
            marginTop: theme.spacing.s,
          },
        ]}
        testID="trends-chart-loading"
      >
        Loading your trend.
      </Text>
    </View>
  );
}

function ChartError({
  theme,
  onRetry,
}: {
  theme: Theme;
  onRetry: () => void;
}) {
  return (
    <View
      style={{ padding: theme.spacing.l, alignItems: 'center' }}
      testID="trends-chart-error"
    >
      <Text
        style={[
          theme.type('bodyL'),
          { color: theme.colors.text.primary, textAlign: 'center' },
        ]}
      >
        We couldn't load your trends just now.
      </Text>
      <View style={{ marginTop: theme.spacing.m }}>
        <Button variant="ghost" onPress={onRetry} testID="trends-retry">
          Try again
        </Button>
      </View>
    </View>
  );
}

function ChartEmpty({ theme }: { theme: Theme }) {
  return (
    <View
      style={{ padding: theme.spacing.l }}
      testID="trends-chart-empty"
    >
      <Text
        style={[
          theme.type('headline'),
          { color: theme.colors.text.primary, textAlign: 'center' },
        ]}
      >
        Trends will appear here next week
      </Text>
      <Text
        style={[
          theme.type('bodyM'),
          {
            color: theme.colors.text.secondary,
            textAlign: 'center',
            marginTop: theme.spacing.s,
          },
        ]}
      >
        We need a few days of readings before we can show a pattern.
      </Text>
    </View>
  );
}

function CorrelationCard({
  theme,
  row,
  testID,
}: {
  theme: Theme;
  row: CorrelationRow;
  testID?: string;
}) {
  return (
    <View style={{ marginTop: theme.spacing.s }} testID={testID}>
      <Card>
        <View style={{ padding: theme.spacing.l }}>
          <Text
            style={[
              theme.type('label'),
              {
                color: theme.colors.text.tertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              },
            ]}
            testID={testID ? `${testID}-eyebrow` : undefined}
          >
            {CORRELATION_TYPE_EYEBROW[row.correlation_type]}
          </Text>
          {row.narrative_short ? (
            <Text
              style={[
                theme.type('headline'),
                {
                  color: theme.colors.text.primary,
                  marginTop: theme.spacing.xs,
                },
              ]}
              testID={testID ? `${testID}-headline` : undefined}
            >
              {row.narrative_short}
            </Text>
          ) : null}
          {row.narrative_long ? (
            <Text
              style={[
                theme.type('bodyM'),
                {
                  color: theme.colors.text.secondary,
                  marginTop: theme.spacing.s,
                },
              ]}
              testID={testID ? `${testID}-body` : undefined}
            >
              {row.narrative_long}
            </Text>
          ) : null}
          <Text
            style={[
              theme.type('label'),
              {
                color: theme.colors.text.tertiary,
                marginTop: theme.spacing.s,
              },
            ]}
            testID={testID ? `${testID}-stat` : undefined}
          >
            Over the last {row.window_days} days · n={row.sample_n ?? 0}
          </Text>
        </View>
      </Card>
    </View>
  );
}

function WeeklySummaryPlaceholder({ theme }: { theme: Theme }) {
  return (
    <Card>
      <View
        style={{ padding: theme.spacing.l }}
        testID="trends-weekly-summary-placeholder"
      >
        <Text
          style={[
            theme.type('label'),
            {
              color: theme.colors.text.tertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            },
          ]}
        >
          This week
        </Text>
        <Text
          style={[
            theme.type('bodyM'),
            {
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.s,
            },
          ]}
        >
          Your first weekly summary will appear next Sunday.
        </Text>
      </View>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers.

function buildSeries(
  data: ReturnType<typeof useTrendsData>['data'],
  visible: Record<VitalType, boolean>,
): MultiVitalSeries[] {
  if (!data) {
    return ALL_VITALS.map((kind) => ({
      kind,
      visible: visible[kind],
      values: [],
      days: [],
    }));
  }
  // BP series uses the systolic mean as the primary line. Diastolic
  // could be a secondary line in a future iteration; for v1.0 the
  // multi-vital chart shows ONE line per vital.
  const bp = {
    kind: 'bp' as const,
    visible: visible.bp,
    values: data.series.bp.map((p) => p.sys),
    days: data.series.bp.map((p) => p.day),
  };
  const hr = {
    kind: 'hr' as const,
    visible: visible.hr,
    values: data.series.hr
      .map((p) => p.restingBpm)
      .filter((v): v is number => v !== null),
    days: data.series.hr
      .filter((p) => p.restingBpm !== null)
      .map((p) => p.day),
  };
  const spo2 = {
    kind: 'spo2' as const,
    visible: visible.spo2,
    values: data.series.spo2
      .map((p) => p.avgPercent)
      .filter((v): v is number => v !== null),
    days: data.series.spo2
      .filter((p) => p.avgPercent !== null)
      .map((p) => p.day),
  };
  const sleep = {
    kind: 'sleep' as const,
    visible: visible.sleep,
    values: data.series.sleep.map((p) => p.totalMinutes),
    days: data.series.sleep.map((p) => p.day),
  };
  const activity = {
    kind: 'activity' as const,
    visible: visible.activity,
    values: data.series.activity.map((p) => p.totalSteps),
    days: data.series.activity.map((p) => p.day),
  };
  return [bp, hr, spo2, sleep, activity];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 80 },
});
