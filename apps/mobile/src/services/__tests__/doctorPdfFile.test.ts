// doctorPdfFile — download-to-cache + share-the-FILE (2026-06-05 fix:
// the old flow shared a signed URL as text, which expired in 1 hour).

const mockDownloadFileAsync = jest.fn();
const mockExists = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: Object.assign(
    jest.fn().mockImplementation((..._uris: unknown[]) => ({
      get exists() {
        return mockExists();
      },
    })),
    { downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args) },
  ),
}));

const mockIsAvailable = jest.fn();
const mockShareAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailable(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

const mockCopyToMediaStore = jest.fn();
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    MediaCollection: {
      copyToMediaStore: (...a: unknown[]) => mockCopyToMediaStore(...a),
    },
  },
}));

import {
  doctorPdfFileName,
  downloadDoctorPdf,
  pdfFileExists,
  savePdfToDownloads,
  sharePdfFile,
} from '../doctorPdfFile';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('doctorPdfFileName', () => {
  it('is unique per generation and carries the range', () => {
    expect(doctorPdfFileName('90d', 1780675832694)).toBe(
      'leiko_report_90d_1780675832694.pdf',
    );
  });
});

describe('downloadDoctorPdf', () => {
  it('returns the local uri on success', async () => {
    mockDownloadFileAsync.mockResolvedValue({ uri: 'file:///cache/leiko_report_30d_1.pdf' });
    const res = await downloadDoctorPdf('https://signed.example/x.pdf', '30d');
    expect(res).toEqual({ status: 'ok', uri: 'file:///cache/leiko_report_30d_1.pdf' });
    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      'https://signed.example/x.pdf',
      expect.anything(),
    );
  });

  it('never throws — returns the error reason', async () => {
    mockDownloadFileAsync.mockRejectedValue(new Error('network down'));
    const res = await downloadDoctorPdf('https://signed.example/x.pdf', '7d');
    expect(res).toEqual({ status: 'error', reason: 'network down' });
  });
});

describe('pdfFileExists', () => {
  it('true when the cache file is still there, false when evicted', () => {
    mockExists.mockReturnValue(true);
    expect(pdfFileExists('file:///cache/a.pdf')).toBe(true);
    mockExists.mockReturnValue(false);
    expect(pdfFileExists('file:///cache/a.pdf')).toBe(false);
  });
});

describe('sharePdfFile', () => {
  it('shares the FILE with the pdf mime type', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    const ok = await sharePdfFile('file:///cache/a.pdf');
    expect(ok).toBe(true);
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/a.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
  });

  it('returns false when file sharing is unavailable (caller falls back)', async () => {
    mockIsAvailable.mockResolvedValue(false);
    expect(await sharePdfFile('file:///cache/a.pdf')).toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});

describe('savePdfToDownloads (android)', () => {
  it('copies into the public Downloads via the MediaStore', async () => {
    mockCopyToMediaStore.mockResolvedValue('content://downloads/1');
    const res = await savePdfToDownloads(
      'file:///cache/leiko_report_30d_1.pdf',
      'leiko_report_30d_1.pdf',
    );
    expect(res).toEqual({ status: 'ok' });
    expect(mockCopyToMediaStore).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'leiko_report_30d_1', // extension stripped — MediaStore re-adds it
        mimeType: 'application/pdf',
      }),
      'Download',
      '/cache/leiko_report_30d_1.pdf', // file:// prefix stripped
    );
  });

  it('never throws — surfaces the failure reason', async () => {
    mockCopyToMediaStore.mockRejectedValue(new Error('disk full'));
    const res = await savePdfToDownloads('file:///cache/a.pdf', 'a.pdf');
    expect(res).toEqual({ status: 'error', reason: 'disk full' });
  });
});
