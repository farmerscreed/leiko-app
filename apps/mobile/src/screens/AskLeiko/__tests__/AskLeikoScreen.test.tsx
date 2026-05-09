// AskLeikoScreen.test.tsx — Sprint 11 task 10.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { AskLeikoScreen } from '../AskLeikoScreen';

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

    // Result block renders
    expect(screen.getByTestId('ask-leiko-result')).toBeTruthy();
    // Educate card link surfaces
    expect(
      screen.getByTestId('ai-response-card-link-numbers-001'),
    ).toBeTruthy();
  });

  it('typing then send routes a medication question to DEFER', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'should I take more lisinopril',
    );
    fireEvent.press(screen.getByTestId('ask-leiko-send'));

    expect(screen.getByTestId('ai-response-defer-medication')).toBeTruthy();
  });

  it('unknown question falls through to Tier-B placeholder', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.changeText(
      screen.getByTestId('ask-leiko-input'),
      'what color is the sky',
    );
    fireEvent.press(screen.getByTestId('ask-leiko-send'));

    expect(screen.getByTestId('ai-response-tier-b-placeholder')).toBeTruthy();
  });

  it('empty question does not trigger a response', () => {
    render(withProviders(<AskLeikoScreen {...makeProps()} />));
    fireEvent.press(screen.getByTestId('ask-leiko-send'));
    expect(screen.queryByTestId('ask-leiko-result')).toBeNull();
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
});
