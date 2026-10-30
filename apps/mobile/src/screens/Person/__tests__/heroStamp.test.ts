import { heroStamp } from '../PersonOverviewScreen';

describe('PersonOverview heroStamp', () => {
  const now = Date.UTC(2026, 9, 30, 20, 0);
  it('shows only the time within 24h', () => {
    const s = heroStamp(now - 2 * 3_600_000, 'UTC', now);
    expect(s).not.toMatch(/Oct/);
    expect(s).toMatch(/6:00/);
  });
  it('adds the date for an older reading so it never looks like today', () => {
    const s = heroStamp(Date.UTC(2026, 8, 28, 20, 54), 'UTC', now);
    expect(s).toMatch(/Sep 28/);
    expect(s).toMatch(/8:54/);
  });
});

import { bandLabelFor } from '../PersonOverviewScreen';

describe('PersonOverview bandLabelFor', () => {
  it('shows a normal range', () => {
    expect(bandLabelFor(60.2, 69.8)).toBe('usual 60–70');
  });
  it('never shows a zero low end', () => {
    expect(bandLabelFor(0, 7763)).toBe('usual up to 7,763');
  });
});
