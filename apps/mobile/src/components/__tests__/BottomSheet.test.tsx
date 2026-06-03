import { type ReactNode } from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { BottomSheet } from '../BottomSheet';
import { ThemeProvider } from '../../theme';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

describe('BottomSheet — visibility', () => {
  it('renders nothing when visible=false', () => {
    render(
      withTheme(
        <BottomSheet visible={false} onDismiss={() => undefined}>
          <Text>Inline explainer body</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.queryByText('Inline explainer body')).toBeNull();
  });

  it('renders the surface and content when visible=true', () => {
    render(
      withTheme(
        <BottomSheet visible onDismiss={() => undefined}>
          <Text>Inline explainer body</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByText('Inline explainer body')).toBeTruthy();
  });

  it('renders the title in the header when title prop is set', () => {
    render(
      withTheme(
        <BottomSheet visible title="Add a note" onDismiss={() => undefined}>
          <Text>body</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByText('Add a note')).toBeTruthy();
  });
});

describe('BottomSheet — cancelled dismissal must still unmount', () => {
  // Regression: the close path only unmounted when the dismiss animation
  // reported finished === true. A CANCELLED dismissal (rapid open/close,
  // competing gesture + backdrop dismiss, re-render restarting the timing)
  // left the Modal mounted with a 0-opacity backdrop — an invisible
  // full-screen touch-eater. Symptom: "the back button sometimes doesn't
  // work" on sheet-heavy screens like Settings.
  it('unmounts when the close animation is cancelled (finished=false)', () => {
    const reanimated = jest.requireMock('react-native-reanimated');
    const original = reanimated.withTiming;
    // Simulate Reanimated cancelling the dismissal.
    reanimated.withTiming = (
      toValue: number,
      _config: unknown,
      callback?: (finished: boolean) => void,
    ) => {
      if (typeof callback === 'function') callback(false);
      return toValue;
    };
    try {
      const { rerender } = render(
        withTheme(
          <BottomSheet visible onDismiss={() => undefined}>
            <Text>sheet body</Text>
          </BottomSheet>,
        ),
      );
      expect(screen.getByText('sheet body')).toBeTruthy();
      rerender(
        withTheme(
          <BottomSheet visible={false} onDismiss={() => undefined}>
            <Text>sheet body</Text>
          </BottomSheet>,
        ),
      );
      // Old behaviour: still mounted here (invisible), eating touches.
      expect(screen.queryByText('sheet body')).toBeNull();
    } finally {
      reanimated.withTiming = original;
    }
  });

  it('unmounts via the JS timeout fallback when the worklet callback never fires', () => {
    jest.useFakeTimers();
    const reanimated = jest.requireMock('react-native-reanimated');
    const original = reanimated.withTiming;
    // Worst case: the animation callback is swallowed entirely.
    reanimated.withTiming = (toValue: number) => toValue;
    try {
      const { rerender } = render(
        withTheme(
          <BottomSheet visible onDismiss={() => undefined}>
            <Text>sheet body</Text>
          </BottomSheet>,
        ),
      );
      rerender(
        withTheme(
          <BottomSheet visible={false} onDismiss={() => undefined}>
            <Text>sheet body</Text>
          </BottomSheet>,
        ),
      );
      act(() => {
        jest.advanceTimersByTime(1000); // > dismissDuration + 50
      });
      expect(screen.queryByText('sheet body')).toBeNull();
    } finally {
      reanimated.withTiming = original;
      jest.useRealTimers();
    }
  });

  it('a re-open during the close animation wins (no spurious unmount)', () => {
    const { rerender } = render(
      withTheme(
        <BottomSheet visible onDismiss={() => undefined}>
          <Text>sheet body</Text>
        </BottomSheet>,
      ),
    );
    rerender(
      withTheme(
        <BottomSheet visible={false} onDismiss={() => undefined}>
          <Text>sheet body</Text>
        </BottomSheet>,
      ),
    );
    rerender(
      withTheme(
        <BottomSheet visible onDismiss={() => undefined}>
          <Text>sheet body</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByText('sheet body')).toBeTruthy();
  });
});

describe('BottomSheet — dismiss interactions', () => {
  it('calls onDismiss when the backdrop is tapped', () => {
    const onDismiss = jest.fn();
    render(
      withTheme(
        <BottomSheet visible onDismiss={onDismiss}>
          <Text>body</Text>
        </BottomSheet>,
      ),
    );
    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the close button is tapped', () => {
    const onDismiss = jest.fn();
    render(
      withTheme(
        <BottomSheet visible title="Add a note" onDismiss={onDismiss}>
          <Text>body</Text>
        </BottomSheet>,
      ),
    );
    fireEvent.press(screen.getByTestId('bottomsheet-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet — confirmed-urgent variant', () => {
  it('does not call onDismiss on backdrop tap', () => {
    const onDismiss = jest.fn();
    render(
      withTheme(
        <BottomSheet visible confirmedUrgent onDismiss={onDismiss}>
          <Text>Three high readings in the last hour</Text>
        </BottomSheet>,
      ),
    );
    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('hides the close button', () => {
    render(
      withTheme(
        <BottomSheet
          visible
          confirmedUrgent
          title="Please call Dad"
          onDismiss={() => undefined}
        >
          <Text>body</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.queryByTestId('bottomsheet-close')).toBeNull();
  });
});

describe('BottomSheet — sizing variants', () => {
  it('renders the compact size', () => {
    render(
      withTheme(
        <BottomSheet visible size="compact" onDismiss={() => undefined}>
          <Text>compact</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByText('compact')).toBeTruthy();
  });

  it('renders the tall size', () => {
    render(
      withTheme(
        <BottomSheet visible size="tall" onDismiss={() => undefined}>
          <Text>tall</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByText('tall')).toBeTruthy();
  });

  it('renders the full size (D12 §11.1)', () => {
    render(
      withTheme(
        <BottomSheet visible size="full" onDismiss={() => undefined}>
          <Text>full</Text>
        </BottomSheet>,
      ),
    );
    expect(screen.getByText('full')).toBeTruthy();
  });
});

describe('BottomSheet — parent mode', () => {
  it('renders without crashing under parent mode', () => {
    render(
      withTheme(
        <BottomSheet visible onDismiss={() => undefined}>
          <Text>parent mode body</Text>
        </BottomSheet>,
        'parent',
      ),
    );
    expect(screen.getByText('parent mode body')).toBeTruthy();
  });
});
