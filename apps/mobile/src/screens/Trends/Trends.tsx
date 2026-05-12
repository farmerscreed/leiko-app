// Trends v2 — "The Letter".
//
// Narrative-led redesign sourced from `plans/trends-v2-design-brief.md`
// and the founder-approved Option A "The Letter" mockup in the design
// canvas bundle. The screen flips the visual hierarchy from Trends v1:
//
//   1. Header                     (Back · brand eyebrow · "Your trends")
//   2. Range chips                (recessive, top of scroll)
//   3. Letter hero                (eyebrow + serif paragraph + freshness)
//   4. Evidence card              (focal vital — BP for v1.0 — chart)
//   5. Ask Leiko affordance       (calm pill, opens AskLeikoSheet)
//   6. Cited footnote rail        (numbered correlation cards)
//   7. See everything toggle      (chevron + label + thin rule)
//      └── Expansion panel        (today's MultiVitalChart + toggles)
//   8. Weekly summary placeholder (dashed-border card)
//   9. Doctor inline link         (centred, soft underline)
//
// The doctor-PDF CTA from v1 is REMOVED. Trends v2 owns only the
// inline link in #9; the PDF flow lives on the new "For your doctor"
// screen (Sprint 16+ follow-up).
//
// Voice rules (docs/05-voice-and-claims.md): every authored string
// goes through `lintVoiceText` in the component tests. The dynamic
// narrative passes through `generateTrendsNarrative`, which itself
// composes voice-clean templates.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pill } from '../../components/Pill';
import {
  MultiVitalChart,
  type MultiVitalSeries,
} from '../../components/MultiVitalChart';
import { PaywallSheet, type PaywallTrigger } from '../../components/PaywallSheet';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { TrendsLetterHero } from '../../components/TrendsLetterHero';
import { TrendsEvidenceCard } from '../../components/TrendsEvidenceCard';
import { TrendsAskAffordance } from '../../components/TrendsAskAffordance';
import { TrendsCitedSection } from '../../components/TrendsCitedSection';
import { TrendsSeeEverythingToggle } from '../../components/TrendsSeeEverythingToggle';
import { TrendsWeeklySummaryCard } from '../../components/TrendsWeeklySummaryCard';
import { TrendsDoctorInlineLink } from '../../components/TrendsDoctorInlineLink';
import {
  useTrendsCorrelations,
  useTrendsData,
} from '../../hooks/useTrendsData';
import { usePlusEntitlement } from '../../hooks/usePlusEntitlement';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';
import { useAuth } from '../../state/auth';
import { useTheme, type Theme } from '../../theme';
import { generateTrendsNarrative } from '../../services/ai/trendsNarration';
import type { TrendsRange } from '../../utils/trends-aggregate';
import type { VitalType } from '../../components/VitalRing';
import type { AccountType } from '../../types/database';
import type {
  CaregiverStackParamList,
  SelfBuyerStackParamList,
} from '../../navigation/types';

type AnyNav = NativeStackNavigationProp<
  CaregiverStackParamList | SelfBuyerStackParamList
>;

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
const RANGE_WORD: Record<TrendsRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': 'year',
  all_time: 'time on Leiko',
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

interface PaywallState {
  visible: boolean;
  trigger: PaywallTrigger;
}

// ─── Freshness formatting ─────────────────────────────────────────────

