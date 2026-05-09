// Auth-state gate. Three branches:
//
//   loading         → null (the splash UI takes over until hydrate resolves;
//                     for Sprint 2 we render a quiet placeholder so the
//                     navigator container doesn't blink an empty stack)
//   unauthenticated → AuthStack (fork → signup/signin → OTP)
//   authenticated   → CaregiverStack or SelfBuyerStack, selected by
//                     profile.account_type. Caregivers without a completed
//                     onboarding render the CaregiverOnboardingStack first
//                     (Sprint 3).
//
// `parent` (D8a §1.3 invitation flow) routes to a placeholder for now;
// Sprint 5 covers the parent-pairing handoff.

import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountTypeForkScreen } from '../screens/Onboarding/AccountTypeFork';
import { SignUpScreen } from '../screens/Auth/SignUp';
import { SignInScreen } from '../screens/Auth/SignIn';
import { OTPVerifyScreen } from '../screens/Auth/OTPVerify';
import { CaregiverIntro1Screen } from '../screens/Onboarding/Caregiver/Intro1';
import { CaregiverIntro2Screen } from '../screens/Onboarding/Caregiver/Intro2';
import { CaregiverIntro3Screen } from '../screens/Onboarding/Caregiver/Intro3';
import { CaregiverFamilyYouScreen } from '../screens/Onboarding/Caregiver/FamilyYou';
import { CaregiverFamilyParentScreen } from '../screens/Onboarding/Caregiver/FamilyParent';
import { CaregiverFamilyWatchScreen } from '../screens/Onboarding/Caregiver/FamilyWatch';
import { SelfBuyerIntro1Screen } from '../screens/Onboarding/SelfBuyer/Intro1';
import { SelfBuyerIntro2Screen } from '../screens/Onboarding/SelfBuyer/Intro2';
import { SelfBuyerIntro3Screen } from '../screens/Onboarding/SelfBuyer/Intro3';
import { SelfBuyerYouScreen } from '../screens/Onboarding/SelfBuyer/You';
import { SelfBuyerWatchScreen } from '../screens/Onboarding/SelfBuyer/Watch';
import { CaregiverHome } from '../screens/Home/CaregiverHome';
import { ParentReadingsList } from '../screens/Home/ParentReadingsList';
import { SelfBuyerHome } from '../screens/Home/SelfBuyerHome';
import { SelfBuyerHomePlaceholder } from '../screens/Placeholders/SelfBuyerHomePlaceholder';
import { VitalDetailRouter } from '../screens/VitalDetail/VitalDetailRouter';
import { PairingScreen } from '../screens/Pairing/PairingScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { TakeReadingScreen } from '../screens/TakeReading/TakeReadingScreen';
import { ReadingDetailScreen } from '../screens/ReadingDetail/ReadingDetailScreen';
import { Trends } from '../screens/Trends/Trends';
import { AuditLogScreen } from '../screens/AuditLog/AuditLogScreen';
import { CaregiverVisibilityScreen } from '../screens/CaregiverVisibility/CaregiverVisibilityScreen';
import { FamilyMembersScreen } from '../screens/FamilyMembers/FamilyMembersScreen';
import { LearnScreen } from '../screens/Learn/LearnScreen';
import { DebugLauncher } from '../dev/DebugLauncher';
import { useTheme } from '../theme';
import { useAuth } from '../state/auth';
import { useOnboarding } from '../state/onboarding';
import { usePairing } from '../state/pairing';
import { useReadings } from '../state/readings';
import { useSyncOrchestrator } from '../state/syncOrchestrator';
import {
  startHealthPlatformBackgroundFetch,
  stopHealthPlatformBackgroundFetch,
} from '../services/health-platform/backgroundFetch';
import { configurePurchases } from '../services/purchases';
import {
  defineBackgroundSyncTask,
  startBackgroundSync,
  stopBackgroundSync,
} from '../services/sync/backgroundSync';
import { inferModel, setDeviceMetaProvider } from '../services/sync/postReading';

// Define the OS-scheduled background-sync task once at module load.
// TaskManager rejects redefinition, and module load is the only
// guaranteed pre-render hook. The runner reads the orchestrator's
// runSync at fire time — not at definition time — so the latest
// orchestrator instance handles the wake-up.
defineBackgroundSyncTask(async () => {
  try {
    const result = await useSyncOrchestrator.getState().runSync('background');
    return result === 'ran' ? 'ran' : 'skipped';
  } catch {
    return 'errored';
  }
});

