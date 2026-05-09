// Apple Health / Health Connect opt-in — Sprint 9.5 / Task 8.
//
// One-shot bottom sheet shown on first home render for self-buyer +
// parent (own phone) personas. Caregiver never sees it (mounted only
// from SelfBuyerHome / ParentReadingsList — CaregiverHome doesn't
// import this component). Per D13 §12.5.
//
// Voice rules (docs/05-voice-and-claims.md): every string here is calm,
// plain, agency-affirming. No "patient", "diagnose", "predict",
// "dangerous", "critical", "silent killer". No promised outcomes.
// "Maybe later" is the dismiss CTA; the user can opt in via Settings
// later (Sprint 10).
//
// On Connect: requestPermissions across all kinds; if the OS prompt
// was shown, flip the master toggle on and enable each per-vital
// toggle for the permissions HK/HC actually granted (HK reports
// optimistic write/read on iOS per Apple's privacy model — see
// types.ts). Mark prompted regardless of outcome so we never re-show.

import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { useTheme } from '../theme';
import {
  ALL_READ_KINDS,
  ALL_WRITE_KINDS,
  requestPermissions,
} from '../services/health-platform';
import {
  setMaster,
  setReadVital,
  setWriteVital,
} from '../services/health-platform/toggles';
import {
  markPrompted,
  useHealthPlatformPermissionPrompt,
} from '../services/health-platform/permissionPrompt';
import { useAuth } from '../state/auth';
import { logger } from '../services/analytics/logger';

function platformName(): string {
  if (Platform.OS === 'ios') return 'Apple Health';
  if (Platform.OS === 'android') return 'Health Connect';
  return "your phone's health app";
}

interface HealthPlatformPermissionPromptProps {
  /** Override visibility for tests / Storybook. Production: derived
   *  from useHealthPlatformPermissionPrompt + the caller-mount gate. */
  visibleOverride?: boolean;
  /** Called after either CTA fires + the bottom sheet is dismissed. */
  onClose?: () => void;
}

export function HealthPlatformPermissionPrompt({
  visibleOverride,
  onClose,
}: HealthPlatformPermissionPromptProps) {
  const theme = useTheme();
  const accountType = useAuth((s) => s.profile?.account_type);
  const prompted = useHealthPlatformPermissionPrompt((s) => s.prompted);
  const [busy, setBusy] = useState(false);

  // Hard gate — caregivers never see this prompt (D13 §12.6 + §12.5).
  // Defence-in-depth alongside the mount-site gate (CaregiverHome
  // doesn't render this component at all).
  if (accountType === 'caregiver') return null;

  const visible =
    visibleOverride !== undefined ? visibleOverride : !prompted && accountType !== undefined;

  const handleConnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const grant = await requestPermissions({
        write: ALL_WRITE_KINDS,
        read: ALL_READ_KINDS,
      });
      if (grant.userPrompted) {
        // Master on; per-vital reflects what was actually granted.
        setMaster(true);
        for (const k of ALL_WRITE_KINDS) {
          setWriteVital(k, grant.write[k] === true);
        }
        for (const k of ALL_READ_KINDS) {
          setReadVital(k, grant.read[k] === true);
        }
        logger.track('health_platform_permission_granted', {
          platform: Platform.OS,
        });
      } else {
        // OS didn't prompt (HK/HC unavailable, simulator, etc). Still
        // mark prompted so we don't loop on every render.
        logger.track('health_platform_permission_skipped', {
          platform: Platform.OS,
          reason: 'os_unavailable',
        });
      }
    } catch {
      // Errors are non-fatal — mark prompted and move on. Settings
      // gives the user a second chance.
      logger.track('health_platform_permission_skipped', {
        platform: Platform.OS,
        reason: 'request_failed',
      });
    }
    markPrompted();
    setBusy(false);
    onClose?.();
  };

  const handleDismiss = () => {
    if (busy) return;
    logger.track('health_platform_permission_dismissed', {
      platform: Platform.OS,
    });
    markPrompted();
    onClose?.();
  };

  const body = theme.type('bodyL');
  const caption = theme.type('caption');

  return (
    <BottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      size="compact"
      title="Keep your numbers in one place"
      testID="health-platform-permission-prompt"
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
          {`Connect Leiko to ${platformName()}, and your readings will appear there too — alongside any other vitals you already track.`}
        </Text>

        <View style={[styles.actions, { gap: theme.spacing.m }]}>
          <Button
            variant="primary"
            onPress={handleConnect}
            loading={busy}
            accessibilityLabel={`Connect Leiko to ${platformName()}`}
            testID="health-platform-permission-connect"
          >
            Connect
          </Button>
          <Button
            variant="ghost"
            onPress={handleDismiss}
            disabled={busy}
            accessibilityLabel="Maybe later"
            testID="health-platform-permission-dismiss"
          >
            Maybe later
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
          You can change your mind in Settings.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  actions: {},
});
