// AskLeikoBody.test.tsx — Sprint 14.5 task 1 + Sprint 16 cascade update.
//
// Coverage focus:
//   - Structural errors (no_family / no_session / unauthorized /
//     question_too_long) remain visible to the user.
//   - Soft errors (unknown server code, client_timeout, network
//     failures) are silenced by the Sprint 16 fall-through cascade
//     and rendered as a calm deterministic body — the user never
//     sees an AI error surface.

import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { AskLeikoBody, ASK_LEIKO_COPY } from '../AskLeikoBody';
import { DETERMINISTIC_COPY } from '../../services/ai/fallThrough';

jest.mock('../../services/ai/tierB', () => {
  const actual = jest.requireActual('../../services/ai/tierB');
  return { ...actual, askTierB: jest.fn() };
});
import { askTierB } from '../../services/ai/tierB';
const askTierBMock = askTierB as jest.Mock;

function withProviders(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <ThemeProvider mode="caregiver">{node}</ThemeProvider>
    </SafeAreaProvider>
  );
}

const onArticleOpen = jest.fn();

beforeEach(() => {
  askTierBMock.mockReset();
  onArticleOpen.mockReset();
});

async function submitTierBQuestion(): Promise<void> {
  fireEvent.changeText(screen.getByTestId('ask-leiko-input'), 'what color is the sky');
  await act(async () => {
    fireEvent.press(screen.getByTestId('ask-leiko-send'));
  });
}

describe('AskLeikoBody — structural errors stay visible (Sprint 14.5)', () => {
  it('no_family → renders the "finish setting up" copy', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'no_family' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error-no_family')).toBeTruthy();
    });
    expect(screen.getByTestId('ask-leiko-tier-b-error-no_family').props.children).toBe(
      ASK_LEIKO_COPY.errorNoFamily,
    );
  });

  it('no_session → renders the "sign in again" copy', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'no_session' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error-no_session')).toBeTruthy();
    });
    expect(screen.getByTestId('ask-leiko-tier-b-error-no_session').props.children).toBe(
      ASK_LEIKO_COPY.errorNoSession,
    );
  });

  it('unauthorized → also renders the "sign in again" copy', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'unauthorized' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error-no_session')).toBeTruthy();
    });
  });

  it('question_too_long → renders the "shorten it" copy', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'question_too_long' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error-question_too_long')).toBeTruthy();
    });
    expect(
      screen.getByTestId('ask-leiko-tier-b-error-question_too_long').props.children,
    ).toBe(ASK_LEIKO_COPY.errorQuestionTooLong);
  });
});

describe('AskLeikoBody — soft errors silenced by Sprint 16 cascade', () => {
  it('unknown server code → deterministic body, no error UI', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'something_unexpected' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-degraded')).toBeTruthy();
    });
    expect(screen.getByTestId('ask-leiko-tier-b-degraded').props.children).toBe(
      DETERMINISTIC_COPY.ask_leiko,
    );
    expect(screen.queryByTestId('ask-leiko-tier-b-error-generic')).toBeNull();
  });

  it('client_timeout → deterministic body, no error UI', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'client_timeout' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-degraded')).toBeTruthy();
    });
  });

  it('network_error → deterministic body, no error UI', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'network_error' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-degraded')).toBeTruthy();
    });
  });

  it('successful Tier-B response renders the body, not the degraded surface', async () => {
    askTierBMock.mockResolvedValueOnce({
      status: 'ok',
      body: 'A blood pressure reading has two numbers.',
      tier: 'B',
      model: 'haiku-4-5',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      guard: { layer1Hits: 0, layer2MaxCosine: 0.1, retries: 0 },
    });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-body')).toBeTruthy();
    });
    expect(screen.queryByTestId('ask-leiko-tier-b-degraded')).toBeNull();
  });
});