// Wire postReading's device-meta provider once at app boot. The
// pairing store can't be imported by postReading directly without
// pulling react-native into pure-project test loads — so the lookup
// gets injected here, where the navigator already imports the
// pairing store. Per-call resolution always returns the latest paired
// device.
setDeviceMetaProvider(() => {
  const paired = usePairing.getState().pairedDevice;
  if (!paired) return null;
  return {
    bleId: paired.bleId,
    macSuffix: paired.macSuffix,
    name: paired.name,
    model: inferModel(paired.name),
  };
});
import type {
  AuthStackParamList,
  CaregiverOnboardingStackParamList,
  CaregiverStackParamList,
  SelfBuyerOnboardingStackParamList,
  SelfBuyerStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CaregiverStack = createNativeStackNavigator<CaregiverStackParamList>();
const CaregiverOnboardingStack =
  createNativeStackNavigator<CaregiverOnboardingStackParamList>();
const SelfBuyerStack = createNativeStackNavigator<SelfBuyerStackParamList>();
const SelfBuyerOnboardingStack =
  createNativeStackNavigator<SelfBuyerOnboardingStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="AccountTypeFork"
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="AccountTypeFork" component={AccountTypeForkScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    </AuthStack.Navigator>
  );
}

function CaregiverOnboardingNavigator() {
  return (
    <CaregiverOnboardingStack.Navigator
      initialRouteName="Intro1"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <CaregiverOnboardingStack.Screen name="Intro1" component={CaregiverIntro1Screen} />
      <CaregiverOnboardingStack.Screen name="Intro2" component={CaregiverIntro2Screen} />
      <CaregiverOnboardingStack.Screen name="Intro3" component={CaregiverIntro3Screen} />
      <CaregiverOnboardingStack.Screen name="FamilyYou" component={CaregiverFamilyYouScreen} />
      <CaregiverOnboardingStack.Screen
        name="FamilyParent"
        component={CaregiverFamilyParentScreen}
      />
      <CaregiverOnboardingStack.Screen
        name="FamilyWatch"
        component={CaregiverFamilyWatchScreen}
      />
    </CaregiverOnboardingStack.Navigator>
  );
}

function CaregiverHomeNavigator() {
  return (
    <CaregiverStack.Navigator screenOptions={{ headerShown: false }}>
      <CaregiverStack.Screen name="CaregiverHome" component={CaregiverHome} />
      <CaregiverStack.Screen name="ParentReadings" component={ParentReadingsList} />
      <CaregiverStack.Screen name="Pairing" component={PairingScreen} />
      <CaregiverStack.Screen name="Settings" component={SettingsScreen} />
      <CaregiverStack.Screen name="TakeReading" component={TakeReadingScreen} />
      <CaregiverStack.Screen name="ReadingDetail" component={ReadingDetailScreen} />
      <CaregiverStack.Screen name="Trends" component={Trends} />
      <CaregiverStack.Screen name="AuditLog" component={AuditLogScreen} />
      <CaregiverStack.Screen
        name="CaregiverVisibility"
        component={CaregiverVisibilityScreen}
      />
      <CaregiverStack.Screen
        name="FamilyMembers"
        component={FamilyMembersScreen}
      />
      <CaregiverStack.Screen name="Learn" component={LearnScreen} />
    </CaregiverStack.Navigator>
  );
}

function CaregiverNavigator() {
  const onboardingComplete = useOnboarding((s) => s.caregiverOnboardingComplete);
  return onboardingComplete ? <CaregiverHomeNavigator /> : <CaregiverOnboardingNavigator />;
}

function SelfBuyerOnboardingNavigator() {
  return (
    <SelfBuyerOnboardingStack.Navigator
      initialRouteName="Intro1"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <SelfBuyerOnboardingStack.Screen name="Intro1" component={SelfBuyerIntro1Screen} />
      <SelfBuyerOnboardingStack.Screen name="Intro2" component={SelfBuyerIntro2Screen} />
      <SelfBuyerOnboardingStack.Screen name="Intro3" component={SelfBuyerIntro3Screen} />
      <SelfBuyerOnboardingStack.Screen name="You" component={SelfBuyerYouScreen} />
      <SelfBuyerOnboardingStack.Screen name="Watch" component={SelfBuyerWatchScreen} />
    </SelfBuyerOnboardingStack.Navigator>
  );
}

