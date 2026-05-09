// services/ai/tierB tests — Sprint 12.
//
// Sprint 12 follow-up: askTierB now uses raw fetch (not supabase-js's
// functions.invoke) because invoke was silently failing on the dev
// phone while raw fetch over the same path lands consistently. Tests
// mock global fetch and the supabase auth session accordingly.

jest.mock('../../supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
  },
}));
jest.mock('../../analytics/logger', () => ({
  logger: { track: jest.fn() },
}));

// Set env vars BEFORE importing the module under test — tierB reads
// EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY at call time so this works.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { askTierB, _internals } from '../tierB';
import { supabase } from '../../supabase';
import { logger } from '../../analytics/logger';

const getSessionSpy = supabase.auth.getSession as jest.Mock;
const trackSpy = logger.track as jest.Mock;
const fetchMock = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

function mockOkSession(): void {
  getSessionSpy.mockResolvedValue({
    data: { session: { access_token: 'test-jwt' } },
    error: null,
  });
}

function mockFetchJson(body: unknown, init: { ok?: boolean; status?: number } = {}): void {
  fetchMock.mockResolvedValueOnce({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  getSessionSpy.mockReset();
  trackSpy.mockReset();
  fetchMock.mockReset();
});

// ── Input validation ──────────────────────────────────────────────────

it('returns empty_question error and never fetches for empty input', async () => {
  const r = await askTierB({ question: '   ' });
  expect(r.status).toBe('error');
  if (r.status === 'error') expect(r.error).toBe('empty_question');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('returns question_too_long error and never fetches when > 2000 chars', async () => {
  const r = await askTierB({ question: 'a'.repeat(2001) });
  expect(r.status).toBe('error');
  if (r.status === 'error') expect(r.error).toBe('question_too_long');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('trims whitespace before sending and POSTs to the correct URL', async () => {
  mockOkSession();
  mockFetchJson({
    status: 'ok',
    body: 'ok body',
    conversationId: 'c1',
    messageId: 'm1',
    model: 'haiku',
    guard: { layer1Hits: 0, layer2MaxCosine: 0.1, retries: 0 },
  });
  await askTierB({ question: '   what is bp?   ' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://localhost:54321/functions/v1/ai-tier-b');
  expect(init.method).toBe('POST');
  expect(init.headers['Authorization']).toBe('Bearer test-jwt');
  expect(init.headers['apikey']).toBe('test-anon-key');
  expect(init.body).toBe(JSON.stringify({ question: 'what is bp?' }));
});

// ── OK path ───────────────────────────────────────────────────────────

it('returns ok with body, ids, and guard metadata on a successful response', async () => {
  mockOkSession();
  mockFetchJson({
    status: 'ok',
    body: 'Mum is in pattern.',
    conversationId: 'c-123',
    messageId: 'm-456',
    tier: 'B',
    model: 'claude-haiku-4-5-20251001',
    guard: { layer1Hits: 0, layer2MaxCosine: 0.42, retries: 0 },
  });
  const r = await askTierB({ question: 'is 75 bpm normal?' });
  expect(r.status).toBe('ok');
  if (r.status === 'ok') {
    expect(r.body).toBe('Mum is in pattern.');
    expect(r.conversationId).toBe('c-123');
    expect(r.messageId).toBe('m-456');
    expect(r.guard.layer2MaxCosine).toBe(0.42);
  }
});

it('logs ai_tier_b_started + ai_tier_b_ok on success — without the body', async () => {
  mockOkSession();
  mockFetchJson({
    status: 'ok',
    body: 'PHI-bearing reply must not be in analytics',
    conversationId: 'c',
    messageId: 'm',
    model: 'haiku',
    guard: { layer1Hits: 0, layer2MaxCosine: 0.41723, retries: 0 },
  });
  await askTierB({ question: 'q' });
  expect(trackSpy).toHaveBeenCalledWith('ai_tier_b_started', { length: 1 });
  expect(trackSpy).toHaveBeenCalledWith('ai_tier_b_ok', {
    retries: 0,
    layer1_hits: 0,
    layer2_max_cosine: 0.42,
  });
  for (const call of trackSpy.mock.calls) {
    const payload = JSON.stringify(call[1] ?? {});
    expect(payload.includes('PHI-bearing')).toBe(false);
  }
});

// ── DEFER path ────────────────────────────────────────────────────────

it('returns defer with valid trigger', async () => {
  mockOkSession();
  mockFetchJson({ status: 'defer', trigger: 'medication', reason: 'model_defer' });
  const r = await askTierB({ question: 'should i increase my lisinopril?' });
  expect(r.status).toBe('defer');
  if (r.status === 'defer') expect(r.trigger).toBe('medication');
});

it('translates server "pediatric" to mobile-canonical "paediatric"', async () => {
  mockOkSession();
  mockFetchJson({ status: 'defer', trigger: 'pediatric', reason: 'model_defer' });
  const r = await askTierB({ question: 'is bp ok for my 4 year old?' });
  expect(r.status).toBe('defer');
  if (r.status === 'defer') expect(r.trigger).toBe('paediatric');
});

it('also accepts British "paediatric" from the server pass-through', async () => {
  mockOkSession();
  mockFetchJson({ status: 'defer', trigger: 'paediatric', reason: '' });
  const r = await askTierB({ question: 'q' });
  expect(r.status).toBe('defer');
  if (r.status === 'defer') expect(r.trigger).toBe('paediatric');
});

it('rejects an unknown defer trigger as invalid_response', async () => {
  mockOkSession();
  mockFetchJson({ status: 'defer', trigger: 'wizardry', reason: '' });
  const r = await askTierB({ question: 'q' });
  expect(r.status).toBe('error');
  if (r.status === 'error') expect(r.error).toBe('invalid_defer_trigger');
});

// ── Quota path ────────────────────────────────────────────────────────

it('returns quota_exceeded with resetsAt', async () => {
  mockOkSession();
  mockFetchJson({
    status: 'quota_exceeded',
    tier: 'B',
    remaining: 0,
    resetsAt: '2026-06-01T00:00:00.000Z',
  });
  const r = await askTierB({ question: 'q' });
  expect(r.status).toBe('quota_exceeded');
  if (r.status === 'quota_exceeded') {
    expect(r.resetsAt).toBe('2026-06-01T00:00:00.000Z');
  }
  expect(trackSpy).toHaveBeenCalledWith('ai_tier_b_quota_exceeded');
});

// ── Error paths ───────────────────────────────────────────────────────

it('maps a thrown fetch exception to status=error network_error', async () => {
  mockOkSession();
  fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
  const r = await askTierB({ question: 'q' });
  expect(r.status).toBe('error');
  if (r.status === 'error') expect(r.error).toBe('network_error');
});

it('returns no_session when there is no access token', async () => {
  getSessionSpy.mockResolvedValue({ data: { session: null }, error: null });
  const r = await askTierB({ question: 'q' });
  expect(r.status).toBe('error');
  if (r.status === 'error') expect(r.error).toBe('no_session');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('parses null/garbage data as invalid_response', async () => {
  mockOkSession();
  mockFetchJson(null);
  const r = await askTierB({ question: 'q' });
  expect(r.status).toBe('error');
  if (r.status === 'error') expect(r.error).toBe('invalid_response');
});

// ── parseResponse direct unit coverage ────────────────────────────────

describe('parseResponse', () => {
  const { parseResponse } = _internals;
  it('returns invalid_response for non-object inputs', () => {
    expect(parseResponse(null).status).toBe('error');
    expect(parseResponse(42).status).toBe('error');
    expect(parseResponse('hello').status).toBe('error');
  });
  it('returns invalid_response when ok is missing required fields', () => {
    expect(parseResponse({ status: 'ok' }).status).toBe('error');
    expect(parseResponse({ status: 'ok', body: 'x' }).status).toBe('error');
  });
  it('defaults guard fields when partial', () => {
    const r = parseResponse({
      status: 'ok',
      body: 'b',
      conversationId: 'c',
      messageId: 'm',
      model: 'haiku',
      guard: {},
    });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.guard.layer1Hits).toBe(0);
      expect(r.guard.layer2MaxCosine).toBe(0);
      expect(r.guard.retries).toBe(0);
    }
  });
  it('returns invalid_response on unknown status field', () => {
    expect(parseResponse({ status: 'bonkers' }).status).toBe('error');
  });
});
