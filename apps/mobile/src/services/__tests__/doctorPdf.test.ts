import {
  generateDoctorPdf,
  pdfRangeFromTrendsRange,
} from '../doctorPdf';

describe('pdfRangeFromTrendsRange', () => {
  it('passes through valid PDF ranges', () => {
    expect(pdfRangeFromTrendsRange('7d')).toBe('7d');
    expect(pdfRangeFromTrendsRange('30d')).toBe('30d');
    expect(pdfRangeFromTrendsRange('90d')).toBe('90d');
    expect(pdfRangeFromTrendsRange('1y')).toBe('1y');
  });

  it('falls back to 7d for all_time and unknown inputs', () => {
    expect(pdfRangeFromTrendsRange('all_time')).toBe('7d');
    expect(pdfRangeFromTrendsRange(null)).toBe('7d');
    expect(pdfRangeFromTrendsRange(undefined)).toBe('7d');
  });

  it('honours an explicit fallback', () => {
    expect(pdfRangeFromTrendsRange('all_time', '30d')).toBe('30d');
  });
});

describe('generateDoctorPdf', () => {
  function makeClient(
    invoke: (name: string, opts: { body: unknown }) => Promise<unknown>,
  ) {
    return {
      functions: {
        invoke,
      },
    } as unknown as Parameters<typeof generateDoctorPdf>[1];
  }

  it('returns ok with the signed URL on success', async () => {
    const result = await generateDoctorPdf(
      { familyId: 'f', userId: 'u', range: '7d' },
      makeClient(async () => ({
        data: { url: 'https://signed', bytes: 1024, storagePath: 'reports/u.pdf' },
        error: null,
      })),
    );
    expect(result).toEqual({
      status: 'ok',
      url: 'https://signed',
      bytes: 1024,
      storagePath: 'reports/u.pdf',
    });
  });

  it('returns mock when the dev rasterizer seam fires', async () => {
    const result = await generateDoctorPdf(
      { familyId: 'f', userId: 'u', range: '30d' },
      makeClient(async () => ({
        data: { mode: 'mock', html: '<html>…</html>', htmlBytes: 12 },
        error: null,
      })),
    );
    expect(result.status).toBe('mock');
    if (result.status === 'mock') {
      expect(result.htmlBytes).toBe(12);
    }
  });

  it('returns error on invoke failure', async () => {
    const result = await generateDoctorPdf(
      { familyId: 'f', userId: 'u', range: '7d' },
      makeClient(async () => ({
        data: null,
        error: { message: 'edge function 500' },
      })),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('invoke_failed');
    }
  });

  it('returns error on an invalid response shape', async () => {
    const result = await generateDoctorPdf(
      { familyId: 'f', userId: 'u', range: '7d' },
      makeClient(async () => ({ data: { mystery: true }, error: null })),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('invalid_response');
    }
  });

  it('returns error when the invoke throws', async () => {
    const result = await generateDoctorPdf(
      { familyId: 'f', userId: 'u', range: '7d' },
      makeClient(async () => {
        throw new Error('network_error');
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toBe('network_error');
    }
  });
});
