// "For your doctor" — Trends v2 follow-up.
//
// Single-job screen: generate a doctor-shareable PDF of recent
// five-vital pattern. Sourced from `plans/for-your-doctor-design-brief.md`
// and the founder-approved Option A "The Cover Letter" mockup in
// the design canvas bundle. The PDF flow that used to live on
// Trends now lives here; Trends v2 only carries an inline link.
//
// Layout (top → bottom), per the design:
//   1. Header                — back chevron + "Leiko · Share" eyebrow
//   2. Title block           — "For your doctor." (italic on "doctor")
//                              + italic-serif cover-letter sub-line
//   3. Range label + chips   — segmented control style, locked chips
//                              for free users
//   4. Preview card          — DoctorCoverPreview thumbnail + page tag
//   5. Note field            — optional cover-page line (stretch in
//                              brief; included per the design landing)
//   6. Options block         — Include notes / Include caregiver comments
//   7. Generate CTA          — primary button. Free tap → paywall.
//
// State machine (per the brief §9):
//   default → user can tweak → generating → ok (share sheet opens)
//                                         → error → ErrorState
//   empty (no readings) → EmptyState; preview/options/CTA hidden
//   offline → globally banner; CTA error copy

import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type Theme } from '../../theme';
import { useAuth } from '../../state/auth';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';
import { useTrendsData } from '../../hooks/useTrendsData';
import { usePlusEntitlement } from '../../hooks/usePlusEntitlement';
import { Pill } from '../../components/Pill';
import { Button } from '../../components/Button';
import { ListRow } from '../../components/ListRow';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { PaywallSheet } from '../../components/PaywallSheet';
import { DoctorCoverPreview } from '../../components/DoctorCoverPreview';
import { DoctorNoteField } from '../../components/DoctorNoteField';
import {
  generateDoctorPdf,
  pdfRangeFromTrendsRange,
  DOCTOR_PDF_RANGES,
  type DoctorPdfRange,
  type DoctorPdfResult,
} from '../../services/doctorPdf';
import { logger } from '../../services/analytics/logger';
import type { AccountType } from '../../types/database';
import type {
  CaregiverScreenProps,
  SelfBuyerScreenProps,
} from '../../navigation/types';

// Strings — voice-lint tested at the bottom of this file's test.
export const FYD_STRINGS = {
  eyebrow: 'Leiko · Share',
  subtitleSelf: 'A summary of your last {range} of readings, in a format your doctor can scan in a minute.',
  subtitleCaregiver: 'A summary of her last {range} of readings, in a format her doctor can scan in a minute.',
  rangeEyebrow: 'Cover the last',
  pagesPdf: '8 pages · PDF',
  pdfFootnote: 'Cover · Vitals · Cross-vital observations',
  optionIncludeNotes: 'Include notes',
  optionIncludeNotesSub: 'The lines you wrote on individual readings',
  optionIncludeComments: 'Include caregiver comments',
  optionIncludeCommentsSub: 'Anything you noted from your visits',
  generateLabel: 'Generate PDF',
  generatingLabel: 'Putting your report together…',
  retryLabel: 'Try again',
  errorBody: "We couldn't put it together just now.",
  emptyTitle: 'No readings to share yet',
  emptyBody: "Take a few readings this week and they'll appear here.",
  offlineHint: 'We need a connection to put this together.',
  plusUnlock: 'Plus unlocks 30 days and beyond',
} as const;

type Phase = 'default' | 'generating' | 'error';

type Nav =
  | CaregiverScreenProps<'ForYourDoctor'>
  | SelfBuyerScreenProps<'ForYourDoctor'>
  | {
      navigation: { goBack: () => void };
      route?: { params?: { range?: string } };
    };

const RANGE_WORD: Record<DoctorPdfRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': 'year',
};

const RANGE_LABEL: Record<DoctorPdfRange, string> = {
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  '1y': '1Y',
};

function subtitleCopy(accountType: AccountType, range: DoctorPdfRange): string {
  const tmpl =
    accountType === 'caregiver'
      ? FYD_STRINGS.subtitleCaregiver
      : FYD_STRINGS.subtitleSelf;
  return tmpl.replace('{range}', RANGE_WORD[range]);
}

