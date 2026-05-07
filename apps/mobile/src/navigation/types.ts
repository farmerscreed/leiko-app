// Route type registry for typed navigation. The full nested shape lives
// here; screens import their specific NativeStackScreenProps from the
// per-stack types below.

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  AccountTypeFork: undefined;
  SignUp: undefined;
  SignIn: undefined;
  OTPVerify: { email: string; mode: 'signup' | 'signin' };
};

// Sprint 3 — caregiver onboarding stack. Six screens per
// docs/04-screens/caregiver-onboarding.md (3 intros + 3 family-setup).
// Skip from Intro2/Intro3 routes to FamilyYou. Skip is NOT available
// during family-setup screens (4–6) per the spec.
export type CaregiverOnboardingStackParamList = {
  Intro1: undefined;
  Intro2: undefined;
  Intro3: undefined;
  FamilyYou: undefined;
  FamilyParent: undefined;
  FamilyWatch: undefined;
};

// Sprint 5 — added Pairing and Settings to the caregiver home stack.
// Pairing renders its own internal sub-view based on usePairing.phase
// (PowerOn / Searching / Found / Pairing / Success / Failure +
// PermissionPrime / BluetoothOff / PermissionDenied) so we don't push a
// new native stack screen for every state transition. Settings hosts
// the paired-devices list and the forget-watch flow.
export type CaregiverStackParamList = {
  // Sprint 7 — replaces the Sprint 2 placeholder. Family Circle list
  // of parents per docs/04-screens/caregiver-home.md.
  CaregiverHome: undefined;
  // Sprint 7 — tap-on-card target. Placeholder for now; full reading
  // list view ships in Sprint 9.
  ParentReadings: { familyId: string };
  Pairing: undefined;
  Settings: undefined;
  // Sprint 6 — Take Reading + Reading Detail. ReadingDetail receives
  // the local id of the reading to display (UUIDv4 minted client-side
  // by the readings store; serverId is filled in once /sync acks).
  TakeReading: undefined;
  ReadingDetail: { readingLocalId: string };
};

// Sprint 4 — self-buyer onboarding stack. Five screens per
// docs/04-screens/self-buyer-onboarding.md (3 intros + You + Watch).
// Skip available from Intro2 onward (mirrors caregiver pattern).
export type SelfBuyerOnboardingStackParamList = {
  Intro1: undefined;
  Intro2: undefined;
  Intro3: undefined;
  You: undefined;
  Watch: undefined;
};

export type SelfBuyerStackParamList = {
  SelfBuyerHomePlaceholder: undefined;
  Pairing: undefined;
  Settings: undefined;
  TakeReading: undefined;
  ReadingDetail: { readingLocalId: string };
};

export type AuthScreenProps<R extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  R
>;

export type CaregiverScreenProps<R extends keyof CaregiverStackParamList> = NativeStackScreenProps<
  CaregiverStackParamList,
  R
>;

export type CaregiverOnboardingScreenProps<
  R extends keyof CaregiverOnboardingStackParamList,
> = NativeStackScreenProps<CaregiverOnboardingStackParamList, R>;

export type SelfBuyerScreenProps<R extends keyof SelfBuyerStackParamList> = NativeStackScreenProps<
  SelfBuyerStackParamList,
  R
>;

export type SelfBuyerOnboardingScreenProps<
  R extends keyof SelfBuyerOnboardingStackParamList,
> = NativeStackScreenProps<SelfBuyerOnboardingStackParamList, R>;
