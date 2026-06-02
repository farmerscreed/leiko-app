// Self-Buyer Intro 1 — docs/04-screens/self-buyer-onboarding.md §4.2.4
// (D8a §3.3). First of three intros that set the "understand your body"
// register, parallel to caregiver "stay close." No skip on the first
// intro per the spec.
// Sprint 16.6: presentation handled by OnboardingHero (D11 premium pattern).

import { PulseIcon } from 'phosphor-react-native';
import { OnboardingHero } from '../../../components/OnboardingHero';
import type { SelfBuyerOnboardingScreenProps } from '../../../navigation/types';

export function SelfBuyerIntro1Screen({
  navigation,
}: SelfBuyerOnboardingScreenProps<'Intro1'>) {
  return (
    <OnboardingHero
      icon={PulseIcon}
      iconAccessibilityLabel="A hand resting open, soft glow above the wrist"
      headline="Your readings, and the people you love."
      body="Leiko helps you understand your own numbers — and keep a gentle eye on the people you care for."
      pageCurrent={1}
      pageTotal={3}
      pagerTestID="self-buyer-intro-pager"
      primary={{
        label: 'Continue',
        onPress: () => navigation.navigate('Intro2'),
        testID: 'self-buyer-intro1-continue',
      }}
    />
  );
}
