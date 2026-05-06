// Reusable timezone picker for onboarding flows. Sprint 4 (extracted from
// the caregiver FamilyParent screen so the self-buyer You screen can
// reuse it).
//
// Sprint scope: a curated short-list covering Nigeria + US + common
// diaspora destinations. Sprint 17 (or earlier if needed) replaces this
// with a full searchable IANA list. The auto-detected device zone is
// the default; tapping the field opens a BottomSheet with the curated
// list. The custom zone passed in is shown as the current selection
// even if it's not in the curated list (renders the raw IANA string).

import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { ListRow } from './ListRow';
import { useTheme } from '../theme';

export interface ZoneOption {
  iana: string;
  label: string;
}

export const COMMON_ZONES: ZoneOption[] = [
  { iana: 'Africa/Lagos', label: 'Lagos, Nigeria' },
  { iana: 'Africa/Accra', label: 'Accra, Ghana' },
  { iana: 'Europe/London', label: 'London, UK' },
  { iana: 'America/New_York', label: 'New York, USA' },
  { iana: 'America/Chicago', label: 'Chicago, USA' },
  { iana: 'America/Denver', label: 'Denver, USA' },
  { iana: 'America/Los_Angeles', label: 'Los Angeles, USA' },
  { iana: 'America/Phoenix', label: 'Phoenix, USA' },
  { iana: 'America/Anchorage', label: 'Anchorage, USA' },
  { iana: 'Pacific/Honolulu', label: 'Honolulu, USA' },
];

export function labelForZone(iana: string): string {
  return COMMON_ZONES.find((z) => z.iana === iana)?.label ?? iana;
}

interface TimezonePickerProps {
  value: string;                            // current IANA zone
  onChange: (iana: string) => void;
  /**
   * The accessibility role / wording for the trigger field. Defaults to
   * "Their timezone" (caregiver framing). Self-buyer screens override
   * to "Your timezone."
   */
  fieldA11yPrefix?: string;
  sheetTitle?: string;
  testID?: string;
}

export function TimezonePicker({
  value,
  onChange,
  fieldA11yPrefix = 'Their timezone',
  sheetTitle = 'Choose timezone',
  testID,
}: TimezonePickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const body = theme.type('bodyL');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fieldA11yPrefix}: ${labelForZone(value)}. Tap to change.`}
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
          {labelForZone(value)}
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
        onDismiss={() => setOpen(false)}
        size="tall"
        title={sheetTitle}
        testID={testID ? `${testID}-sheet` : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          {COMMON_ZONES.map((z) => (
            <ListRow
              key={z.iana}
              variant="select"
              title={z.label}
              subtitle={z.iana}
              selected={z.iana === value}
              onPress={() => {
                onChange(z.iana);
                setOpen(false);
              }}
              accessibilityLabel={`${z.label}${z.iana === value ? ', current selection' : ''}`}
              testID={testID ? `${testID}-${z.iana}` : undefined}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}
