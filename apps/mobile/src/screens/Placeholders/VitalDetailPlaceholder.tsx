// VitalDetail placeholder — Sprint 8 hand-off to Sprint 8.5.
//
// SelfBuyerHome's vital tiles + DaySpine moments route here. The real
// per-vital detail screens (BP, HR, SpO2, Sleep, Activity) ship in
// Sprint 8.5 per docs/_reference/D13-multi-vitals-constellation-spec.md
// §8. Until then, this placeholder confirms the route works and gives
// the user a calm, voice-rule-clean exit.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import type { SelfBuyerStackParamList } from '../../navigation/types';

const VITAL_LABEL: Record<
  SelfBuyerStackParamList['VitalDetail']['vital'],
  string
> = {
  bp: 'Blood pressure',
  hr: 'Heart rate',
  spo2: 'Oxygen',
  sleep: 'Sleep',
  activity: 'Activity',
};

export function VitalDetailPlaceholder() {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<SelfBuyerStackParamList>>();
  const route = useRoute<RouteProp<SelfBuyerStackParamList, 'VitalDetail'>>();
  const vitalLabel = VITAL_LABEL[route.params.vital];

  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');
  const labelStyle = theme.type('label');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
    >
      <View style={{ padding: theme.spacing.xxl, flex: 1 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          testID="vital-detail-back"
          style={({ pressed }) => ({
            paddingVertical: theme.spacing.s,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.brand.coral,
              fontFamily: bodyStyle.family,
              fontSize: bodyStyle.size,
            }}
          >
            ← Back
          </Text>
        </Pressable>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.editorial,
            fontSize: headlineStyle.size,
            lineHeight: headlineStyle.lineHeight,
            color: theme.colors.text.primary,
            marginTop: theme.spacing.l,
            marginBottom: theme.spacing.m,
          }}
          testID="vital-detail-headline"
        >
          {vitalLabel}
        </Text>
        <Text
          style={{
            fontFamily: bodyStyle.family,
            fontSize: bodyStyle.size,
            lineHeight: bodyStyle.lineHeight,
            color: theme.colors.text.secondary,
            marginBottom: theme.spacing.l,
          }}
        >
          The full {vitalLabel.toLowerCase()} view is on its way. Check back
          shortly.
        </Text>
        <Text
          style={{
            fontFamily: labelStyle.family,
            fontSize: labelStyle.size,
            color: theme.colors.text.tertiary,
          }}
        >
          Sprint 8.5
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
