// ArticleScreen.test.tsx — Sprint 13 task 4 part 2.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { ArticleScreen } from '../ArticleScreen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockPush = jest.fn();

function withProviders(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <ThemeProvider mode="caregiver">{node}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function makeProps(articleId: string) {
  return {
    navigation: {
      goBack: mockGoBack,
      navigate: mockNavigate,
      push: mockPush,
    } as never,
    route: { params: { articleId } } as never,
  };
}

describe('<ArticleScreen />', () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockNavigate.mockReset();
    mockPush.mockReset();
  });

  it('renders the requested article title', () => {
    render(withProviders(<ArticleScreen {...makeProps('numbers-001')} />));
    expect(
      screen.getByRole('header', { name: 'What is blood pressure?' }),
    ).toBeTruthy();
  });

  it('renders sources footer for the article', () => {
    render(withProviders(<ArticleScreen {...makeProps('hr-001')} />));
    expect(screen.getByTestId('article-sources-footer')).toBeTruthy();
  });

  it('back button calls goBack', () => {
    render(withProviders(<ArticleScreen {...makeProps('numbers-001')} />));
    fireEvent.press(screen.getByTestId('article-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows "not found" copy when articleId does not match', () => {
    render(withProviders(<ArticleScreen {...makeProps('does-not-exist')} />));
    expect(screen.getByTestId('article-not-found')).toBeTruthy();
    expect(
      screen.getByText(/That card has not arrived yet\./),
    ).toBeTruthy();
  });
});
