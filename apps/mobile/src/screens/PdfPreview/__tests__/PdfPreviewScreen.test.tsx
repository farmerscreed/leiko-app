// PdfPreview — in-app doctor-report viewer (2026-06-05).

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';

// react-native-pdf is a native module — stub it with a marker.
jest.mock('react-native-pdf', () => {
  const { Text: T } = jest.requireActual('react-native');
  return function PdfMock() {
    return <T>__pdf_document__</T>;
  };
});

const mockShare = jest.fn();
const mockSave = jest.fn();
jest.mock('../../../services/doctorPdfFile', () => ({
  sharePdfFile: (...a: unknown[]) => mockShare(...a),
  savePdfToDownloads: (...a: unknown[]) => mockSave(...a),
}));

import { PdfPreviewScreen } from '../PdfPreviewScreen';

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 720 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver" colorMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const PARAMS = {
  fileUri: 'file:///cache/leiko_report_90d_1.pdf',
  title: 'Doctor report · last 90 days',
};

function renderScreen(goBack: () => void = () => undefined) {
  return render(
    withProviders(
      <PdfPreviewScreen navigation={{ goBack }} route={{ params: PARAMS }} />,
    ),
  );
}

describe('PdfPreviewScreen', () => {
  beforeEach(() => {
    mockShare.mockClear();
    mockSave.mockClear();
  });

  it('renders the title and the document', () => {
    renderScreen();
    expect(screen.getByText('Doctor report · last 90 days')).toBeTruthy();
    expect(screen.getByText('__pdf_document__')).toBeTruthy();
  });

  it('Share hands the local FILE to the share service', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('pdf-preview-share'));
    expect(mockShare).toHaveBeenCalledWith(PARAMS.fileUri);
  });

  it('Download saves to the phone and confirms calmly', async () => {
    mockSave.mockResolvedValue({ status: 'ok' });
    renderScreen();
    fireEvent.press(screen.getByTestId('pdf-preview-download'));
    expect(mockSave).toHaveBeenCalledWith(
      PARAMS.fileUri,
      'leiko_report_90d_1.pdf',
    );
    expect(
      await screen.findByText("Saved to your phone's Downloads folder."),
    ).toBeTruthy();
  });

  it('Download failure points at Share, never crashes', async () => {
    mockSave.mockResolvedValue({ status: 'error', reason: 'x' });
    renderScreen();
    fireEvent.press(screen.getByTestId('pdf-preview-download'));
    expect(await screen.findByTestId('pdf-preview-save-error')).toBeTruthy();
  });

  it('Back calls goBack', () => {
    const goBack = jest.fn();
    renderScreen(goBack);
    fireEvent.press(screen.getByTestId('pdf-preview-back'));
    expect(goBack).toHaveBeenCalled();
  });
});
