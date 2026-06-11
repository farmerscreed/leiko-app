// Battery-optimization opt-in — asks the wearer to let Leiko keep running in
// the background so the silent remote-refresh push can wake the phone (Android
// throttles data messages to battery-optimized apps). Mounted from the
// wearer's home; self-hides via useBatteryOptimizationPrompt (no paired watch,
// already exempt, or dismissed → renders nothing).
//
// Voice rules (docs/05-voice-and-claims.md): calm, plain, agency-affirming.
// No "patient", "diagnose", "predict", "prevent", "dangerous", "critical".
// No fear, no promised health outcome. "Not now" is the dismiss CTA.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { useTheme } from '../theme';
import { useBatteryOptimizationPrompt } from '../hooks/useBatteryOptimizationPrompt';

interface BatteryOptimizationPromptProps {
  /** Override visibility for tests / Storybook. Production: from the hook. */
  visibleOverride?: boolean;
  /** Called after either CTA fires + the sheet is dismissed. */
  onClose?: () => void;
}

export function BatteryOptimizationPrompt({
  visibleOverride,
  onClose,
}: BatteryOptimizationPromptProps) {
  const theme = useTheme();
  const { show, request, dismiss } = useBatteryOptimizationPrompt();
  const [busy, setBusy] = useState(false);

  const visible = visibleOverride !== undefined ? visibleOverride : show;

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    await request();
    // Don't nag again: if granted, the next foreground re-check hides it
    // anyway; if declined, the user can re-enable in Settings later.
    dismiss();
    setBusy(false);
    onClose?.();
  };

  const handleDismiss = () => {
    if (busy) return;
    dismiss();
    onClose?.();
  };

  const body = theme.type('bodyL');
  const caption = theme.type('caption');

  return (
    <BottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      size="compact"
      title="Keep readings arriving when Leiko is closed"
      testID="battery-opt-prompt"
    >
      <View style={[styles.body, { gap: theme.spacing.l, paddingTop: theme.spacing.s }]}>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: body.size,
            lineHeight: body.lineHeight,
            fontFamily: body.family,
          }}
        >
          Android can pause Leiko in the background, which may delay your latest
          readings from syncing. Allowing Leiko to keep running lets them arrive
          on time.
        </Text>

        <View style={[styles.actions, { gap: theme.spacing.m }]}>
          <Button
            variant="primary"
            onPress={handleAllow}
            loading={busy}
            accessibilityLabel="Allow background activity"
            testID="battery-opt-allow"
          >
            Allow background activity
          </Button>
          <Button
            variant="ghost"
            onPress={handleDismiss}
            disabled={busy}
            accessibilityLabel="Not now"
            testID="battery-opt-dismiss"
          >
            Not now
          </Button>
        </View>

        <Text
          style={{
            color: theme.colors.text.tertiary ?? theme.colors.text.secondary,
            fontSize: caption.size,
            lineHeight: caption.lineHeight,
            fontFamily: caption.family,
            textAlign: 'center',
          }}
        >
          You can change this in your phone's settings anytime.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  actions: {},
});
