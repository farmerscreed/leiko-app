// AnomalyBannerCopy voice-rule tests — Sprint 15.
//
// Run every (vital × tier × recipient) combination through the
// in-app voice linter. If any rendered banner string fails the lint,
// this test fails — hard gate.

import { bannerCopyFor, type BannerRecipient } from '../anomalyBannerCopy';
import { lintVoiceText } from '../../services/voice/voiceLint';
import type { AnomalyEvent } from '../../state/anomalies';

const RECIPIENTS: BannerRecipient[] = ['caregiver', 'self_buyer', 'parent'];
const VITALS = ['bp', 'hr', 'spo2'] as const;
const TIERS = ['calm_concerned', 'confirmed_urgent'] as const;

function makeEvent(
  vital: typeof VITALS[number],
  tier: typeof TIERS[number],
  reason: string = 'outlier_and_soft_threshold',
): AnomalyEvent {
  return {
    id: 'x',
    userId: 'u1',
    familyId: 'f1',
    vital,
    tier,
    reason,
    readingId: null,
    triggeredAtSec: 1,
    acknowledgedAt: null,
    feedbackThumb: 0,
  };
}

describe('bannerCopyFor — voice rules', () => {
  for (const vital of VITALS) {
    for (const tier of TIERS) {
      for (const recipient of RECIPIENTS) {
        it(`${vital}/${tier}/${recipient} passes voice-lint`, () => {
          const copy = bannerCopyFor(makeEvent(vital, tier), recipient, 'Mum');
          const t = lintVoiceText(copy.title, { stripMdxComponents: false });
          const b = lintVoiceText(copy.body, { stripMdxComponents: false });
          if (!t.passes) {
            throw new Error(
              `title failed: ${t.hardHits.map((h) => h.match).join(',')}`,
            );
          }
          if (!b.passes) {
            throw new Error(
              `body failed: ${b.hardHits.map((h) => h.match).join(',')}`,
            );
          }
        });
      }
    }
  }
});

describe('bannerCopyFor — severity routing', () => {
  it('confirmed_urgent → severity confirmed-urgent', () => {
    expect(bannerCopyFor(makeEvent('bp', 'confirmed_urgent', 'crisis_absolute'), 'caregiver').severity).toBe(
      'confirmed-urgent',
    );
  });

  it('calm_concerned → severity calm-concerned', () => {
    expect(bannerCopyFor(makeEvent('hr', 'calm_concerned'), 'self_buyer').severity).toBe(
      'calm-concerned',
    );
  });

  it('BP crisis_absolute uses crisis copy variant', () => {
    expect(
      bannerCopyFor(
        makeEvent('bp', 'confirmed_urgent', 'crisis_absolute'),
        'caregiver',
        'Mum',
      ).body,
    ).toMatch(/just now was very high/);
  });

  it('BP stage2_sustained_60min uses sustained copy variant', () => {
    expect(
      bannerCopyFor(
        makeEvent('bp', 'confirmed_urgent', 'stage2_sustained_60min'),
        'caregiver',
        'Mum',
      ).body,
    ).toMatch(/Three high readings/);
  });
});
