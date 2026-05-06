// Pure tests for the timezone catalogue + label formatting.
//
// Bar:
//   - getAllIanaZones uses Intl.supportedValuesOf when available
//   - getAllIanaZones falls back to the static list when Intl doesn't
//     expose the API (older Hermes / unusual runtimes)
//   - Curated zones are always present in the result
//   - formatZoneLabel uses the curated label for known zones
//   - formatZoneLabel derives a readable city for non-curated zones
//   - filterZones matches case-insensitively across label and IANA

import {
  filterZones,
  formatZoneLabel,
  getAllIanaZones,
  getCuratedZones,
  getZoneOptions,
} from '../timezones';

describe('formatZoneLabel', () => {
  it('returns the curated label for known zones', () => {
    expect(formatZoneLabel('Africa/Lagos')).toBe('Lagos, Nigeria');
    expect(formatZoneLabel('America/New_York')).toBe('New York, USA');
  });

  it('derives a city name from the IANA path for non-curated zones', () => {
    expect(formatZoneLabel('Africa/Nairobi')).toBe('Nairobi');
    expect(formatZoneLabel('Africa/Johannesburg')).toBe('Johannesburg');
    expect(formatZoneLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });

  it('handles UTC and other single-segment zones', () => {
    expect(formatZoneLabel('UTC')).toBe('UTC');
  });
});

describe('getAllIanaZones', () => {
  it('returns a non-empty alphabetised list', () => {
    const zones = getAllIanaZones();
    expect(zones.length).toBeGreaterThan(20);
    const sorted = [...zones].sort();
    expect(zones).toEqual(sorted);
  });

  it('contains every curated zone', () => {
    const zones = getAllIanaZones();
    for (const z of getCuratedZones()) {
      expect(zones).toContain(z.iana);
    }
  });

  it('contains UTC', () => {
    expect(getAllIanaZones()).toContain('UTC');
  });

  it('falls back to the static list when Intl.supportedValuesOf is missing', async () => {
    const original = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    try {
      delete (Intl as { supportedValuesOf?: unknown }).supportedValuesOf;
      jest.resetModules();
      const mod = await import('../timezones');
      const fallback = mod.getAllIanaZones();
      expect(fallback.length).toBeGreaterThan(20);
      expect(fallback).toContain('Africa/Lagos');
      expect(fallback).toContain('Africa/Nairobi');
    } finally {
      if (original) {
        (Intl as unknown as { supportedValuesOf: typeof original }).supportedValuesOf =
          original;
      }
    }
  });
});

describe('getZoneOptions', () => {
  it('places all curated zones first, in curated order', () => {
    const options = getZoneOptions();
    const curated = getCuratedZones();
    for (let i = 0; i < curated.length; i++) {
      expect(options[i].iana).toBe(curated[i].iana);
      expect(options[i].curated).toBe(true);
    }
  });

  it('marks non-curated zones with curated=false', () => {
    const options = getZoneOptions();
    const nonCurated = options.find((o) => o.iana === 'Africa/Nairobi');
    expect(nonCurated).toBeDefined();
    expect(nonCurated?.curated).toBe(false);
  });
});

describe('filterZones', () => {
  const sample = getZoneOptions();

  it('returns the full list when query is empty', () => {
    expect(filterZones(sample, '').length).toBe(sample.length);
    expect(filterZones(sample, '   ').length).toBe(sample.length);
  });

  it('matches case-insensitively against the label', () => {
    const results = filterZones(sample, 'lagos');
    expect(results.some((z) => z.iana === 'Africa/Lagos')).toBe(true);
  });

  it('matches against the IANA path', () => {
    const results = filterZones(sample, 'nairobi');
    expect(results.some((z) => z.iana === 'Africa/Nairobi')).toBe(true);
  });

  it('returns an empty list for unmatched queries', () => {
    expect(filterZones(sample, 'zzzzznonexistent')).toHaveLength(0);
  });
});
