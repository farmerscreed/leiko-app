// Deep-link parser tests — Sprint 15.

import { parseDeepLink } from '../deepLinkParser';

describe('parseDeepLink', () => {
  it('routes leiko://home', () => {
    expect(parseDeepLink('leiko://home')).toEqual({ category: 'home' });
  });

  it('routes leiko://weekly', () => {
    expect(parseDeepLink('leiko://weekly')).toEqual({ category: 'weekly' });
  });

  it('routes leiko://reading/{id}', () => {
    expect(parseDeepLink('leiko://reading/abc-123')).toEqual({
      category: 'reading',
      readingId: 'abc-123',
    });
  });

  it('routes leiko://vital/hr', () => {
    expect(parseDeepLink('leiko://vital/hr')).toEqual({ category: 'vital', vital: 'hr' });
  });

  it('routes leiko://vital/spo2', () => {
    expect(parseDeepLink('leiko://vital/spo2')).toEqual({ category: 'vital', vital: 'spo2' });
  });

  it('returns unknown for unsupported vital kinds', () => {
    expect(parseDeepLink('leiko://vital/glucose').category).toBe('unknown');
  });

  it('routes leiko://settings', () => {
    expect(parseDeepLink('leiko://settings')).toEqual({ category: 'settings' });
  });

  it('routes leiko://settings/devices', () => {
    expect(parseDeepLink('leiko://settings/devices')).toEqual({ category: 'settings_devices' });
  });

  it('routes leiko://family', () => {
    expect(parseDeepLink('leiko://family')).toEqual({ category: 'family' });
  });

  it('accepts the https://leiko.app/... variant', () => {
    expect(parseDeepLink('https://leiko.app/reading/abc-123')).toEqual({
      category: 'reading',
      readingId: 'abc-123',
    });
    expect(parseDeepLink('https://leiko.app/vital/hr')).toEqual({
      category: 'vital',
      vital: 'hr',
    });
  });

  it('unknown URL returns unknown', () => {
    expect(parseDeepLink('leiko://something-else').category).toBe('unknown');
  });

  it('strips query strings', () => {
    expect(parseDeepLink('leiko://reading/abc?utm=foo')).toEqual({
      category: 'reading',
      readingId: 'abc',
    });
  });
});
