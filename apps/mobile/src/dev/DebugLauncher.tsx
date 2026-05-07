// Dev-only floating debug launcher — Sprint 7.5.
//
// Renders a small floating button on top of the real-flow Root in
// __DEV__ builds only. Tapping opens a fullscreen modal containing
// the VitalsDebugPanel. Production builds strip __DEV__ and this
// component is never rendered.
//
// Why this and not the EXPO_PUBLIC_DEV_GALLERY flag: the gallery flag
// branches App.tsx away from RootNavigator, so the real auth + pair +
// take-reading flow isn't available inside it. To verify Sprint 7.5
// plumbing end-to-end (pair → watch records → sync → vitals_other +
// slice state) we need the debug panel reachable WHILE the real flow
// is mounted. This component is the smallest surface that satisfies
// that without making the panel a real navigator screen.
//
// Per CLAUDE.md "no production UI surface in this sprint": this entire
// file is gated by `if (!__DEV__) return null;` at the top. The button
// is invisible in TestFlight / Play Store builds.

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { VitalsDebugPanel } from './VitalsDebugPanel';
import { useReadings } from '../state/readings';
import { useHR } from '../state/hr';
import { useSpO2 } from '../state/spo2';
import { useSleep } from '../state/sleep';
import { useActivity } from '../state/activity';

export function DebugLauncher() {
  if (!__DEV__) return null;
  return <DebugLauncherInner />;
}

function DebugLauncherInner() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const onOpen = () => {
    // Hydrate every slice from MMKV on open so the panel reflects
    // anything captured in prior sessions, not just live in-memory
    // state. Cheap; idempotent.
    useReadings.getState().hydrate();
    useHR.getState().hydrate();
    useSpO2.getState().hydrate();
    useSleep.getState().hydrate();
    useActivity.getState().hydrate();
    setOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open vitals debug panel"
        onPress={onOpen}
        style={[
          styles.fab,
          { backgroundColor: theme.colors.brand.primary },
        ]}
      >
        <Text style={[styles.fabLabel, { color: theme.colors.text.onBrand }]}>
          DEV
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView
          edges={['top']}
          style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
        >
          <View style={styles.modalHeader}>
            <Text
              style={{
                fontSize: theme.type('headline').size,
                lineHeight: theme.type('headline').lineHeight,
                fontWeight: '600',
                color: theme.colors.text.primary,
              }}
            >
              Vitals debug
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close debug panel"
              onPress={() => setOpen(false)}
              hitSlop={12}
            >
              <Text
                style={{
                  fontSize: theme.type('bodyL').size,
                  color: theme.colors.brand.primary,
                  fontWeight: '600',
                }}
              >
                Close
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.xxl }}>
            <VitalsDebugPanel />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 9999,
  },
  fabLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
