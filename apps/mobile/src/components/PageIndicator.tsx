// Page indicator — Sprint 3 caregiver intros (docs/04-screens/caregiver-onboarding.md
// §4.2). N dots, active dot is brand navy, inactive dots are border.default.
// Per the spec's accessibility note: announce as "Page X of N" via a single
// accessible View; the dots themselves are decorative.

import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

interface PageIndicatorProps {
  total: number;
  current: number;       // 1-based
  testID?: string;
}

export function PageIndicator({ total, current, testID }: PageIndicatorProps) {
  const theme = useTheme();
  const dots = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Page ${current} of ${total}`}
      testID={testID}
      style={styles.row}
    >
      {dots.map((n) => {
        const active = n === current;
        return (
          <View
            key={n}
            style={[
              styles.dot,
              {
                marginHorizontal: theme.spacing.xs,
                backgroundColor: active
                  ? theme.colors.brand.primary
                  : theme.colors.border.subtle,
                width: active ? 10 : 8,
                height: active ? 10 : 8,
                borderRadius: theme.radii.full,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot: {},
});
