// Caregiver Intro 1 — docs/04-screens/caregiver-onboarding.md §4.2.1.
// First of three intros that set the emotional register. No skip on this
// screen (skip is only available from Intro 2 onward per the spec).
// Sprint 16.6: presentation handled by OnboardingHero (D11 premium pattern).

import { HandHeartIcon } from 'phosphor-react-native';
import { OnboardingHero } from '../../../components/OnboardingHero';
import type { CaregiverOnboardingScreenProps } from '../../../navigation/types';

export function CaregiverIntro1Screen({
  navigation,
}: CaregiverOnboardingScreenProps<'Intro1'>) {
  return (
    <OnboardingHero
      icon={HandHeartIcon}
      iconAccessibilityLabel="Two hands, gently holding"
      headline="Stay close to the people who shaped you."
      body="Leiko is a calm way to keep an eye on a parent's health, even from far away."
      pageCurrent={1}
      pageTotal={3}
      pagerTestID="caregiver-intro-pager"
      primary={{
        label: 'Continue',
        onPress: () => navigation.navigate('Intro2'),
        testID: 'caregiver-intro1-continue',
      }}
    />
  );
}
