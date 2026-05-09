// Self-Buyer Home — Sprint 8 (Daily Pulse).
//
// The screen that defines the brand for self-buyers. Replaces the
// placeholder Sprint 4 shipped (`SelfBuyerHomePlaceholder`).
//
// Layout (per docs/04-screens/self-buyer-home.md, sourced from the
// design bundle in docs/_reference/design-bundles.md — leiko-home.html
// with the 4th "Recents" section swapped for the v2 DaySpine):
//
//   1. PulseHeader       — eyebrow date + greeting + avatar
//   2. AnomalyBanner     — when latest BP classifies calm_concerned / urgent
//   3. DailyPulseHero    — 5-vital constellation, immersive mode,
//                          adaptive central value per D13 §7.2
//   4. AINarration card  — placeholder string until Sprint 12.5
//   5. VitalTile strip   — horizontal scroll, 5 tiles
//   6. CorrelationStrip  — sleep × resting HR over 7 days
//   7. DaySpine          — Through your day (real moments, no AI)
//   8. TabBar (visual)   — Home active; Settings wired; Trends/Family
//                          render but route to placeholder (Sprints 9/10)
//   9. TakeReadingFAB    — opens existing TakeReading walkthrough
//
// Voice rules (docs/05-voice-and-claims.md): every user-visible string
// in this file is calm + plain + voice-rule clean. No "patient",
// "diagnose", "predict", "dangerous", "critical", "silent killer".
// Reassuring tone by default; calm-concerned tone only when the
// underlying classification calls for it.

