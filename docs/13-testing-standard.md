# 13 — Testing Standard

How we test in this codebase. Tools, layers, coverage targets, and the privacy-respecting telemetry rules. Sourced from D7 §11 (observability) and D7 §12 (testing strategy), plus the testing bar in CLAUDE.md.

---

## The bar (from CLAUDE.md)

Every sprint produces tests. The bar is:
- **Unit tests** for any pure function (formatters, validators, classification)
- **Component tests** for any new component (renders, props, accessibility label)
- **Integration tests** for any flow that crosses 2+ screens
- **E2E tests** are Sprint 17 work, not per-sprint

A sprint is not done until tests pass in CI.

---

## Test pyramid (D7 §12.1)

| Layer | Tool | Coverage target | Run on |
| --- | --- | --- | --- |
| Unit | Jest 29 + ts-jest | 80% on `src/lib`, `src/ble` (excluding wrappers needing a device) | Every PR |
| Component | React Native Testing Library + Jest | 70% on screens and components | Every PR |
| Edge Function | Deno test + supabase-test-helpers | 100% on policy-critical paths (`sync`, `accept-invite`, `transfer-ownership`, `revoke-consent`) | Every PR |
| BLE mock | In-memory BLE adapter (`tools/ble-mock` — to be created Sprint 5) | 100% of command wrappers + state-machine transitions | Every PR |
| Integration (BLE on real device) | Maestro + AWS Device Farm BLE units | Smoke suite of 12 critical flows | Nightly + before release |
| E2E | Maestro (Sprint 17) | Smoke + 8 critical user journeys | Before release |
| Soak | Custom harness on Hetzner GPU node | 7-day continuous BLE connect/disconnect | Before each release |
| Load | k6 | 500 concurrent `/sync`, 100 concurrent `/ai-query` | Before release |
| Security | Snyk + npm audit + git-secrets | No high/critical vulns | Every PR |
| Copy-lint | `tools/copy-lint` (D6 §6.5) | No forbidden claims (`docs/05-voice-and-claims.md`) | Every PR; also runs over AI prompt fixtures |
| Accessibility | iOS Accessibility Inspector + Android Accessibility Scanner; manual VoiceOver/TalkBack | WCAG 2.2 AA on all V1 screens | Before release |
| Jailbreak / red-team (AI) | Custom suite of ~50 adversarial prompts | 100% deflection rate | Every PR touching AI prompts |

> **E2E choice — LOCK: Maestro (NOT Detox).** Maestro is YAML-driven, ~10× faster to set up, doesn't require a debug native build, and is well-suited to a small team. CLAUDE.md mentions Detox; that's a v0 draft note — Maestro is the canonical choice per D7 §12.2.

---

## What tests should look like

### Unit test (pure function)
```ts
// src/lib/anomaly/classify.test.ts
import { classifyReading } from './classify';

describe('classifyReading', () => {
  it('returns "in_range" for 118/76', () => {
    expect(classifyReading({ sys: 118, dia: 76 }).kind).toBe('in_range');
  });

  it('returns "calm_concerned" when sys=145 and 7-day baseline=125', () => {
    const out = classifyReading({ sys: 145, dia: 84 }, { baselineSys: 125, baselineDia: 78 });
    expect(out.kind).toBe('calm_concerned');
  });
});
```

### Component test (RNTL)
```tsx
// src/components/ReadingCard.test.tsx
import { render } from '@testing-library/react-native';
import { ReadingCard } from './ReadingCard';

describe('ReadingCard', () => {
  it('renders sys/dia in tabular numeric type', () => {
    const { getByText } = render(<ReadingCard sys={128} dia={82} measuredAt={'2026-05-04T07:14:00Z'} />);
    expect(getByText('128/82')).toBeTruthy();
  });

  it('exposes accessibilityLabel', () => {
    const { getByA11yLabel } = render(<ReadingCard sys={128} dia={82} measuredAt={'2026-05-04T07:14:00Z'} />);
    expect(getByA11yLabel(/blood pressure/i)).toBeTruthy();
  });
});
```

### Voice gate (must run in CI)
A copy-lint test asserts that no string in `apps/mobile/src/i18n/**.{ts,json}` matches the forbidden phrase list in `docs/05-voice-and-claims.md`. Failure blocks merge. See that doc for the implementation contract.

---

## Telemetry rules (D7 §11)

### Logging schema (server)
```jsonc
// every Edge Function emits via /functions/_shared/log.ts
{
  "ts": "2026-04-23T07:14:35.421Z",
  "level": "info" | "warn" | "error",
  "fn": "sync",
  "request_id": "uuid",
  "user_id": "uuid | null",
  "family_id": "uuid | null",
  "msg": "human readable",
  "metadata": { /* never contains PHI; enforced by lint */ }
}
```

