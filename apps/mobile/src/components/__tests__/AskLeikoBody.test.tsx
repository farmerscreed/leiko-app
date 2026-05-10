// AskLeikoBody.test.tsx — Sprint 14.5 task 1.
//
// Coverage focus: the new error-kind mapping. Renders the same way
// as Sprint 12 for ANSWER / EDUCATE / DEFER / loading / quota / ok —
// those are exercised through AskLeikoScreen.test.tsx already. This
// file adds focused cases for each known server error → user copy.

import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { AskLeikoBody, ASK_LEIKO_COPY } from '../AskLeikoBody';

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

describe('AskLeikoBody — server error → user copy mapping (Sprint 14.5)', () => {
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

  it('any unknown error code falls through to the generic copy', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'something_unexpected' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error-generic')).toBeTruthy();
    });
    expect(screen.getByTestId('ask-leiko-tier-b-error-generic').props.children).toBe(
      ASK_LEIKO_COPY.error,
    );
  });

  it('client_timeout → generic (transport-level failures stay generic per the card)', async () => {
    askTierBMock.mockResolvedValueOnce({ status: 'error', error: 'client_timeout' });
    render(withProviders(<AskLeikoBody onArticleOpen={onArticleOpen} />));
    await submitTierBQuestion();
    await waitFor(() => {
      expect(screen.getByTestId('ask-leiko-tier-b-error-generic')).toBeTruthy();
    });
  });
});
