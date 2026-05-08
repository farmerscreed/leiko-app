// ActivityGoalSheet — Sprint 8.5.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { ActivityGoalSheet } from '../ActivityGoalSheet';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('ActivityGoalSheet — render', () => {
  it('renders the title + helper copy + 5 segmented options', () => {
    render(
      withTheme(
        <ActivityGoalSheet
          open
          currentGoal={6000}
          onSubmit={() => undefined}
          onClose={() => undefined}
          testID="goal-sheet"
        />,
      ),
    );
    expect(screen.getByText('Daily step goal')).toBeTruthy();
    expect(screen.getByTestId('goal-sheet-helper')).toBeTruthy();
    for (const value of [4000, 6000, 8000, 10000, 12000]) {
      expect(screen.getByTestId(`goal-sheet-option-${value}`)).toBeTruthy();
    }
  });

  it('renders nothing when open=false', () => {
    render(
      withTheme(
        <ActivityGoalSheet
          open={false}
          currentGoal={6000}
          onSubmit={() => undefined}
          onClose={() => undefined}
          testID="goal-sheet"
        />,
      ),
    );
    expect(screen.queryByText('Daily step goal')).toBeNull();
  });
});

describe('ActivityGoalSheet — interactions', () => {
  it('Save with the preloaded goal calls onSubmit + onClose', () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    render(
      withTheme(
        <ActivityGoalSheet
          open
          currentGoal={6000}
          onSubmit={onSubmit}
          onClose={onClose}
          testID="goal-sheet"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('goal-sheet-save'));
    expect(onSubmit).toHaveBeenCalledWith(6000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selecting a different option then Save submits the new goal', () => {
    const onSubmit = jest.fn();
    render(
      withTheme(
        <ActivityGoalSheet
          open
          currentGoal={6000}
          onSubmit={onSubmit}
          onClose={() => undefined}
          testID="goal-sheet"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('goal-sheet-option-10000'));
    fireEvent.press(screen.getByTestId('goal-sheet-save'));
    expect(onSubmit).toHaveBeenCalledWith(10000);
  });
});

describe('ActivityGoalSheet — voice rules', () => {
  it('does not contain forbidden gamification or fear words', () => {
    const { toJSON } = render(
      withTheme(
        <ActivityGoalSheet
          open
          currentGoal={6000}
          onSubmit={() => undefined}
          onClose={() => undefined}
          testID="goal-sheet"
        />,
      ),
    );
    const json = JSON.stringify(toJSON());
    // Activity-specific anti-patterns + general voice rules.
    const forbidden = [
      /\bcrush(ed|ing)?\b/i,
      /\bbeast\b/i,
      /\bkiller\b/i,
      /\beasy\b/i,
      /\bsimple\b/i,
      /\bpatient\b/i,
      /\bdiagnose\b/i,
      /\bdangerous\b/i,
    ];
    for (const re of forbidden) {
      expect(json).not.toMatch(re);
    }
  });
});