### PHI scrubbing (`/functions/_shared/phi-scrub.ts`)
A small library is imported by every external-egress wrapper (Sentry `beforeSend`, LiteLLM client wrapper, log emitter). Strips: `email`, `phone`, `full_name`, `first_name`, `last_name`, `parent_display_name`, `caregiver_display_name`, `mac_address`, `serial_number`, `device_serial`, `systolic`, `diastolic`, `pulse`, `sys`, `dia`.

```ts
const PHI_KEYS = new Set([
  'email','phone','full_name','first_name','last_name',
  'parent_display_name','caregiver_display_name',
  'mac_address','serial_number','device_serial',
  'systolic','diastolic','pulse','sys','dia',
]);

export function scrubPhi<T>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubPhi) as T;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PHI_KEYS.has(k) ? '[redacted]' : scrubPhi(v);
  }
  return out;
}
```

CI test: a synthetic crash with PHI-shaped fields must arrive in Sentry redacted. Failure of this test BLOCKS release.

### Analytics event policy (PostHog)
Event names + non-identifying metadata ONLY. **NEVER** reading values, **NEVER** full names, **NEVER** device serial numbers. All event-property keys are reviewed against the PHI key list above.

Allowed examples:
- `reading.captured` — `{ source: 'watch', quality: 'good', timezone: 'America/New_York' }`
- `family.invite_sent` — `{ kind: 'caregiver' }`
- `paywall.viewed` — `{ trigger: 'pdf_export' }`

Forbidden examples (would fail review):
- `reading.captured` with `{ sys, dia, pulse }` — strip values
- `family.invite_sent` with `invitee_email` — strip
- `device.paired` with `mac_address` or `serial_number` — strip

---

## Key metrics & alert thresholds (D7 §11.3)

| Metric | Source | Target | Alert threshold |
| --- | --- | --- | --- |
| BLE sync success rate | PostHog `ble.sync` | ≥ 95% per family per 24h | < 90% over 1h window |
| BLE pairing success rate | PostHog `ble.pair` | ≥ 90% | < 85% over 24h |
| `/sync` latency p95 | Edge Function logs | ≤ 800 ms | > 1500 ms over 5m |
| `/ai-query` latency p95 (Tier B) | LiteLLM logs | ≤ 10 s | > 12 s over 15m |
| Push delivery success | Expo receipts | ≥ 98% | < 95% over 1h |
| App cold start p50 | PostHog perf event | ≤ 2 s | > 3 s over 24h |
| Realtime subscription health | Supabase Realtime | WebSocket up > 99.5% | < 99% over 15m |
| Anomaly false-positive rate | PostHog `ai.feedback` | ≤ 15% thumbs-down on anomaly notifications | > 25% week-over-week |
| **Forbidden-claim hits in production copy** | Copy-lint output | **0 (zero — hard requirement)** | **> 0 ANY release** |
| Sentry crash-free sessions | Sentry | ≥ 99.5% | < 99% over 24h |
| BAA scope monitor | Manual quarterly review | All PHI egresses through Anthropic BAA endpoint | Any non-BAA egress detected |

---

## Per-sprint test volume targets (rule of thumb)

These are not hard quotas; they're "if a sprint produces fewer tests than this, ask why."

| Sprint type | Unit | Component | Integration |
| --- | --- | --- | --- |
| Foundation (0, 1) | 5–10 | 5–15 | 0–2 |
| Onboarding (2, 3, 4) | 10–15 | 10–15 | 3–5 |
| BLE (5) | 20+ (state machine) | 5 | 3 (mock) |
| Reading flow (6) | 15+ | 10 | 5 |
| Home (7, 8) | 5–10 | 15 | 5 |
| Trends (9) | 10 | 10 | 3 |
| Settings + paywall (10) | 10 | 10 | 5 |
| AI (11, 12) | 20+ (router + classifier + scrub) | 5 | 3 |
| Learn (13, 14) | 10 | 15 | 3 |
| Push + anomaly (15) | 15 | 5 | 5 |
| Offline + errors (16) | 10 | 10 | 10+ |
| Launch (17) | n/a | n/a | 8 (E2E Maestro) |

---

## Pre-flight checks (before every release)
1. Copy-lint over all `apps/mobile/src/i18n/**` and AI prompt fixtures — zero forbidden claims.
2. Synthetic crash with PHI-shaped fields — arrives at Sentry redacted.
3. Synthetic event with reading values — arrives at PostHog without `sys`/`dia`/`pulse`.
4. Maestro smoke suite green on iOS + Android.
5. BLE soak test green on at least one watch (48h+).
6. WCAG 2.2 AA scan green on all V1 screens.
7. AI red-team suite — 100% deflection rate.

If any pre-flight fails, the release is blocked. Hotfix branches are not exempt.
