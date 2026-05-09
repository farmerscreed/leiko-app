// InlineExplainer.test.tsx — Sprint 13 task 5.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { InlineExplainer } from '../InlineExplainer';

function withProviders(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <ThemeProvider mode="caregiver">{node}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('<InlineExplainer /> — BP context', () => {
  it('renders the in-range header for a normal reading', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'bp', reading: { systolic: 110, diastolic: 70 } }}
        />,
      ),
    );
    expect(screen.getByText('Your reading is in range.')).toBeTruthy();
  });

  it('renders the Stage 1 header for a 135/85 reading', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'bp', reading: { systolic: 135, diastolic: 85 } }}
        />,
      ),
    );
    expect(screen.getByText('Your reading is in Stage 1.')).toBeTruthy();
    expect(screen.getByTestId('inline-explainer-subheader')).toBeTruthy();
  });

  it('renders the crisis header for an extreme reading', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'bp', reading: { systolic: 185, diastolic: 125 } }}
        />,
      ),
    );
    expect(
      screen.getByText('Your reading is at the crisis threshold.'),
    ).toBeTruthy();
  });

  it('renders the lead paragraph from the matched article', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'bp', reading: { systolic: 110, diastolic: 70 } }}
        />,
      ),
    );
    expect(screen.getByTestId('inline-explainer-lead')).toBeTruthy();
  });

  it('renders related-card rows for the matched articles', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'bp', reading: { systolic: 145, diastolic: 92 } }}
        />,
      ),
    );
    // Stage 2 reading should bring numbers-004 + numbers-001 into the
    // related row.
    expect(
      screen.getByTestId('inline-explainer-related-numbers-004'),
    ).toBeTruthy();
  });

  it('related-card tap fires onArticleOpen and dismisses', () => {
    const onArticleOpen = jest.fn();
    const onDismiss = jest.fn();
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={onDismiss}
          context={{ type: 'bp', reading: { systolic: 145, diastolic: 92 } }}
          onArticleOpen={onArticleOpen}
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('inline-explainer-related-numbers-004'));
    expect(onDismiss).toHaveBeenCalled();
    expect(onArticleOpen).toHaveBeenCalledWith('numbers-004');
  });

  it('"Read more in Learn" CTA fires onLearnOpen and dismisses', () => {
    const onLearnOpen = jest.fn();
    const onDismiss = jest.fn();
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={onDismiss}
          context={{ type: 'bp', reading: { systolic: 110, diastolic: 70 } }}
          onLearnOpen={onLearnOpen}
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('inline-explainer-cta-learn'));
    expect(onDismiss).toHaveBeenCalled();
    expect(onLearnOpen).toHaveBeenCalled();
  });

  it('always shows the disclaimer footer', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'bp', reading: { systolic: 110, diastolic: 70 } }}
        />,
      ),
    );
    expect(
      screen.getByText(
        /This is general information, not medical advice\. Talk to your doctor about what is right for you\./,
      ),
    ).toBeTruthy();
  });
});

describe('<InlineExplainer /> — non-BP vitals', () => {
  it('renders HR header + sub-header with the value when supplied', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'hr', restingHr: 68 }}
        />,
      ),
    );
    expect(screen.getByText('About your resting heart rate.')).toBeTruthy();
    expect(
      screen.getByText('68 bpm — typical range is 60 to 100.'),
    ).toBeTruthy();
  });

  it('falls back to a generic sub-header when restingHr is null', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'hr', restingHr: null }}
        />,
      ),
    );
    expect(
      screen.getByText('Typical range for healthy adults is 60 to 100 bpm.'),
    ).toBeTruthy();
  });

  it('renders SpO2 header + value sub-header', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'spo2', latestSpO2: 96 }}
        />,
      ),
    );
    expect(screen.getByText('About blood oxygen.')).toBeTruthy();
    expect(
      screen.getByText('96% — typical range is 95 to 100%.'),
    ).toBeTruthy();
  });

  it('renders Sleep header', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'sleep' }}
        />,
      ),
    );
    expect(screen.getByText('About sleep tracking.')).toBeTruthy();
  });

  it('renders Activity header', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'activity' }}
        />,
      ),
    );
    expect(screen.getByText('About activity.')).toBeTruthy();
  });

  it('surfaces the cluster priority-1 card for HR', () => {
    render(
      withProviders(
        <InlineExplainer
          visible
          onDismiss={() => undefined}
          context={{ type: 'hr', restingHr: 68 }}
        />,
      ),
    );
    expect(
      screen.getByTestId('inline-explainer-related-hr-001'),
    ).toBeTruthy();
  });
});
