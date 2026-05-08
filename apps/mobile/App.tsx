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
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { ComponentGallery } from './src/dev/ComponentGallery';
import { DebugLauncher } from './src/dev/DebugLauncher';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, type ThemeMode } from './src/theme';

const DEV_GALLERY_ENABLED = process.env.EXPO_PUBLIC_DEV_GALLERY === 'true';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_600SemiBold_Italic,
    Inter_700Bold,
    Inter_900Black,
    JetBrainsMono_500Medium,
    // Editorial serif (Sprint 7.7 caregiver mode). Used for the
    // greeting headline + person-card editorial sentence.
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  // While fonts are loading, return null so the Expo splash stays visible.
  // On a font-load error, fall through and render with the system fallback
  // rather than bricking the app on a transient asset failure.
  if (!fontsLoaded && !fontError) return null;

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