function dateRangeLabel(range: DoctorPdfRange, nowMs: number = Date.now()): string {
  const end = new Date(nowMs);
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const start = new Date(nowMs - (days - 1) * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const yearLabel = end.getFullYear();
  return `${fmt(start)} – ${fmt(end)}, ${yearLabel}`;
}

export function ForYourDoctorScreen(props: Nav) {
  const theme = useTheme();
  const nav = props.navigation as { goBack: () => void };
  const initialRange = props.route?.params?.range as
    | DoctorPdfRange
    | 'all_time'
    | undefined;

  const profile = useAuth((s) => s.profile);
  const accountType: AccountType = profile?.account_type ?? 'self_buyer';
  const preparedFor = profile?.display_name ?? 'Adaeze Okeke';

  const { isPlus } = usePlusEntitlement();
  const { parents } = useFamilyReadings();
  const familyId = parents[0]?.familyId ?? null;
  const userId = useAuth((s) => s.session?.user.id ?? null);

  // Default range: 7d (free) or 30d (Plus); honour the deep-link
  // range carried from Trends when present.
  const defaultRange: DoctorPdfRange = isPlus ? '30d' : '7d';
  const [range, setRange] = useState<DoctorPdfRange>(
    pdfRangeFromTrendsRange(initialRange, defaultRange),
  );

  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('default');
  const [paywallVisible, setPaywallVisible] = useState(false);

  const trends = useTrendsData(familyId, range);
  const isEmpty = (trends.data?.summary.bp.count ?? 0) === 0;
  const sparkline = useMemo(
    () => (trends.data?.series.bp ?? []).map((p) => p.sys),
    [trends.data],
  );

  const onRangeTap = useCallback(
    (next: DoctorPdfRange) => {
      if (next !== '7d' && !isPlus) {
        setPaywallVisible(true);
        return;
      }
      setRange(next);
    },
    [isPlus],
  );

  const onGenerate = useCallback(async () => {
    if (!isPlus) {
      setPaywallVisible(true);
      return;
    }
    if (!familyId || !userId) {
      setPhase('error');
      return;
    }
    logger.track('doctor_pdf_requested', { range });
    setPhase('generating');
    const result: DoctorPdfResult = await generateDoctorPdf({
      familyId,
      userId,
      range,
      includeNotes,
      includeComments,
    });
    if (result.status === 'ok') {
      logger.track('doctor_pdf_generated', { bytes: result.bytes });
      try {
        await Share.share({
          url: result.url,
          message: subtitleCopy(accountType, range),
        });
      } catch {
        // OS sheet dismissed — nothing to do.
      }
      setPhase('default');
      return;
    }
    if (result.status === 'mock') {
      // Local dev path — sandbox returns mock HTML. Treat as
      // success for UX purposes; the engineer running the dev
      // build can read the HTML separately if needed.
      logger.track('doctor_pdf_generated', { bytes: result.htmlBytes });
      setPhase('default');
      return;
    }
    logger.track('doctor_pdf_failed', { reason: result.reason });
    setPhase('error');
  }, [accountType, familyId, userId, range, includeNotes, includeComments, isPlus]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="for-your-doctor-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: theme.spacing.xxxxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Header theme={theme} onBack={() => nav.goBack()} />

        <TitleBlock
          theme={theme}
          accountType={accountType}
          rangeLabel={RANGE_WORD[range]}
        />

        {isEmpty ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              title={FYD_STRINGS.emptyTitle}
              body={FYD_STRINGS.emptyBody}
              testID="fyd-empty"
            />
          </View>
        ) : (
          <>
            <RangeBlock
              theme={theme}
              active={range}
              isPlus={isPlus}
              onRangeTap={onRangeTap}
            />

            <View
              style={{
                marginHorizontal: theme.spacing.xxl,
                marginTop: theme.spacing.xl,
              }}
            >
              <DoctorCoverPreview
                preparedFor={preparedFor}
                rangeLabel={RANGE_WORD[range]}
                datesLabel={dateRangeLabel(range)}
                accountType={accountType}
                sparkline={sparkline}
                freeUser={!isPlus}
                testID="fyd-preview"
              />
              <View style={[styles.pagesPdfTag, { backgroundColor: theme.colors.surface.warmBase, borderColor: theme.colors.brand.primary }]}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fontFamilies.numeric,
                    fontSize: 9,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: theme.colors.brand.primary,
                  }}
                  testID="fyd-pages-tag"
                >
                  {FYD_STRINGS.pagesPdf}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fontFamilies.numeric,
                  fontSize: 9.5,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: theme.colors.text.tertiary,
                  textAlign: 'center',
                  marginTop: theme.spacing.s,
                }}
                testID="fyd-pdf-footnote"
              >
                {FYD_STRINGS.pdfFootnote}
              </Text>
            </View>

            <DoctorNoteField
              value={note}
              onChange={setNote}
              accountType={accountType}
              testID="fyd-note"
            />

            <View
              style={{
                marginHorizontal: theme.spacing.l,
                marginTop: theme.spacing.xl,
                borderRadius: theme.radii.l,
                backgroundColor: theme.colors.surface.warmSubtle,
                borderColor: theme.colors.border.subtle,
                borderWidth: StyleSheet.hairlineWidth,
                overflow: 'hidden',
              }}
            >
              <ListRow
                variant="toggle"
                title={FYD_STRINGS.optionIncludeNotes}
                subtitle={FYD_STRINGS.optionIncludeNotesSub}
                switchValue={includeNotes}
                onSwitchChange={setIncludeNotes}
                showDivider={accountType === 'caregiver'}
                testID="fyd-include-notes"
              />
              {accountType === 'caregiver' ? (
                <ListRow
                  variant="toggle"
                  title={FYD_STRINGS.optionIncludeComments}
                  subtitle={FYD_STRINGS.optionIncludeCommentsSub}
                  switchValue={includeComments}
                  onSwitchChange={setIncludeComments}
                  showDivider={false}
                  testID="fyd-include-comments"
                />
              ) : null}
            </View>

            <View
              style={{
                marginHorizontal: theme.spacing.l,
                marginTop: theme.spacing.xl,
              }}
            >
              <Button
                variant="primary"
                onPress={() => {
                  void onGenerate();
                }}
                loading={phase === 'generating'}
                accessibilityHint={
                  isPlus
                    ? 'Generates the PDF and opens the share sheet.'
                    : 'Opens the Leiko Plus paywall.'
                }
                testID="fyd-generate"
              >
                {phase === 'generating'
                  ? FYD_STRINGS.generatingLabel
                  : phase === 'error'
                    ? FYD_STRINGS.retryLabel
                    : FYD_STRINGS.generateLabel}
              </Button>
              {!isPlus ? (
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fontFamilies.numeric,
                    fontSize: 9,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: theme.colors.brand.primary,
                    textAlign: 'center',
                    marginTop: theme.spacing.s,
                  }}
                  testID="fyd-plus-unlock"
                >
                  {FYD_STRINGS.plusUnlock}
                </Text>
              ) : null}
              {phase === 'error' ? (
                <View
                  style={{
                    marginTop: theme.spacing.m,
                  }}
                >
                  <ErrorState
                    title={FYD_STRINGS.errorBody}
                    body={FYD_STRINGS.offlineHint}
                    onRetry={() => {
                      void onGenerate();
                    }}
                    testID="fyd-error"
                  />
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <PaywallSheet
        visible={paywallVisible}
        onDismiss={() => setPaywallVisible(false)}
        accountType={accountType}
        trigger="pdf_export"
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Header({ theme, onBack }: { theme: Theme; onBack: () => void }) {
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.l,
        paddingTop: theme.spacing.l,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.m,
        }}
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
          style={{ flexDirection: 'row', alignItems: 'center' }}
          testID="fyd-back"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M15 6l-6 6 6 6"
              fill="none"
              stroke={theme.colors.text.secondary}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fontFamilies.numeric,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: theme.colors.text.secondary,
              marginLeft: 6,
            }}
          >
            Back
          </Text>
        </Pressable>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: 9.5,
            letterSpacing: 2.0,
            textTransform: 'uppercase',
            color: theme.colors.brand.primary,
          }}
          testID="fyd-header-eyebrow"
        >
          {FYD_STRINGS.eyebrow}
        </Text>
      </View>
    </View>
  );
}

