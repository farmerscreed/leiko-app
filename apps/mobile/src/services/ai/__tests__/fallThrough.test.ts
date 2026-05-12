// fallThrough.test.ts — Sprint 16 cascade orchestrator.
//
// Targets: every step-down emits `ai_degraded_fall_through` with the
// upstream reason. The user-facing body never includes raw error
// strings. Structural Tier-B errors stay surfaced (the cascade
// doesn't swallow them).

import {
  DETERMINISTIC_COPY,
  isStructuralTierBError,
  mapAskLeikoTierBResult,
  runSingleStringCascade,
} from '../fallThrough';
import type { TierBResult } from '../tierB';
import { lintVoiceText } from '../../voice/voiceLint';

jest.mock('../../analytics/logger', () => {
  const track = jest.fn();
  return {
    logger: { track, drainQueue: jest.fn(), queueLength: jest.fn() },
    track,
  };
});
import { logger } from '../../analytics/logger';

beforeEach(() => {
  (logger.track as jest.Mock).mockClear();
});

describe('isStructuralTierBError', () => {
  it.each(['no_family', 'no_session', 'unauthorized', 'question_too_long', 'empty_question'])(
    'classifies %s as structural',
    (code) => {
      expect(isStructuralTierBError(code)).toBe(true);
    },
  );

  it.each(['network_error', 'client_timeout', 'invoke_failed', 'something_else'])(
    'classifies %s as soft',
    (code) => {
      expect(isStructuralTierBError(code)).toBe(false);
    },
  );
});

describe('mapAskLeikoTierBResult', () => {
  it('passes through ok responses', () => {
    const ok: TierBResult = {
      status: 'ok',
      body: 'hello',
      tier: 'B',
      model: '',
      conversationId: 'c',
      messageId: 'm',
      guard: { layer1Hits: 0, layer2MaxCosine: 0, retries: 0 },
    };
    const result = mapAskLeikoTierBResult(ok);
    expect(result).toEqual({ source: 'tier_b', status: 'ok', body: 'hello' });
    expect(logger.track).not.toHaveBeenCalled();
  });

  it('passes through defer with the trigger', () => {
    const result = mapAskLeikoTierBResult({
      status: 'defer',
      trigger: 'medication',
      reason: '',
    });
    expect(result).toEqual({
      source: 'tier_b',
      status: 'defer',
      trigger: 'medication',
    });
    expect(logger.track).not.toHaveBeenCalled();
  });

  it('passes through quota_exceeded', () => {
    const result = mapAskLeikoTierBResult({
      status: 'quota_exceeded',
      tier: 'B',
      remaining: 0,
      resetsAt: '2026-06-01',
    });
    expect(result).toEqual({ source: 'tier_b', status: 'quota_exceeded' });
    expect(logger.track).not.toHaveBeenCalled();
  });

  it('keeps structural errors visible to the UI', () => {
    const result = mapAskLeikoTierBResult({
      status: 'error',
      error: 'no_family',
    });
    expect(result).toEqual({
      source: 'tier_b',
      status: 'structural_error',
      reason: 'no_family',
    });
    expect(logger.track).not.toHaveBeenCalled();
  });

  it('silences soft errors and falls through to deterministic copy', () => {
    const result = mapAskLeikoTierBResult({
      status: 'error',
      error: 'client_timeout',
    });
    expect(result).toEqual({
      source: 'deterministic',
      body: DETERMINISTIC_COPY.ask_leiko,
    });
    expect(logger.track).toHaveBeenCalledWith('ai_degraded_fall_through', {
      surface: 'ask_leiko',
      from: 'tier_b',
      to: 'deterministic',
      reason: 'client_timeout',
    });
  });

  it('silences unknown soft errors too (network glitches we never named)', () => {
    const result = mapAskLeikoTierBResult({
      status: 'error',
      error: 'mysterious_503',
    });
    expect(result.source).toBe('deterministic');
    expect(logger.track).toHaveBeenCalledWith(
      'ai_degraded_fall_through',
      expect.objectContaining({ reason: 'mysterious_503' }),
    );
  });
});

describe('runSingleStringCascade', () => {
  it('returns Tier-B body when Tier-B succeeds', async () => {
    const result = await runSingleStringCascade({
      surface: 'daily_narration',
      tierB: async () => 'tier-b narration',
      tierA: () => 'tier-a fallback',
    });
    expect(result).toEqual({ source: 'tier_b', body: 'tier-b narration' });
    expect(logger.track).not.toHaveBeenCalled();
  });

  it('falls back to Tier-A when Tier-B returns null', async () => {
    const result = await runSingleStringCascade({
      surface: 'daily_narration',
      tierB: async () => null,
      tierA: () => 'tier-a fallback',
    });
    expect(result).toEqual({ source: 'tier_a', body: 'tier-a fallback' });
    expect(logger.track).toHaveBeenCalledWith('ai_degraded_fall_through', {
      surface: 'daily_narration',
      from: 'tier_b',
      to: 'tier_a',
      reason: 'returned_null',
    });
  });

  it('falls back to Tier-A when Tier-B throws', async () => {
    const result = await runSingleStringCascade({
      surface: 'daily_narration',
      tierB: async () => {
        throw new Error('network_error');
      },
      tierA: () => 'tier-a fallback',
    });
    expect(result).toEqual({ source: 'tier_a', body: 'tier-a fallback' });
    expect(logger.track).toHaveBeenCalledWith('ai_degraded_fall_through', {
      surface: 'daily_narration',
      from: 'tier_b',
      to: 'tier_a',
      reason: 'network_error',
    });
  });

  it('falls back to deterministic when both Tier-B and Tier-A return null', async () => {
    const result = await runSingleStringCascade({
      surface: 'reading_paragraph',
      tierB: async () => null,
      tierA: () => null,
    });
    expect(result).toEqual({
      source: 'deterministic',
      body: DETERMINISTIC_COPY.reading_paragraph,
    });
    expect(logger.track).toHaveBeenCalledWith('ai_degraded_fall_through', {
      surface: 'reading_paragraph',
      from: 'tier_a',
      to: 'deterministic',
      reason: 'no_template',
    });
  });

  it('respects a per-call deterministic override', async () => {
    const result = await runSingleStringCascade({
      surface: 'weekly_summary',
      tierB: async () => null,
      tierA: () => null,
      deterministic: 'custom calm copy',
    });
    expect(result.body).toBe('custom calm copy');
  });
});

describe('DETERMINISTIC_COPY voice-lint', () => {
  it.each(Object.entries(DETERMINISTIC_COPY))(
    '%s copy passes voice-lint',
    (_surface, copy) => {
      const lint = lintVoiceText(copy);
      expect(lint.passes).toBe(true);
    },
  );
});