import { useCallback, useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AnomalyBanner } from '../../components/AnomalyBanner';
import { HealthPlatformPermissionPrompt } from '../../components/HealthPlatformPermissionPrompt';
import { SixthReadingPaywallHost } from '../../components/SixthReadingPaywallHost';
import { DailyPulseHero, type DailyPulseHeroVitals } from '../../components/DailyPulseHero';
import { HomeLearnCard } from '../../components/HomeLearnCard';
import { useSeededLearnCard } from '../../hooks/useSeededLearnCard';
import { VitalTile } from '../../components/VitalTile';
import {
  CorrelationStrip,
  type VitalSeries,
} from '../../components/CorrelationStrip';
import { DaySpine } from '../../components/DaySpine';
import { useDailyPulseData } from '../../state/dailyPulse';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';
import { useAuth } from '../../state/auth';
import { useHR } from '../../state/hr';
import { useSleep } from '../../state/sleep';
import { useTheme, type Theme } from '../../theme';
import {
  deriveDayMoments,
  pickCentralValue,
  type DayMoment,
} from '../../utils/dayMoments';
import type { SelfBuyerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<SelfBuyerStackParamList>;

// Sprint 8 ships a placeholder narration string; Sprint 12.5 (ambient
// AI) replaces this with a real Tier-A/B generator output.
const PLACEHOLDER_AI_NARRATION = 'Your daily pulse is here.';

export function SelfBuyerHome() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const profile = useAuth((s) => s.profile);
  const { parents, isRefreshing, refresh } = useFamilyReadings();
  const data = useDailyPulseData();
  // Sprint 10a — drives the 6th-reading auto-paywall mount below.
  const familyId = parents[0]?.familyId ?? null;

  // ----- Adaptive central value (D13 §7.2) ---------------------------
  const central = useMemo(() => pickCentralValue(data), [data]);

  // ----- Hero ring fills per D13 §7.1 --------------------------------
  const heroVitals = useMemo<DailyPulseHeroVitals>(
    () => buildHeroVitals(data),
    [data],
  );

  // ----- Anomaly banner derived from BP tier -------------------------
  const banner = useMemo(() => deriveBanner(data), [data]);

  // ----- Sprint 14: seeded Learn card slot ---------------------------
  const seededLearn = useSeededLearnCard();

  // ----- DaySpine moments --------------------------------------------
  const moments = useMemo(() => deriveDayMoments(data), [data]);

  // ----- Correlation strip series (sleep × HR over 7d) ---------------
  const sleepRecent = useSleep((s) => s.recent);
  const hrRecent = useHR((s) => s.recent);
  const correlation = useMemo(
    () => buildCorrelation(sleepRecent, hrRecent),
    [sleepRecent, hrRecent],
  );

  // ----- Greeting + date string --------------------------------------
  const headerText = useMemo(() => buildHeader(profile?.display_name), [profile]);

  const handleHeroPress = useCallback(() => {
    // Hero tap → BP detail screen. The central value is BP-headline by
    // D13 §7.2 priority cascade, so opening the BP trend screen is the
    // most useful drill-in regardless of which adaptive value is showing.
    // (On-device review 2026-05-08: previous code routed to
    // ReadingDetail with an empty localId → blank screen.)
    navigation.navigate('VitalDetail', { vital: 'bp' });
  }, [navigation]);

  const handleVitalPress = useCallback(
    (vital: 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity') => {
      navigation.navigate('VitalDetail', { vital });
    },
    [navigation],
  );

  const handleMomentPress = useCallback(
    (m: DayMoment) => {
      handleVitalPress(m.vital);
    },
    [handleVitalPress],
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom:
              theme.spacing.xxxxl + theme.spacing.xxxl + theme.spacing.l,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.brand.coral}
          />
        }
      >
        <PulseHeader
          theme={theme}
          eyebrow={headerText.date}
          greeting={headerText.greeting}
          name={headerText.name}
          onAvatarPress={() => navigation.navigate('Settings')}
        />

        {banner ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.l,
              marginTop: theme.spacing.l,
            }}
          >
            <AnomalyBanner
              severity={banner.severity}
              title={banner.title}
              body={banner.body}
              cta={banner.cta}
              testID="self-buyer-home-anomaly-banner"
            />
          </View>
        ) : null}

        {/* Hero — adaptive centre + 5-ring constellation. Tap-through to
            ReadingDetail when a BP reading exists. */}
        <Pressable
          onPress={handleHeroPress}
          accessibilityRole={data.bp.latest ? 'button' : 'text'}
          accessibilityHint={
            data.bp.latest ? 'Opens the latest reading detail.' : undefined
          }
          style={{
            marginTop: theme.spacing.xxl,
            alignItems: 'center',
          }}
          testID="self-buyer-home-hero-pressable"
        >
          <DailyPulseHero
            vitals={heroVitals}
            central={{
              label:
                central.priority === 'bp'
                  ? 'Blood pressure'
                  : central.label,
              value: central.value,
              sub: buildCentralSub(data, central.priority),
              live: false,
            }}
            onSelectVital={handleVitalPress}
            testID="self-buyer-home-hero"
          />
        </Pressable>

        {/* AI narration card — placeholder string until Sprint 12.5. */}
        <View
          style={{
            paddingHorizontal: theme.spacing.l,
            marginTop: theme.spacing.xxl,
          }}
        >
          <NarrationCard
            theme={theme}
            text={pickNarrationText(central.priority, banner !== null)}
          />
        </View>

        {/* "Worth a read" home-seeded Learn card — Sprint 14. */}
        {seededLearn.article ? (
          <HomeLearnCard
            article={seededLearn.article}
            onArticleOpen={(id) => {
              seededLearn.onArticleOpen(id);
              navigation.navigate('Article', { articleId: id });
            }}
            onDismiss={seededLearn.onDismiss}
            testID="self-buyer-home-learn-card"
          />
        ) : null}

        {/* Vital tile strip — horizontal scroll. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.l,
            paddingVertical: theme.spacing.l,
            gap: theme.spacing.m,
          }}
          testID="self-buyer-home-tile-strip"
        >
          <VitalTile
            vitalType="bp"
            value={
              data.bp.latest
                ? `${data.bp.latest.systolic}/${data.bp.latest.diastolic}`
                : '—'
            }
            secondary="mmHg"
            ringFill={heroVitals.bp.fill}
            state={data.bp.latest ? 'normal' : 'no-data'}
            onPress={() => handleVitalPress('bp')}
            testID="self-buyer-home-tile-bp"
          />
          <VitalTile
            vitalType="hr"
            value={data.hr.restingToday !== null ? String(data.hr.restingToday) : '—'}
            secondary="bpm resting"
            ringFill={heroVitals.hr.fill}
            state={data.hr.restingToday !== null ? 'normal' : 'no-data'}
            onPress={() => handleVitalPress('hr')}
            testID="self-buyer-home-tile-hr"
          />
          <VitalTile
            vitalType="spo2"
            value={data.spo2.latestPercent !== null ? `${data.spo2.latestPercent}%` : '—'}
            secondary="oxygen"
            ringFill={heroVitals.spo2.fill}
            state={data.spo2.latestPercent !== null ? 'normal' : 'no-data'}
            onPress={() => handleVitalPress('spo2')}
            testID="self-buyer-home-tile-spo2"
          />
          <VitalTile
            vitalType="sleep"
            value={
              data.sleep.session
                ? formatSleepHm(data.sleep.session.totalMinutes)
                : '—'
            }
            secondary="last night"
            ringFill={heroVitals.sleep.fill}
            state={data.sleep.session ? 'normal' : 'no-data'}
            onPress={() => handleVitalPress('sleep')}
            testID="self-buyer-home-tile-sleep"
          />
          <VitalTile
            vitalType="activity"
            value={
              data.activity.stepsToday > 0
                ? data.activity.stepsToday.toLocaleString()
                : '—'
            }
            secondary="steps today"
            ringFill={heroVitals.activity.fill}
            state={data.activity.stepsToday > 0 ? 'normal' : 'no-data'}
            onPress={() => handleVitalPress('activity')}
            testID="self-buyer-home-tile-activity"
          />
        </ScrollView>

        {/* Correlation strip — sleep × HR over the last 7 days. */}
        {correlation ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.l,
              marginTop: theme.spacing.l,
            }}
          >
            <CorrelationStrip
              vitalA={correlation.sleep}
              vitalB={correlation.hr}
              range="7d"
              caption="Sleep × resting HR — last 7 days"
              testID="self-buyer-home-correlation"
            />
          </View>
        ) : null}

        {/* Through your day — DaySpine moments. */}
        <View style={{ marginTop: theme.spacing.xxl }}>
          <DaySpine
            moments={moments}
            onSelect={handleMomentPress}
            testID="self-buyer-home-day-spine"
          />
        </View>
      </ScrollView>

      {/* Take a Reading FAB — anchored above the tab bar. */}
      <SelfBuyerFAB
        theme={theme}
        onPress={() => navigation.navigate('TakeReading')}
      />

      {/* Visual tab bar — Home / Trends / Learn / Settings.
          Family was dropped from the self-buyer tab bar in 10c.2:
          family management for the rare hybrid-mode user lives in
          Settings → Family. Learn is a placeholder until Sprint 13/14. */}
      <SelfBuyerTabBar
        theme={theme}
        onSelect={(tab) => {
          switch (tab) {
            case 'home':
              return; // already here
            case 'settings':
              navigation.navigate('Settings');
              return;
            case 'trends':
              navigation.navigate('Trends');
              return;
            case 'learn':
              navigation.navigate('Learn');
              return;
          }
        }}
      />
      {/* Sprint 9.5 / Task 8 — Apple Health / Health Connect opt-in
          (D13 §12.5). Self-buyer asked at end of onboarding (i.e. on
          first home render after onboardingComplete flips). The
          component owns its own visibility — gates on the prompted
          MMKV flag + skips for caregivers. */}
      <HealthPlatformPermissionPrompt />
      {/* Sprint 10a — D8a §9.1 6th-reading auto-paywall. Self-buyer
          variant: same trigger logic, copy switches by account_type. */}
      <SixthReadingPaywallHost accountType="self_buyer" familyId={familyId} />
    </SafeAreaView>
  );
}

