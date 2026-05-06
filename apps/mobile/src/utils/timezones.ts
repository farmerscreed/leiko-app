// IANA timezone catalogue + label formatting.
//
// Why this exists: onboarding originally shipped a curated list of ~10
// cities (Sprint 3/4 TimezonePicker). That left users in any other
// region — Cape Town, Mumbai, Dubai, Sydney, anywhere — unable to
// override the auto-detected zone. This util supplies the full IANA
// list at runtime via Intl.supportedValuesOf('timeZone') (Hermes 0.74+,
// V8, modern Node), with a hand-rolled fallback for environments that
// don't expose the API.
//
// The curated entries are still useful — they give Lagos and the major
// US cities a city-and-country label (e.g. "Lagos, Nigeria") rather
// than just the IANA path. For the rest, formatZoneLabel derives a
// readable city name from the IANA path itself.

export interface ZoneOption {
  iana: string;
  label: string;        // human-readable label for the picker
  curated: boolean;     // true → render in the "Common" section
}

// Hand-written labels for the most-likely zones in our two launch
// markets (Nigeria + US) plus common diaspora destinations. Order is
// significant: this is the order they appear in the picker's "Common"
// section.
const CURATED: ZoneOption[] = [
  { iana: 'Africa/Lagos',         label: 'Lagos, Nigeria',     curated: true },
  { iana: 'Africa/Accra',         label: 'Accra, Ghana',       curated: true },
  { iana: 'Europe/London',        label: 'London, UK',         curated: true },
  { iana: 'America/New_York',     label: 'New York, USA',      curated: true },
  { iana: 'America/Chicago',      label: 'Chicago, USA',       curated: true },
  { iana: 'America/Denver',       label: 'Denver, USA',        curated: true },
  { iana: 'America/Los_Angeles',  label: 'Los Angeles, USA',   curated: true },
  { iana: 'America/Phoenix',      label: 'Phoenix, USA',       curated: true },
  { iana: 'America/Anchorage',    label: 'Anchorage, USA',     curated: true },
  { iana: 'Pacific/Honolulu',     label: 'Honolulu, USA',      curated: true },
];

const CURATED_LABEL_BY_IANA: Record<string, string> = Object.fromEntries(
  CURATED.map((z) => [z.iana, z.label]),
);

// Static fallback for runtimes without Intl.supportedValuesOf. Covers
// the most common diaspora + major-city zones our user base is likely
// to span. The fallback is a safety net — Hermes 0.74+ (RN 0.81 ships
// with this) supplies the full list at runtime.
const STATIC_FALLBACK_ZONES: string[] = [
  'UTC',
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Cairo', 'Africa/Casablanca',
  'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Tunis',
  'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota',
  'America/Caracas', 'America/Chicago', 'America/Denver',
  'America/Guatemala', 'America/Halifax', 'America/Lima',
  'America/Los_Angeles', 'America/Mexico_City', 'America/New_York',
  'America/Phoenix', 'America/Regina', 'America/Sao_Paulo',
  'America/St_Johns', 'America/Toronto', 'America/Vancouver',
  'Asia/Bangkok', 'Asia/Beirut', 'Asia/Dhaka', 'Asia/Dubai',
  'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Riyadh',
  'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei',
  'Asia/Tehran', 'Asia/Tokyo',
  'Atlantic/Cape_Verde',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Melbourne',
  'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels',
  'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Lisbon',
  'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo',
  'Europe/Paris', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna',
  'Europe/Warsaw', 'Europe/Zurich',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Honolulu',
];

/**
 * Returns every IANA zone the runtime knows. Modern Hermes (RN 0.81+)
 * and V8 expose this via Intl.supportedValuesOf('timeZone'). Older
 * runtimes get the static fallback. The result is alphabetised and
 * de-duplicated.
 */
export function getAllIanaZones(): string[] {
  let zones: string[] | null = null;
  try {
    // Cast: TypeScript's lib.es5.d.ts doesn't include this on older
    // targets. The runtime check covers the actual support story.
    const fn = (Intl as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf;
    if (typeof fn === 'function') {
      zones = fn('timeZone');
    }
  } catch {
    // Some runtimes throw rather than return undefined; fall through.
  }
  if (!zones || zones.length === 0) {
    zones = [...STATIC_FALLBACK_ZONES];
  }
  // Defensive: ensure UTC is present, ensure curated entries are
  // present (they're popular enough that we never want them missing).
  for (const z of CURATED) {
    if (!zones.includes(z.iana)) zones.push(z.iana);
  }
  if (!zones.includes('UTC')) zones.push('UTC');
  return [...new Set(zones)].sort();
}

/**
 * Curated zones for the picker's "Common" section, in the order they
 * should appear.
 */
export function getCuratedZones(): ZoneOption[] {
  return CURATED;
}

/**
 * Human-readable label for an IANA zone. Curated zones use the
 * hand-written city/country pair; everything else derives a city name
 * from the trailing component of the IANA path (e.g. "Asia/Kolkata"
 * → "Kolkata", "America/Argentina/Buenos_Aires" → "Buenos Aires").
 */
export function formatZoneLabel(iana: string): string {
  const curated = CURATED_LABEL_BY_IANA[iana];
  if (curated) return curated;
  const last = iana.split('/').pop() ?? iana;
  return last.replace(/_/g, ' ');
}

/**
 * Pre-built option list with curated zones first (in curated order),
 * then everything else alphabetically. Each entry carries `curated`
 * so the picker can render section headers.
 */
export function getZoneOptions(): ZoneOption[] {
  const all = getAllIanaZones();
  const curatedSet = new Set(CURATED.map((z) => z.iana));
  const rest: ZoneOption[] = all
    .filter((iana) => !curatedSet.has(iana))
    .map((iana) => ({ iana, label: formatZoneLabel(iana), curated: false }));
  return [...CURATED, ...rest];
}

/**
 * Filter helper for the picker's search box. Matches against label
 * and IANA, case-insensitive.
 */
export function filterZones(options: ZoneOption[], query: string): ZoneOption[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return options;
  return options.filter(
    (z) =>
      z.label.toLowerCase().includes(q) ||
      z.iana.toLowerCase().includes(q),
  );
}
