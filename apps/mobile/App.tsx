import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ComponentGallery } from './src/dev/ComponentGallery';
import { ThemeProvider, type ThemeMode } from './src/theme';

export default function App() {
  if (__DEV__) {
    return <DevApp />;
  }
  return <ProductionRoot />;
}

function DevApp() {
  const [mode, setMode] = useState<ThemeMode>('caregiver');
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider mode={mode}>
        <ComponentGallery mode={mode} onModeChange={setMode} />
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function ProductionRoot() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.placeholder}>
        <Text>Leiko — caregiver mode coming soon.</Text>
        <StatusBar style="auto" />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
