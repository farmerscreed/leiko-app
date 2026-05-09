// AskLeikoScreen.test.tsx — Sprint 11 task 10 + Sprint 12 Tier-B wiring.

import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { AskLeikoScreen } from '../AskLeikoScreen';

// Mock the Tier-B client. We don't want real Edge Function calls in
// component tests; the mocked askTierB returns whatever the test
// sets up via mockResolvedValueOnce.
jest.mock('../../../services/ai/tierB', () => {
  const actual = jest.requireActual('../../../services/ai/tierB');
  return {
    ...actual,
    askTierB: jest.fn(),
  };
});
import { askTierB } from '../../../services/ai/tierB';
const askTierBMock = askTierB as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

function withProviders(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <ThemeProvider mode="caregiver">{node}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function makeProps() {
  return {
    navigation: {
      goBack: mockGoBack,
      navigate: mockNavigate,
    } as never,
    route: { params: undefined } as never,
  };
}

describe('<AskLeikoScreen />', () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockNavigate.mockReset();
    askTierBMock.mockReset();
  });

  it('renders the header and input', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    expect(screen.getByRole('header', { name: 'Ask Leiko' })).toBeTruthy();
    expect(screen.getByTestId('ask-leiko-input')).toBeTruthy();
  });

  it('typing then send routes a definition question to EDUCATE', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    const input = screen.getByTestId('ask-leiko-input');
    fireEvent.changeText(input, 'what is blood pressure');
    fireEvent.press(screen.getByTestId('ask-leiko-send'));

    expect(screen.getByTestId('ask-leiko-result')).toBeTruthy();
    expect(
      screen.getByTestId('ai-response-card-link-numbers-001'),
    ).toBeTruthy();
    // EDUCATE is a Tier-A surface — Tier-B must NOT be invoked.
    expect(askTierBMock).not.toHaveBeenCalled();
  });

  it('typing then send routes a medication question to DEFER', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'should I take more lisinopril',
    );
    fireEvent.press(screen.getByTestId('ask-leiko-send'));

    expect(screen.getByTestId('ai-response-defer-medication')).toBeTruthy();
    // Local DEFER intent — Tier-B must NOT be invoked.
    expect(askTierBMock).not.toHaveBeenCalled();
  });

  it('empty question does not trigger a response', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.press(screen.getByTestId('ask-leiko-send'));
    expect(screen.queryByTestId('ask-leiko-result')).toBeNull();
    expect(askTierBMock).not.toHaveBeenCalled();
  });

  it('tapping an EDUCATE card link navigates to ArticleScreen', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what is blood pressure',
    );
    fireEvent.press(screen.getByTestId('ask-leiko-send'));
    fireEvent.press(screen.getByTestId('ai-response-card-link-numbers-001'));
    expect(mockNavigate).toHaveBeenCalledWith('Article', {
      articleId: 'numbers-001',
    });
  });

  it('back button calls goBack', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.press(screen.getByTestId('ask-leiko-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  // ── Sprint 12 — Tier-B integration ───────────────────────────────

  it('unknown question shows the loading state while Tier-B is in flight', () => {
    // Promise that never resolves → loading state stays.
    askTierBMock.mockReturnValue(new Promise(() => {}));
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what color is the sky',
    );
    fireEvent.press(screen.getByTestId('ask-leiko-send'));

    expect(screen.getByTestId('ask-leiko-tier-b-loading')).toBeTruthy();
    expect(askTierBMock).toHaveBeenCalledWith({ question: 'what color is the sky' });
  });

  it('Tier-B ok renders the body when the call resolves', async () => {
    askTierBMock.mockResolvedValueOnce({
      status: 'ok',
      body: 'A short voice-clean response.',
      tier: 'B',
      model: 'haiku',
      conversationId: 'c',
      messageId: 'm',
      guard: { layer1Hits: 0, layer2MaxCosine: 0.1, retries: 0 },
    });
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what color is the sky',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('ask-leiko-send'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-body')).toBeTruthy();
    });
    expect(screen.getByTestId('ask-leiko-tier-b-body').props.children).toBe(
      'A short voice-clean response.',
    );
  });

  it('Tier-B defer renders the matching DEFER template', async () => {
    askTierBMock.mockResolvedValueOnce({
      status: 'defer',
      trigger: 'symptom',
      reason: 'model_defer',
    });
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what color is the sky',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('ask-leiko-send'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-defer-symptom')).toBeTruthy();
    });
  });

  it('Tier-B quota_exceeded renders the quota copy', async () => {
    askTierBMock.mockResolvedValueOnce({
      status: 'quota_exceeded',
      tier: 'B',
      remaining: 0,
      resetsAt: '2026-06-01T00:00:00.000Z',
    });
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what color is the sky',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('ask-leiko-send'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-quota')).toBeTruthy();
    });
    const text = screen.getByTestId('ask-leiko-tier-b-quota').props.children;
    expect(text).toContain('reset');
  });

  it('Tier-B error renders the error copy', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'invoke_failed' });
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what color is the sky',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('ask-leiko-send'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error')).toBeTruthy();
    });
  });
});