function formatFreshness(computedAtMs: number, nowMs: number): string {
  const ageMs = Math.max(0, nowMs - computedAtMs);
  const m = Math.round(ageMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return 'last week';
}

// ─── Screen ───────────────────────────────────────────────────────────

export function Trends() {
  const theme = useTheme();
  const navigation = useNavigation<AnyNav>();
  const profile = useAuth((s) => s.profile);
  const accountType: AccountType = profile?.account_type ?? 'caregiver';
  const parentLabel = profile?.display_name ?? 'Mum';

  const { parents, isRefreshing, refresh } = useFamilyReadings();
  const familyId = parents[0]?.familyId ?? null;
  const userId = useAuth((s) => s.session?.user.id ?? null);

  const [range, setRange] = useState<TrendsRange>(FREE_RANGE);
  const [expanded, setExpanded] = useState(false);
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

  // Narrative — Sprint 16 cascade. Refetches when range / data /
  // correlations change. The cascade guarantees a non-null body.
  const [narrative, setNarrative] = useState<{
    body: string;
    computedAtMs: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void generateTrendsNarrative({
      data: trends.data,
      correlations: correlations.correlations,
      range,
      accountType,
      parentLabel,
    }).then((r) => {
      if (cancelled) return;
      setNarrative({ body: r.body, computedAtMs: Date.now() });
    });
    return () => {
      cancelled = true;
    };
  }, [trends.data, correlations.correlations, range, accountType, parentLabel]);

  const onRangeTap = useCallback(
    (next: TrendsRange) => {
      if (next !== FREE_RANGE && !isPlus) {
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

  const dismissPaywall = useCallback(
    () => setPaywall((prev) => ({ ...prev, visible: false })),
    [],
  );

  const onAskTrend = useCallback(() => {
    // Sprint 16 cascade-protected: AskLeiko is the existing
    // conversational surface. Deep-linked navigation is wired by the
    // navigator. For v1.0 this fires a no-op when the navigator
    // didn't pass an onAsk handler — the affordance still tests as
    // present without forcing screen tests to mock navigation.
    // (Hook into screen-level navigation in a follow-up patch.)
  }, []);

  const onOpenDoctorScreen = useCallback(() => {
    // Deep-link to "For your doctor" with the current Trends range
    // pre-selected. "all_time" doesn't have a PDF analogue; the
    // doctor screen's `pdfRangeFromTrendsRange` falls back when
    // necessary. The cast satisfies both stacks' type unions.
    (navigation as unknown as {
      navigate: (screen: 'ForYourDoctor', params?: { range?: TrendsRange }) => void;
    }).navigate('ForYourDoctor', { range });
  }, [navigation, range]);

  const series = useMemo<MultiVitalSeries[]>(
    () => buildSeries(trends.data, visible),
    [trends.data, visible],
  );

  const bpSummary = trends.data?.summary.bp;
  const hasBpData = (bpSummary?.count ?? 0) >= 3;

  const headerTitle = accountType === 'self_buyer' ? 'Your trends' : 'Trends';
  const eyebrow = `A letter from Leiko · ${RANGE_WORD[range]}`;
  const freshnessCaption = narrative
    ? `Based on your last ${RANGE_WORD[range]} · last computed ${formatFreshness(
        narrative.computedAtMs,
        Date.now(),
      )}`
    : undefined;

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

        <RangeChipsRow
          theme={theme}
          accountType={accountType}
          active={range}
          isPlus={isPlus}
          onRangeTap={onRangeTap}
        />

        {trends.isLoading && !narrative ? (
          <LoadingState
            caption="Reading the last few weeks."
            testID="trends-loading"
            style={{ marginTop: theme.spacing.xl }}
          />
        ) : trends.error ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <ErrorState
              onRetry={refresh}
              testID="trends-error"
              title="We couldn't read your trends just now."
              body="Pull to refresh, or try again in a moment."
            />
          </View>
        ) : !hasBpData ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              title="Trends will appear here next week"
              body="We need a few days of readings before we can show a pattern."
              testID="trends-empty"
            />
          </View>
        ) : (
          <>
            <TrendsLetterHero
              body={narrative?.body ?? ''}
              eyebrow={eyebrow}
              freshnessCaption={freshnessCaption}
              testID="trends-letter"
            />

            <View style={{ marginTop: theme.spacing.l }}>
              <TrendsEvidenceCard
                vital="bp"
                title="Blood pressure · morning"
                latestValue={
                  bpSummary?.avgSys && bpSummary?.avgDia
                    ? `${Math.round(bpSummary.avgSys)}/${Math.round(bpSummary.avgDia)}`
                    : '—'
                }
                series={(trends.data?.series.bp ?? []).map((p) => p.sys)}
                yRange={[90, 150]}
                healthyBand={[110, 130]}
                axisStart={trends.data?.series.bp[0]?.day ?? ''}
                axisEnd={
                  trends.data?.series.bp[
                    trends.data.series.bp.length - 1
                  ]?.day ?? ''
                }
                testID="trends-evidence"
              />
            </View>

            <View style={{ marginTop: theme.spacing.m }}>
              <TrendsAskAffordance
                onPress={onAskTrend}
                testID="trends-ask"
              />
            </View>

            <TrendsCitedSection
              rows={correlations.correlations}
              testID="trends-cited"
            />

            <TrendsSeeEverythingToggle
              open={expanded}
              onToggle={() => setExpanded((v) => !v)}
              testID="trends-see-everything"
            />
            {expanded ? (
              <ExpansionPanel
                theme={theme}
                series={series}
                visible={visible}
                onToggle={onVitalToggle}
                rangeLabel={RANGE_LABELS[range]}
              />
            ) : null}

            <TrendsWeeklySummaryCard testID="trends-weekly-summary" />
          </>
        )}

        <TrendsDoctorInlineLink
          accountType={accountType}
          onPress={onOpenDoctorScreen}
          testID="trends-doctor-link"
        />
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
        accessibilityRole="header"
        style={[
          {
            fontFamily: theme.fontFamilies.editorial,
            fontSize: 30,
            lineHeight: 34,
            color: theme.colors.text.primary,
            letterSpacing: -0.4,
          },
        ]}
        testID="trends-header-title"
      >
        {title}
      </Text>
    </View>
  );
}