function TitleBlock({
  theme,
  accountType,
  rangeLabel,
}: {
  theme: Theme;
  accountType: AccountType;
  rangeLabel: string;
}) {
  const possessive = accountType === 'caregiver' ? 'her' : 'your';
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.l,
        paddingTop: theme.spacing.xs,
      }}
    >
      <Text
        accessibilityRole="header"
        allowFontScaling={false}
        style={{
          fontFamily: theme.fontFamilies.editorial,
          fontSize: 32,
          lineHeight: 34,
          color: theme.colors.text.primary,
          letterSpacing: -0.6,
        }}
        testID="fyd-title"
      >
        <Text>For {possessive} </Text>
        <Text
          style={{
            fontFamily: theme.fontFamilies.editorialItalic,
            fontStyle: 'italic',
            color: theme.colors.brand.primary,
          }}
        >
          doctor
        </Text>
        <Text>.</Text>
      </Text>
      <Text
        style={{
          marginTop: theme.spacing.s,
          fontFamily: theme.fontFamilies.editorialItalic,
          fontSize: 14,
          lineHeight: 20,
          color: theme.colors.text.secondary,
          fontStyle: 'italic',
        }}
        testID="fyd-subtitle"
      >
        A summary of {possessive} last {rangeLabel} of readings, in a format {possessive} doctor can scan in a minute.
      </Text>
    </View>
  );
}

function RangeBlock({
  theme,
  active,
  isPlus,
  onRangeTap,
}: {
  theme: Theme;
  active: DoctorPdfRange;
  isPlus: boolean;
  onRangeTap: (r: DoctorPdfRange) => void;
}) {
  return (
    <View
      style={{
        marginTop: theme.spacing.xl,
        paddingHorizontal: theme.spacing.l,
      }}
      testID="fyd-range-block"
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fontFamilies.numeric,
          fontSize: 9,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: theme.colors.text.tertiary,
          marginBottom: theme.spacing.s,
        }}
        testID="fyd-range-eyebrow"
      >
        {FYD_STRINGS.rangeEyebrow}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.xs,
        }}
      >
        {DOCTOR_PDF_RANGES.map((r) => {
          const isActive = active === r;
          const locked = r !== '7d' && !isPlus;
          return (
            <Pill
              key={r}
              variant={isActive ? 'accent' : 'outline'}
              selected={isActive}
              onPress={() => onRangeTap(r)}
              accessibilityLabel={locked ? `${RANGE_LABEL[r]} (Plus only)` : RANGE_LABEL[r]}
              testID={`fyd-range:${r}`}
            >
              {RANGE_LABEL[r]}
            </Pill>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 80 },
  pagesPdfTag: {
    position: 'absolute',
    top: -10,
    right: -8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
