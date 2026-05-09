// LearnClusterScreen.test.tsx — Sprint 13 task 4 part 2.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { LearnClusterScreen } from '../LearnClusterScreen';
import type { ArticleCategory } from '../../../services/learn/types';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

function withProviders(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <ThemeProvider mode="caregiver">{node}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function makeProps(category: ArticleCategory) {
  return {
    navigation: {
      goBack: mockGoBack,
      navigate: mockNavigate,
    } as never,
    route: { params: { category } } as never,
  };
}

describe('<LearnClusterScreen />', () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockNavigate.mockReset();
  });

  it('renders the cluster display name as a header', () => {
    render(withProviders(<LearnClusterScreen {...makeProps('NUMBERS')} />));
    expect(
      screen.getByRole('header', { name: 'Understanding your numbers' }),
    ).toBeTruthy();
  });

  it('renders an article row for each article in the cluster', () => {
    render(withProviders(<LearnClusterScreen {...makeProps('NUMBERS')} />));
    expect(
      screen.getByTestId('learn-cluster-article-numbers-001'),
    ).toBeTruthy();
  });

  it('article row navigates to ArticleScreen with articleId', () => {
    render(withProviders(<LearnClusterScreen {...makeProps('HR')} />));
    fireEvent.press(screen.getByTestId('learn-cluster-article-hr-001'));
    expect(mockNavigate).toHaveBeenCalledWith('Article', {
      articleId: 'hr-001',
    });
  });

  it('shows empty-cluster copy when no articles exist for the category', () => {
    render(withProviders(<LearnClusterScreen {...makeProps('CHANGES')} />));
    expect(
      screen.getByText(/Cards in this cluster arrive in the coming releases\./),
    ).toBeTruthy();
  });

  it('back button calls goBack', () => {
    render(withProviders(<LearnClusterScreen {...makeProps('SPO2')} />));
    fireEvent.press(screen.getByTestId('learn-cluster-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
