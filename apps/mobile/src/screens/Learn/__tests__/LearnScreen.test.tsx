// LearnScreen.test.tsx — Sprint 13 task 4 part 2.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { LearnScreen } from '../LearnScreen';

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

describe('<LearnScreen />', () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockNavigate.mockReset();
  });

  it('renders the Learn header', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    expect(screen.getByRole('header', { name: 'Learn' })).toBeTruthy();
  });

  it('renders the featured "Start here" row pointing at numbers-001', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    expect(screen.getByText('Start here')).toBeTruthy();
    const featuredRow = screen.getByTestId('learn-featured-numbers-001');
    expect(featuredRow).toBeTruthy();
    fireEvent.press(featuredRow);
    expect(mockNavigate).toHaveBeenCalledWith('Article', {
      articleId: 'numbers-001',
    });
  });

  it('renders cluster sections for clusters that have at least one article', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    // The 5 reference articles cover NUMBERS, HR, SPO2, SLEEP, ACTIVITY.
    expect(screen.getByText('Understanding your numbers')).toBeTruthy();
    expect(screen.getByText('Heart rate')).toBeTruthy();
    expect(screen.getByText('Blood oxygen')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Activity')).toBeTruthy();
  });

  it('hides clusters with zero articles (CHANGES, CULTURAL, etc.)', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    expect(screen.queryByText('Why blood pressure changes')).toBeNull();
    expect(screen.queryByText('In your kitchen')).toBeNull();
  });

  it('cluster row navigates to LearnCluster with the right category', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    fireEvent.press(screen.getByTestId('learn-cluster-spo2-row'));
    expect(mockNavigate).toHaveBeenCalledWith('LearnCluster', {
      category: 'SPO2',
    });
  });

  it('back button calls goBack', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    fireEvent.press(screen.getByTestId('learn-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows the canonical "more cards arriving" footer', () => {
    render(withProviders(<LearnScreen {...makeProps()} />));
    expect(
      screen.getByText(/More cards arrive in the coming releases\./),
    ).toBeTruthy();
  });
});
