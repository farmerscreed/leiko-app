// Deep-link URL parser — Sprint 15.
//
// Pure-function half of the deep-link system (`./deepLinks.ts` does
// dispatch via the navigation ref, which transitively imports React
// Navigation). Splitting the parser out keeps the test suite runnable
// under the pure Jest project without pulling RN modules in.

export interface ParsedDeepLink {
  category:
    | 'home'
    | 'weekly'
    | 'reading'
    | 'vital'
    | 'settings'
    | 'settings_devices'
    | 'settings_subscription'
    | 'family'
    | 'unknown';
  readingId?: string;
  vital?: 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity';
}

export function parseDeepLink(url: string): ParsedDeepLink {
  const stripped = url
    .replace(/^leiko:\/\//, '')
    .replace(/^https?:\/\/leiko\.app\//, '');
  const [pathRaw] = stripped.split('?');
  const segments = pathRaw.split('/').filter(Boolean);
  const [first, second] = segments;
  switch (first) {
    case 'home':
    case undefined:
      return { category: 'home' };
    case 'weekly':
      return { category: 'weekly' };
    case 'reading':
      return { category: 'reading', readingId: second };
    case 'vital':
      if (
        second === 'bp' ||
        second === 'hr' ||
        second === 'spo2' ||
        second === 'sleep' ||
        second === 'activity'
      ) {
        return { category: 'vital', vital: second };
      }
      return { category: 'unknown' };
    case 'settings':
      if (second === 'devices') return { category: 'settings_devices' };
      if (second === 'subscription') return { category: 'settings_subscription' };
      return { category: 'settings' };
    case 'family':
      return { category: 'family' };
    default:
      return { category: 'unknown' };
  }
}
