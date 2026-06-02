// Sprint 18 / SEC-1 — everything that transitively imports
// services/storage lives below here. App.tsx dynamic-imports this
// module AFTER secureBoot resolves (and after the legacy → encrypted
// MMKV migration runs if needed). That ordering guarantees storage.ts
// evaluates with the cached key in hand.
//
// What moved here from App.tsx: the GestureHandlerRootView →
// SafeAreaProvider → ThemeProvider → RootNavigator wrap, and the
// DEV-only ComponentGallery branch. App.tsx now only handles the
// boot orchestration + the unbranded splash.

import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ComponentGallery } from '../dev/ComponentGallery';
import { DebugLauncher } from '../dev/DebugLauncher';
import { RootNavigator } from '../navigation/RootNavigator';
import { ThemeProvider, type ThemeMode } from '../theme';

const DEV_GALLERY_ENABLED = process.env.EXPO_PUBLIC_DEV_GALLERY === 'true';

export default function PostBootShell() {
  if (__DEV__ && DEV_GALLERY_ENABLED) {
    return <DevGallery />;
  }
  return <Root />;
}

function DevGallery() {
  const [mode, setMode] = useState<ThemeMode>('caregiver');
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider mode={mode}>
          <ComponentGallery mode={mode} onModeChange={setMode} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider mode="caregiver">
          <RootNavigator />
          <DebugLauncher />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
