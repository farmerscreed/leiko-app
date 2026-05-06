// App entry. Three runtime modes:
//
//   1. DEV gallery (set EXPO_PUBLIC_DEV_GALLERY=true in .env.local) —
//      renders Sprint 1's ComponentGallery for visual iteration.
//   2. DEV real flow (default in __DEV__) — same code path as production,
//      so the auth + fork + onboarding flow can be exercised against
//      local Supabase Docker.
//   3. Production — same as #2.
//
// Wrapping order matters:
//   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → RootNavigator
// Gesture handler must be the outermost; SafeAreaProvider must be above
// any consumer of useSafeAreaInsets / SafeAreaView (every screen).

import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ComponentGallery } from './src/dev/ComponentGallery';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, type ThemeMode } from './src/theme';

const DEV_GALLERY_ENABLED = process.env.EXPO_PUBLIC_DEV_GALLERY === 'true';

export default function App() {
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
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
