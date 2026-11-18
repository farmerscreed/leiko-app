import { changeLabel, parseKg, targetLabel } from '../WeightScreen';

describe('WeightScreen helpers', () => {
  it('parses kilograms with either decimal mark', () => {
    expect(parseKg('114.5')).toBe(114.5);
    expect(parseKg('114,5')).toBe(114.5);
    expect(parseKg('')).toBeNull();
    expect(parseKg('abc')).toBeNull();
  });

  it('describes change plainly', () => {
    expect(changeLabel(-1.2, 30)).toBe('−1.2 kg in 30 days');
    expect(changeLabel(0.4, 30)).toBe('+0.4 kg in 30 days');
    expect(changeLabel(0, 30)).toBe('No change in 30 days');
    expect(changeLabel(null, 30)).toBeNull();
  });

  it('describes the target without promising outcomes', () => {
    expect(targetLabel(115, null)).toBe('No target set');
    expect(targetLabel(115, 100)).toBe('Target 100.0 kg · 15.0 kg from it');
    expect(targetLabel(100.04, 100)).toBe("Target 100.0 kg · you're there");
    expect(targetLabel(null, 100)).toBe('Target 100.0 kg');
  });
});
