// AIResponseRenderer.test.tsx — Sprint 11 task 8.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { AIResponseRenderer } from '../AIResponseRenderer';
import { classifyIntent } from '../../services/ai/intentRouter';
import type { IntentMatch } from '../../services/ai/types';

function withTheme(node: ReactNode) {
  return <ThemeProvider mode="caregiver">{node}</ThemeProvider>;
}

describe('<AIResponseRenderer />', () => {
  it('renders the Tier-B placeholder when nothing classifies', () => {
    const result: IntentMatch = {
      intent: null,
      matchedPattern: null,
      responseMode: 'TIER_B_PLACEHOLDER',
    };
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(screen.getByTestId('ai-response-tier-b-placeholder')).toBeTruthy();
    expect(
      screen.getByText(/I'm not sure how to answer that yet/),
    ).toBeTruthy();
  });

  it('renders an ANSWER template for a troubleshoot intent', () => {
    const result = classifyIntent("watch isn't syncing");
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(screen.getByTestId('ai-response-answer')).toBeTruthy();
    expect(
      screen.getByText(/Bring the watch close to the phone/),
    ).toBeTruthy();
  });

  it('renders an EDUCATE card link for a definition intent', () => {
    const result = classifyIntent('what is blood pressure');
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(screen.getByTestId('ai-response-educate')).toBeTruthy();
    expect(
      screen.getByTestId('ai-response-card-link-numbers-001'),
    ).toBeTruthy();
  });

  it('EDUCATE card link tap fires onArticleOpen', () => {
    const onArticleOpen = jest.fn();
    const result = classifyIntent('what is blood pressure');
    render(
      withTheme(
        <AIResponseRenderer result={result} onArticleOpen={onArticleOpen} />,
      ),
    );
    fireEvent.press(screen.getByTestId('ai-response-card-link-numbers-001'));
    expect(onArticleOpen).toHaveBeenCalledWith('numbers-001');
  });

  it('renders the medication DEFER template', () => {
    const result = classifyIntent('should I take more lisinopril');
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(screen.getByTestId('ai-response-defer-medication')).toBeTruthy();
    expect(
      screen.getByText(/Decisions about medication are best made/),
    ).toBeTruthy();
  });

  it('renders the symptom DEFER template', () => {
    const result = classifyIntent('do I have apnea');
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(screen.getByTestId('ai-response-defer-symptom')).toBeTruthy();
  });

  it('renders the pregnancy DEFER template', () => {
    const result = classifyIntent("I'm pregnant — is this normal");
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(screen.getByTestId('ai-response-defer-pregnancy')).toBeTruthy();
  });

  it('renders the mental-health-crisis DEFER template', () => {
    const result = classifyIntent('feeling hopeless lately');
    render(withTheme(<AIResponseRenderer result={result} />));
    expect(
      screen.getByTestId('ai-response-defer-mental_health_crisis'),
    ).toBeTruthy();
  });
});