// =============================================================================
// Sub-components — kept inline; not used elsewhere as of Sprint 8.
// =============================================================================

interface PulseHeaderProps {
  theme: Theme;
  eyebrow: string;
  greeting: string;
  name: string;
  onAvatarPress: () => void;
}

function PulseHeader({ theme, eyebrow, greeting, name, onAvatarPress }: PulseHeaderProps) {
  const eyebrowStyle = theme.type('labelUppercase');
  const greetingStyle = theme.type('displayM');
  const initial = name.trim().charAt(0).toUpperCase() || 'A';
  return (
    <View
      accessibilityRole="header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.l,
        paddingHorizontal: theme.spacing.l,
        paddingTop: theme.spacing.s,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: eyebrowStyle.family,
            fontSize: eyebrowStyle.size,
            lineHeight: eyebrowStyle.lineHeight,
            letterSpacing: eyebrowStyle.letterSpacing,
            color: theme.colors.text.tertiary,
            textTransform: 'uppercase',
            marginBottom: theme.spacing.xs,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.editorial,
            fontSize: greetingStyle.size,
            lineHeight: greetingStyle.lineHeight,
            color: theme.colors.text.primary,
          }}
        >
          {greeting},{' '}
          <Text style={{ fontStyle: 'italic', color: theme.colors.text.secondary }}>
            {name}
          </Text>
          .
        </Text>
      </View>
      <Pressable
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        hitSlop={8}
        style={({ pressed }) => ({
          width: 38,
          height: 38,
          borderRadius: 99,
          backgroundColor: theme.colors.surface.warmElevated,
          borderWidth: 0.5,
          borderColor: theme.colors.border.rim,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.65 : 1,
        })}
        testID="self-buyer-home-avatar"
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.editorial,
            fontSize: 17,
            color: theme.colors.text.secondary,
          }}
        >
          {initial}
        </Text>
      </Pressable>
    </View>
  );
}

