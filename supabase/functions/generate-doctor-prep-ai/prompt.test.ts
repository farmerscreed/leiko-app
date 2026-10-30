import { assert, assertStringIncludes } from 'jsr:@std/assert@1';
import { bpPromptLine } from './prompt.ts';
import type { ScrubbedAiContext } from '../_shared/phi-scrub.ts';

const base: ScrubbedAiContext = {
  parentLabel: 'Lawrence',
  yearOfBirth: 1984,
  residenceCity: null,
  accountType: 'self_buyer',
};
const bp = (day: string) => ({
  latestSystolic: 133,
  latestDiastolic: 85,
  latestPulse: null,
  latestMeasuredAtDayUtcSec: Date.parse(`${day}T00:00:00Z`) / 1000,
  weekAverageSystolic: null,
  weekAverageDiastolic: null,
  state: 'learning' as never,
});

Deno.test('bpPromptLine marks a reading older than the range', () => {
  const line = bpPromptLine({ ...base, bp: bp('2026-09-28') }, '2026-10-01');
  assertStringIncludes(line, 'no readings in this date range');
  assert(!line.includes('latest 133/85'));
});

Deno.test('bpPromptLine dates a reading inside the range', () => {
  const line = bpPromptLine({ ...base, bp: bp('2026-10-20') }, '2026-10-01');
  assertStringIncludes(line, 'latest 133/85 on 2026-10-20');
});

Deno.test('bpPromptLine with no BP at all', () => {
  assertStringIncludes(bpPromptLine(base, '2026-10-01'), 'no readings');
});
