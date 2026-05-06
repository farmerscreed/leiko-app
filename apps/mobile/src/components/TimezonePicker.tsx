// Reusable timezone picker for onboarding flows. Sprint 4 (extracted
// from caregiver FamilyParent) → enhanced post-Sprint-4 with full IANA
// coverage + search.
//
// Sections in the bottom sheet:
//   1. Search box (always visible)
//   2. "Your device" — the auto-detected zone, pinned at the very top
//      so users in non-curated regions land on it immediately. Hidden
//      when the device zone matches a curated entry (it would already
//      appear in section 3).
//   3. "Common" — the hand-curated short-list (Lagos, NYC, etc.).
//      Hidden when search is active, since search filters across
//      everything.
//   4. "All locations" — the full IANA list, alphabetised. Filtered
//      by search.
//
// The catalogue + label formatting come from src/utils/timezones.ts so
// this component stays presentation-only.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { ListRow } from './ListRow';
import { useTheme } from '../theme';
import {
  filterZones,
  formatZoneLabel,
  getCuratedZones,
  getZoneOptions,
} from '../utils/timezones';

// Re-exports kept so existing imports in other files (and tests) can
// still pull these from the picker module if they want.
export { formatZoneLabel as labelForZone };
export { getCuratedZones as COMMON_ZONES };

interface TimezonePickerProps {
  value: string;                            // current IANA zone
  onChange: (iana: string) => void;
  /**
   * Auto-detected device zone. Pinned at the top of the sheet when
   * it isn't already in the curated list. If omitted, the picker
   * falls back to Intl.DateTimeFormat().resolvedOptions().timeZone.
   */
  deviceZone?: string;
  /**
   * Accessibility prefix on the trigger field. "Their timezone" for
   * caregivers, "Your timezone" for self-buyers.
   */
  fieldA11yPrefix?: string;
  sheetTitle?: string;
  testID?: string;
}

function detectDeviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TimezonePicker({
  value,
  onChange,
  deviceZone: deviceZoneProp,
  fieldA11yPrefix = 'Their timezone',
  sheetTitle = 'Choose timezone',
  testID,
}: TimezonePickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const body = theme.type('bodyL');
  const label = theme.type('label');

  const allOptions = useMemo(() => getZoneOptions(), []);
  const curated = useMemo(() => getCuratedZones(), []);
  const deviceZone = deviceZoneProp ?? detectDeviceZone();
  const deviceZoneIsCurated = useMemo(
    () => curated.some((z) => z.iana === deviceZone),
    [curated, deviceZone],
  );

  // When there's no search query, the "All locations" section shows
  // only non-curated zones (curated already appear in the Common
  // section above; rendering them twice creates duplicate testIDs and
  // wastes screen space). When a search query is active, we filter
  // across everything so the user can find any zone whether it's
  // curated or not.
  const filtered = useMemo(() => {
    const trimmed = search.trim();
    if (trimmed.length === 0) {
      return allOptions.filter((z) => !z.curated);
    }
    return filterZones(allOptions, trimmed);
  }, [allOptions, search]);

  const handlePick = (iana: string) => {
    onChange(iana);
    setOpen(false);
    setSearch('');
  };

  const handleDismiss = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fieldA11yPrefix}: ${formatZoneLabel(value)}. Tap to change.`}
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [
          {
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radii.m,
            paddingHorizontal: theme.spacing.l,
            paddingVertical: theme.spacing.m,
            borderWidth: 1,
            borderColor: theme.colors.border.default,
            minHeight: theme.minTapTarget,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: body.size,
            fontFamily: body.family,
          }}
        >
          {formatZoneLabel(value)}
        </Text>
        <Text
          style={{
            color: theme.colors.brand.primary,
            fontSize: body.size,
            fontFamily: body.family,
          }}
        >
          Change
        </Text>
      </Pressable>

      <BottomSheet
        visible={open}
        onDismiss={handleDismiss}
        size="tall"
        title={sheetTitle}
        testID={testID ? `${testID}-sheet` : undefined}
      >
        <View style={{ marginBottom: theme.spacing.s }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search city or country"
            placeholderTextColor={theme.colors.text.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            testID={testID ? `${testID}-search` : undefined}
            accessibilityLabel="Search for a timezone"
            style={{
              backgroundColor: theme.colors.surface.subtle,
              borderRadius: theme.radii.m,
              paddingHorizontal: theme.spacing.l,
              paddingVertical: theme.spacing.s,
              fontSize: body.size,
              fontFamily: body.family,
              color: theme.colors.text.primary,
              borderWidth: 1,
              borderColor: theme.colors.border.default,
              minHeight: theme.minTapTarget,
            }}
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Device zone — pinned at top when it's NOT in the curated list. */}
          {!deviceZoneIsCurated && search.trim().length === 0 ? (
            <>
              <SectionHeader theme={theme} labelStyle={label}>
                Your device
              </SectionHeader>
              <ListRow
                variant="select"
                title={formatZoneLabel(deviceZone)}
                subtitle={deviceZone}
                selected={deviceZone === value}
                onPress={() => handlePick(deviceZone)}
                accessibilityLabel={`${formatZoneLabel(deviceZone)}, your device timezone`}
                testID={testID ? `${testID}-device` : undefined}
              />
            </>
          ) : null}

          {/* Common shortlist — only when no search query. */}
          {search.trim().length === 0 ? (
            <>
              <SectionHeader theme={theme} labelStyle={label}>
                Common
              </SectionHeader>
              {curated.map((z) => (
                <ListRow
                  key={z.iana}
                  variant="select"
                  title={z.label}
                  subtitle={z.iana}
                  selected={z.iana === value}
                  onPress={() => handlePick(z.iana)}
                  accessibilityLabel={`${z.label}${z.iana === value ? ', current selection' : ''}`}
                  testID={testID ? `${testID}-${z.iana}` : undefined}
                />
              ))}
            </>
          ) : null}

          {/* Full list (all zones), filtered by search. */}
          <SectionHeader theme={theme} labelStyle={label}>
            {search.trim().length > 0 ? 'Results' : 'All locations'}
          </SectionHeader>
          {filtered.length === 0 ? (
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: body.size,
                fontFamily: body.family,
                paddingHorizontal: theme.spacing.l,
                paddingVertical: theme.spacing.l,
              }}
              testID={testID ? `${testID}-empty` : undefined}
            >
              No matches. Try a city or country name.
            </Text>
          ) : (
            filtered.map((z) => (
              <ListRow
                key={z.iana}
                variant="select"
                title={z.label}
                subtitle={z.iana}
                selected={z.iana === value}
                onPress={() => handlePick(z.iana)}
                accessibilityLabel={`${z.label}${z.iana === value ? ', current selection' : ''}`}
                testID={testID ? `${testID}-${z.iana}` : undefined}
              />
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

interface SectionHeaderProps {
  theme: ReturnType<typeof useTheme>;
  labelStyle: ReturnType<ReturnType<typeof useTheme>['type']>;
  children: string;
}

function SectionHeader({ theme, labelStyle, children }: SectionHeaderProps) {
  return (
    <Text
      style={[
        styles.sectionHeader,
        {
          color: theme.colors.text.secondary,
          fontSize: labelStyle.size,
          fontFamily: labelStyle.family,
          fontWeight: labelStyle.weight as '500',
          paddingHorizontal: theme.spacing.l,
          paddingTop: theme.spacing.l,
          paddingBottom: theme.spacing.xs,
        },
      ]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { textTransform: 'uppercase', letterSpacing: 0.6 },
});
