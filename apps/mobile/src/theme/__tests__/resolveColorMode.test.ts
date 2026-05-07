// Pure-TS test for the colorMode resolution rules in ThemeProvider.
// Covers all 9 combinations of override × OS scheme so the rule from
// D12 §12.6 doesn't drift silently.

import { resolveColorMode } from '../resolveColorMode';

describe('resolveColorMode (D12 §12.6)', () => {
  describe('override = system → follow OS scheme', () => {
    it('OS dark → dark', () => {
      expect(resolveColorMode('system', 'dark')).toBe('dark');
    });
    it('OS light → light', () => {
      expect(resolveColorMode('system', 'light')).toBe('light');
    });
    it('OS unknown (null) → defaults to dark canonical', () => {
      expect(resolveColorMode('system', null)).toBe('dark');
    });
    it('OS unknown (undefined) → defaults to dark canonical', () => {
      expect(resolveColorMode('system', undefined)).toBe('dark');
    });
  });

  describe('override = dark → forced dark regardless of OS', () => {
    it('OS light → still dark', () => {
      expect(resolveColorMode('dark', 'light')).toBe('dark');
    });
    it('OS dark → dark', () => {
      expect(resolveColorMode('dark', 'dark')).toBe('dark');
    });
    it('OS unknown → dark', () => {
      expect(resolveColorMode('dark', null)).toBe('dark');
    });
  });

  describe('override = light → forced light regardless of OS', () => {
    it('OS dark → still light', () => {
      expect(resolveColorMode('light', 'dark')).toBe('light');
    });
    it('OS light → light', () => {
      expect(resolveColorMode('light', 'light')).toBe('light');
    });
  });
});
