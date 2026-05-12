// QuietHoursAffirmSheet — Sprint 15.
//
// One-shot prompt: "May we still reach you immediately if a reading
// suggests an urgent check-in?" The user picks "Hold for morning"
// (default, calm-before-clever) or "Reach me anyway" (override).
//
// The answer writes notification_preferences.anomaly_bypass_quiet
// and marks the MMKV one-shot guard so we never re-prompt
// automatically. Settings is the second-chance path.
//
// Voice rules (docs/05-voice-and-claims.md, D11 §3): every string
// here is plain, calm, no fear language. Voice-lint runs over them
// in the test suite.

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { useNotifications } from '../state/notifications';
import { useAuth } from '../state/auth';
import { useTheme } from '../theme';
import { mmkv, STORAGE_KEYS } from '../services/storage';

export interface QuietHoursAffirmSheetProps {
  visible: boolean;
  onDone: () => void;
}

export function QuietHoursAffirmSheet({ visible, onDone }: QuietHoursAffirmSheetProps) {
  const theme = useTheme();
  const setOne = useNotifications((s) => s.set);
  const flush = useNotifications((s) => s.flushToSupabase);
  const userId = useAuth((s) => s.profile?.id ?? null);

  const handleChoose = useCallback(
    async (bypass: boolean) => {
      setOne('anomalyBypassQuiet', bypass);
      mmkv.set(STORAGE_KEYS.anomalyBypassAffirmAnswered, 'true');
      if (userId) {
        await flush(userId);
      }
      onDone();
    },
    [setOne, flush, userId, onDone],
  );

  const titleStyle = theme.type('title');
  const bodyStyle = theme.type('bodyM');

  return (
    <BottomSheet visible={visible} onDismiss={onDone} size="compact" surface="solid">
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontFamily: titleStyle.family,
            fontSize: titleStyle.size,
            lineHeight: titleStyle.lineHeight,
            fontWeight: titleStyle.weight as '600',
            marginBottom: theme.spacing.l,
          }}
        >
          A quick choice about quiet hours
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontFamily: bodyStyle.family,
            fontSize: bodyStyle.size,
            lineHeight: bodyStyle.lineHeight,
            marginBottom: theme.spacing.xl,
          }}
        >
          During your quiet hours (default 10pm to 7am) we hold most notices until morning. May we still reach you immediately if a reading suggests an urgent check-in?
        </Text>
        <View style={{ gap: theme.spacing.m }}>
          <Button
            variant="primary"
            onPress={() => handleChoose(true)}
            accessibilityLabel="Reach me anyway"
            testID="quiet-hours-affirm-bypass"
          >
            Reach me anyway
          </Button>
          <Button
            variant="ghost"
            onPress={() => handleChoose(false)}
            accessibilityLabel="Hold for morning"
            testID="quiet-hours-affirm-hold"
          >
            Hold for morning
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