function SelfBuyerHomeNavigator() {
  // Sprint 8 — Self-Buyer Daily Pulse home replaces the placeholder as the
  // initial route. The placeholder route is kept registered so any in-flight
  // dev tooling that deep-links to it still resolves; it is no longer
  // surfaced to the user.
  return (
    <SelfBuyerStack.Navigator
      initialRouteName="SelfBuyerHome"
      screenOptions={{ headerShown: false }}
    >
      <SelfBuyerStack.Screen name="SelfBuyerHome" component={SelfBuyerHome} />
      <SelfBuyerStack.Screen
        name="SelfBuyerHomePlaceholder"
        component={SelfBuyerHomePlaceholder}
      />
      <SelfBuyerStack.Screen name="Pairing" component={PairingScreen} />
      <SelfBuyerStack.Screen name="Settings" component={SettingsScreen} />
      <SelfBuyerStack.Screen name="TakeReading" component={TakeReadingScreen} />
      <SelfBuyerStack.Screen name="ReadingDetail" component={ReadingDetailScreen} />
      <SelfBuyerStack.Screen name="VitalDetail" component={VitalDetailRouter} />
      <SelfBuyerStack.Screen name="Trends" component={Trends} />
      <SelfBuyerStack.Screen name="AuditLog" component={AuditLogScreen} />
      <SelfBuyerStack.Screen
        name="CaregiverVisibility"
        component={CaregiverVisibilityScreen}
      />
      <SelfBuyerStack.Screen
        name="FamilyMembers"
        component={FamilyMembersScreen}
      />
      <SelfBuyerStack.Screen name="Learn" component={LearnScreen} />
    </SelfBuyerStack.Navigator>
  );
}

function SelfBuyerNavigator() {
  const onboardingComplete = useOnboarding((s) => s.selfBuyerOnboardingComplete);
  return onboardingComplete ? <SelfBuyerHomeNavigator /> : <SelfBuyerOnboardingNavigator />;
}

function HydratingFallback() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.surface.base }]}>
      <ActivityIndicator color={theme.colors.brand.primary} />
    </View>
  );
}

export function RootNavigator() {
  const status = useAuth((s) => s.status);
  const accountType = useAuth((s) => s.profile?.account_type);
  const hydrate = useAuth((s) => s.hydrate);
  const hydratePairing = usePairing((s) => s.hydrate);
  const hydrateReadings = useReadings((s) => s.hydrate);
  const syncPending = useReadings((s) => s.syncPending);
  const startOrchestrator = useSyncOrchestrator((s) => s.start);
  const stopOrchestrator = useSyncOrchestrator((s) => s.stop);

  // Single QueryClient instance for the app's lifetime. MMKV remains
  // the offline source of truth (per docs/01-data-model.md "Sync
  // strategy"); Query holds the in-memory server-state cache only —
  // no disk persistence configured.
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  useEffect(() => {
    void hydrate();
    hydratePairing();
    hydrateReadings();
    // Best-effort: try to sync any pending readings on app cold start
    // (offline captures from a previous session).
    void syncPending();
    // Sprint 7: register the sync orchestrator's AppState + BT
    // listeners and fire the cold-start sync. Idempotent.
    startOrchestrator();
    // Sprint 9.5 / Task 7: register the health-platform read trigger.
    // Fires on every app foreground; internally debounced to 24h.
    // Caregiver / master-off / no-toggles short-circuit silently.
    startHealthPlatformBackgroundFetch();
    // Sprint 10a: configure RevenueCat once per app session. No-ops
    // when EXPO_PUBLIC_RC_API_KEY_* env vars aren't set; the auth
    // store calls identifyPurchaser separately on session change.
    void configurePurchases();
    // Sprint 10c.2 polish — register the OS-scheduled watch sync.
    // No-ops when expo-background-fetch / expo-task-manager aren't
    // present (dev workspace without the native side). The dev-client
    // APK rebuild pulls them in.
    void startBackgroundSync();
    return () => {
      stopOrchestrator();
      stopHealthPlatformBackgroundFetch();
      void stopBackgroundSync();
    };
  }, [
    hydrate,
    hydratePairing,
    hydrateReadings,
    syncPending,
    startOrchestrator,
    stopOrchestrator,
  ]);

  let content: React.ReactNode;
  if (status === 'loading') {
    content = <HydratingFallback />;
  } else if (status === 'unauthenticated') {
    content = <AuthNavigator />;
  } else if (accountType === 'self_buyer') {
    content = <SelfBuyerNavigator />;
  } else {
    // caregiver and parent both render the caregiver placeholder for
    // Sprint 2; Sprint 5 splits parent off.
    content = <CaregiverNavigator />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>{content}</NavigationContainer>
      {/* Sprint 10c.2 polish — DEV-only floating sync-debug launcher.
          Production builds strip __DEV__; the component returns null. */}
      <DebugLauncher />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