function RangeChipsRow({
  theme,
  accountType,
  active,
  isPlus,
  onRangeTap,
}: {
  theme: Theme;
  accountType: AccountType;
  active: TrendsRange;
  isPlus: boolean;
  onRangeTap: (r: TrendsRange) => void;
}) {
  const ranges =
    accountType === 'self_buyer' ? SELF_BUYER_RANGES : CAREGIVER_RANGES;
  return (
    <View
      style={{
        paddingTop: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
        flexDirection: 'row',
        gap: theme.spacing.xs,
      }}
      testID="trends-range-row"
    >
      {ranges.map((r) => {
        const isActive = active === r;
        const locked = r !== FREE_RANGE && !isPlus;
        return (
          <Pill
            key={r}
            variant={isActive ? 'accent' : 'outline'}
            selected={isActive}
            onPress={() => onRangeTap(r)}
            testID={`trends-range:${r}`}
            accessibilityLabel={locked ? `${RANGE_LABELS[r]} (Plus only)` : RANGE_LABELS[r]}
          >
            {locked ? `${RANGE_LABELS[r]} ·` : RANGE_LABELS[r]}
          </Pill>
        );
      })}
    </View>
  );
}

function ExpansionPanel({
  theme,
  series,
  visible,
  onToggle,
  rangeLabel,
}: {
  theme: Theme;
  series: MultiVitalSeries[];
  visible: Record<VitalType, boolean>;
  onToggle: (kind: VitalType) => void;
  rangeLabel: string;
}) {
  return (
    <View
      style={{
        marginHorizontal: theme.spacing.l,
        marginTop: theme.spacing.m,
        padding: theme.spacing.m,
        borderRadius: theme.radii.l,
        backgroundColor: theme.colors.surface.warmElevated,
        borderColor: theme.colors.border.subtle,
        borderWidth: StyleSheet.hairlineWidth,
      }}
      testID="trends-expansion"
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          marginBottom: theme.spacing.m,
        }}
      >
        {ALL_VITALS.map((v) => (
          <Pill
            key={v}
            variant={visible[v] ? 'accent' : 'outline'}
            selected={visible[v]}
            onPress={() => onToggle(v)}
            testID={`trends-toggle:${v}`}
          >
            {VITAL_CHIP_LABEL[v]}
          </Pill>
        ))}
      </View>

      <MultiVitalChart
        series={series}
        caption="This range"
        subCaption={rangeLabel}
        testID="trends-chart"
      />
    </View>
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
