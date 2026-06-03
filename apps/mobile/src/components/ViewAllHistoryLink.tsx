// ViewAllHistoryLink — the honest footer under a VitalDetail recent list
// (ADR-0008 follow-up). The local lists are capped (offline-first slices);
// this link shows the TRUE server total for the selected range and opens
// the VitalHistory screen that pages all of it. Renders nothing while the
// count is unknown, when the family is unresolved, or when there is no
// data (the detail screen's empty state owns that story).

import { Pressable, Text } from 'react-native';
import type { TrendRange } from './TimeRangePills';
import { useVitalHistoryCount } from '../hooks/useVitalHistory';
import type { VitalHistoryKind } from '../services/vitalHistory';
import { useTheme } from '../theme';

const KIND_NOUN: Record<VitalHistoryKind, string> = {
  bp: 'readings',
  spo2: 'readings',
  sleep: 'nights',
  activity: 'days',
};

export interface ViewAllHistoryLinkProps {
  kind: VitalHistoryKind;
  familyId: string | null;
  range: TrendRange;
  onPress: () => void;
  testID?: string;
}

export function ViewAllHistoryLink({
  kind,
  familyId,
  range,
  onPress,
  testID,
}: ViewAllHistoryLinkProps) {
  const theme = useTheme();
  const count = useVitalHistoryCount(kind, familyId, range);
  if (!familyId || count === null || count === 0) return null;

  const bodyStyle = theme.type('bodyM');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View all ${count} ${KIND_NOUN[kind]} for this period`}
      hitSlop={theme.spacing.s}
      testID={testID}
      style={{
        marginHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.m,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: theme.colors.brand.primary,
          fontSize: bodyStyle.size,
          fontFamily: bodyStyle.family,
          fontWeight: '500',
        }}
      >
        View all · {count} {KIND_NOUN[kind]}
      </Text>
    </Pressable>
  );
}