interface NarrationCardProps {
  theme: Theme;
  text: string;
}

function NarrationCard({ theme, text }: NarrationCardProps) {
  const labelStyle = theme.type('labelUppercase');
  const bodyStyle = theme.type('bodyM');
  return (
    <View
      style={{
        padding: theme.spacing.l,
        borderRadius: theme.radii.l,
        backgroundColor: theme.colors.surface.warmSubtle,
        borderWidth: 0.5,
        borderColor: theme.colors.border.rim,
      }}
      testID="self-buyer-home-narration"
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: labelStyle.family,
          fontSize: labelStyle.size,
          lineHeight: labelStyle.lineHeight,
          letterSpacing: labelStyle.letterSpacing,
          color: theme.colors.brand.coral,
          textTransform: 'uppercase',
          marginBottom: theme.spacing.s,
        }}
      >
        Leiko · this morning
      </Text>
      <Text
        style={{
          fontFamily: bodyStyle.family,
          fontSize: bodyStyle.size,
          lineHeight: bodyStyle.lineHeight,
          color: theme.colors.text.primary,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

interface SelfBuyerFABProps {
  theme: Theme;
  onPress: () => void;
}

function SelfBuyerFAB({ theme, onPress }: SelfBuyerFABProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Take a reading"
      accessibilityHint="Walks you through taking a reading on your watch"
      onPress={onPress}
      testID="self-buyer-home-fab"
      style={({ pressed }) => ({
        position: 'absolute',
        right: theme.spacing.xl,
        bottom: theme.spacing.xxxxl + theme.spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 99,
        backgroundColor: pressed
          ? theme.colors.brand.primaryPressed
          : theme.colors.brand.coral,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.elevation.medium.ios,
        ...theme.elevation.medium.android,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fontFamilies.display,
          fontSize: 28,
          lineHeight: 28,
          color: theme.colors.text.onBrand,
        }}
      >
        +
      </Text>
    </Pressable>
  );
}

// Sprint 10c.2 polish — IA review: self-buyers' mental model is
// "understand my numbers", not family. Family management lives in
// Settings (where it belongs for the rare hybrid-mode user). The 4th
// tab now hosts Learn — Sprint 13/14 will ship the real cards.
type SelfBuyerTab = 'home' | 'trends' | 'learn' | 'settings';

interface SelfBuyerTabBarProps {
  theme: Theme;
  onSelect: (tab: SelfBuyerTab) => void;
}

function SelfBuyerTabBar({ theme, onSelect }: SelfBuyerTabBarProps) {
  const tabs: Array<{ id: SelfBuyerTab; label: string; active: boolean }> = [
    { id: 'home', label: 'Home', active: true },
    { id: 'trends', label: 'Trends', active: false },
    { id: 'learn', label: 'Learn', active: false },
    { id: 'settings', label: 'Settings', active: false },
  ];
  const labelStyle = theme.type('labelUppercase');
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute',
        left: theme.spacing.m,
        right: theme.spacing.m,
        bottom: theme.spacing.xxl,
        height: 60,
        borderRadius: 28,
        backgroundColor: theme.colors.surface.warmElevated,
        borderWidth: 0.5,
        borderColor: theme.colors.border.rim,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: theme.spacing.s,
        ...theme.elevation.high.ios,
        ...theme.elevation.high.android,
      }}
      testID="self-buyer-home-tab-bar"
    >
      {tabs.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => onSelect(t.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: t.active }}
          accessibilityLabel={t.label}
          hitSlop={8}
          testID={`self-buyer-home-tab-${t.id}`}
          style={({ pressed }) => ({
            paddingHorizontal: theme.spacing.l,
            paddingVertical: theme.spacing.s,
            borderRadius: 16,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              lineHeight: labelStyle.lineHeight,
              letterSpacing: labelStyle.letterSpacing,
              textTransform: 'uppercase',
              color: t.active
                ? theme.colors.brand.coral
                : theme.colors.text.tertiary,
            }}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// =============================================================================
// Helpers — pure transforms over DailyPulseData. Exported for the test
// suite when sensible (banner derivation tested as part of integration).
// =============================================================================

/** D13 §7.1 ring fill formulas + per-satellite display + unit strings.
 *  Produces the heroVitals shape consumed by the constellation hero. */
export function buildHeroVitals(
  data: ReturnType<typeof useDailyPulseData>,
): DailyPulseHeroVitals {
  const bpFill = bpFillFromTier(data.bp.classification?.tier);
  const hrFill = data.hr.restingToday !== null
    ? clamp01((data.hr.restingToday - 40) / 80)
    : 0;
  const spo2Fill = data.spo2.latestPercent !== null
    ? clamp01((data.spo2.latestPercent - 85) / 15)
    : 0;
  const sleepFill = data.sleep.session
    ? clamp01(data.sleep.session.sleepScore / 100)
    : 0;
  const activityFill = data.activity.targetSteps > 0
    ? clamp01(data.activity.stepsToday / data.activity.targetSteps)
    : 0;

  const bp = data.bp.latest;
  return {
    bp: {
      fill: bpFill,
      display: bp ? `${bp.systolic}/${bp.diastolic}` : '—',
      unit: 'mmHg',
    },
    hr: {
      fill: hrFill,
      display:
        data.hr.restingToday !== null ? String(data.hr.restingToday) : '—',
      unit: 'bpm',
    },
    spo2: {
      fill: spo2Fill,
      display:
        data.spo2.latestPercent !== null ? `${data.spo2.latestPercent}` : '—',
      unit: '%',
    },
    sleep: {
      fill: sleepFill,
      display: data.sleep.session
        ? formatSleepHm(data.sleep.session.totalMinutes)
        : '—',
      unit: 'hrs',
    },
    activity: {
      fill: activityFill,
      display:
        data.activity.stepsToday > 0
          ? data.activity.stepsToday.toLocaleString()
          : '—',
      unit: 'steps',
    },
  };
}

/**
 * Builds the small mono caption that sits under the giant value inside
 * the central BP ring. Per the constellation design: "mmHg · 6:42 am"
 * for fresh BP, falls through to a unit-only caption for the HR / sleep
 * cascade states. Pure helper.
 */
export function buildCentralSub(
  data: ReturnType<typeof useDailyPulseData>,
  priority: 'bp' | 'hr' | 'sleep' | 'none',
): string | undefined {
  switch (priority) {
    case 'bp': {
      if (!data.bp.latestSampleSec) return 'mmHg';
      const t = new Date(data.bp.latestSampleSec * 1000).toLocaleTimeString(
        undefined,
        { hour: 'numeric', minute: '2-digit' },
      );
      return `mmHg · ${t}`;
    }
    case 'hr':
      return 'bpm · resting';
    case 'sleep':
      return 'last night';
    case 'none':
    default:
      return undefined;
  }
}

function bpFillFromTier(tier: string | null | undefined): number {
  // D13 §7.1: in_pattern → 1.0, calm_concerned → 0.5, confirmed_urgent → 0.25,
  // no data → 0. Activity has its own ring formula above.
  switch (tier) {
    case 'in_pattern':
      return 1.0;
    case 'calm_concerned':
      return 0.5;
    case 'confirmed_urgent':
      return 0.25;
    default:
      return 0;
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

interface BannerState {
  severity: 'calm-concerned' | 'confirmed-urgent';
  title: string;
  body: string;
  cta?: { label: string; onPress: () => void };
}

function deriveBanner(
  data: ReturnType<typeof useDailyPulseData>,
): BannerState | null {
  const tier = data.bp.classification?.tier;
  if (tier === 'confirmed_urgent') {
    return {
      severity: 'confirmed-urgent',
      title: 'Talk to your doctor today',
      body: 'These last few readings are unusually high. We recommend talking to your doctor today.',
    };
  }
  if (tier === 'calm_concerned') {
    return {
      severity: 'calm-concerned',
      title: 'Worth a look',
      body: 'A few of your recent readings have been higher than usual. Might be worth talking to your doctor.',
    };
  }
  return null;
}

function pickNarrationText(
  priority: 'bp' | 'hr' | 'sleep' | 'none',
  hasAnomaly: boolean,
): string {
  // Sprint 12.5 replaces these with the real ambient-AI generator.
  // Keep them voice-rule clean and Reassuring/Calm-concerned per priority.
  if (hasAnomaly) {
    return "We've noticed a pattern. Your numbers below tell the rest of the story.";
  }
  switch (priority) {
    case 'bp':
      return PLACEHOLDER_AI_NARRATION;
    case 'hr':
      return 'No reading yet today. Your heart and night so far are below.';
    case 'sleep':
      return "Last night's rest is in. A reading will round out the picture.";
    case 'none':
      return "It's been quiet. Take a reading whenever you're ready.";
  }
}

function buildHeader(displayName: string | undefined): {
  date: string;
  greeting: string;
  name: string;
} {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const month = now.toLocaleDateString(undefined, { month: 'long' });
  const date = `${weekday} · ${month} ${now.getDate()}`;
  const hours = now.getHours();
  const greeting =
    hours < 5
      ? 'Good night'
      : hours < 12
        ? 'Good morning'
        : hours < 18
          ? 'Good afternoon'
          : 'Good evening';
  const name = displayName?.trim() ? displayName.split(' ')[0] : 'friend';
  return { date, greeting, name };
}

function buildCorrelation(
  sleepRecent: ReturnType<typeof useSleep.getState>['recent'],
  hrRecent: ReturnType<typeof useHR.getState>['recent'],
): { sleep: VitalSeries; hr: VitalSeries } | null {
  // Last 7 days of sleepScore + restingHR. Empty → null (renderer hides
  // the strip until enough data lands).
  const cutoffSec = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const sleepPoints = sleepRecent
    .filter((s) => s.sessionEndSec >= cutoffSec)
    .map((s) => ({ t: s.sessionEndSec, value: s.sleepScore }));
  const hrPoints = hrRecent
    .filter((h) => h.measuredAtSec >= cutoffSec && h.motionState === 'rest')
    .map((h) => ({ t: h.measuredAtSec, value: h.bpm }));
  if (sleepPoints.length === 0 && hrPoints.length === 0) return null;
  return {
    sleep: { type: 'sleep', points: sleepPoints },
    hr: { type: 'hr', points: hrPoints },
  };
}

function formatSleepHm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
});
