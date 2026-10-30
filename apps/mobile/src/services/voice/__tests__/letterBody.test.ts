import { letterBodyForDisplay, PENDING_LETTER_COPY } from '../storyCopy';

describe('letterBodyForDisplay (2026-10-30)', () => {
  it('replaces the old developer placeholder the founder saw on Trends', () => {
    expect(
      letterBodyForDisplay({
        body: 'Weekly summary not yet available — Tier-C is gated in this environment.',
        surface: 'weekly_summary',
      }),
    ).toBe(PENDING_LETTER_COPY.weekly_summary);
  });

  it('uses the monthly copy for monthly_baseline placeholders', () => {
    expect(
      letterBodyForDisplay({ body: 'anything', surface: 'monthly_baseline', model: 'placeholder' }),
    ).toBe("Your monthly summary will appear here once it's ready.");
  });

  it('passes real summaries through untouched', () => {
    const body = 'You are in your usual range this week.';
    expect(letterBodyForDisplay({ body, surface: 'weekly_summary', model: 'claude-sonnet' })).toBe(body);
  });
});
