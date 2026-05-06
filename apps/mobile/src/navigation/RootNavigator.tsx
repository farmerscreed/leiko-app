// Auth-state gate. Three branches:
//
//   loading         → null (the splash UI takes over until hydrate resolves;
//                     for Sprint 2 we render a quiet placeholder so the
//                     navigator container doesn't blink an empty stack)
//   unauthenticated → AuthStack (fork → signup/signin → OTP)
//   authenticated   → CaregiverStack or SelfBuyerStack, selected by
//                     profile.account_type
//
// `parent` (D8a §1.3 invitation flow) routes to a placeholder for now;
// Sprint 5 covers the parent-pairing handoff.

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountTypeForkScreen } from '../screens/Onboarding/AccountTypeFork';
import { SignUpScreen } from '../screens/Auth/SignUp';
import { SignInScreen } from '../screens/Auth/SignIn';
import { OTPVerifyScreen } from '../screens/Auth/OTPVerify';
import { CaregiverHomePlaceholder } from '../screens/Placeholders/CaregiverHomePlaceholder';
import { SelfBuyerHomePlaceholder } from '../screens/Placeholders/SelfBuyerHomePlaceholder';
import { useTheme } from '../theme';
import { useAuth } from '../state/auth';
import type {
  AuthStackParamList,
  CaregiverStackParamList,
  SelfBuyerStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CaregiverStack = createNativeStackNavigator<CaregiverStackParamList>();
const SelfBuyerStack = createNativeStackNavigator<SelfBuyerStackParamList>();

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

function CaregiverNavigator() {
  return (
    <CaregiverStack.Navigator screenOptions={{ headerShown: false }}>
      <CaregiverStack.Screen
        name="CaregiverHomePlaceholder"
        component={CaregiverHomePlaceholder}
      />
    </CaregiverStack.Navigator>
  );
}

function SelfBuyerNavigator() {
  return (
    <SelfBuyerStack.Navigator screenOptions={{ headerShown: false }}>
      <SelfBuyerStack.Screen
        name="SelfBuyerHomePlaceholder"
        component={SelfBuyerHomePlaceholder}
      />
    </SelfBuyerStack.Navigator>
  );
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

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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

  return <NavigationContainer>{content}</NavigationContainer>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
