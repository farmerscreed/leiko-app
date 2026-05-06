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

export type CaregiverStackParamList = {
  CaregiverHomePlaceholder: undefined;
};

export type SelfBuyerStackParamList = {
  SelfBuyerHomePlaceholder: undefined;
};

export type AuthScreenProps<R extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  R
>;

export type CaregiverScreenProps<R extends keyof CaregiverStackParamList> = NativeStackScreenProps<
  CaregiverStackParamList,
  R
>;

export type SelfBuyerScreenProps<R extends keyof SelfBuyerStackParamList> = NativeStackScreenProps<
  SelfBuyerStackParamList,
  R
>;
