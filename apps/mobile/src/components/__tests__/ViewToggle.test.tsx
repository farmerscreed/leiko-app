import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { ViewToggle } from '../ViewToggle';
import type { CaregiverViewMode } from '../../hooks/useCaregiverViewMode';

function withTheme(
  ui: ReactNode,
  colorMode: 'dark' | 'light' = 'dark',
  typeMode: 'caregiver' | 'parent' = 'caregiver',
) {
  return (
    <ThemeProvider mode={typeMode} colorMode={colorMode}>
      {ui}
    </ThemeProvider>
  );
}

describe('ViewToggle — labels', () => {
  it('renders both segment labels', () => {
    render(
      withTheme(<ViewToggle value="birds" onChange={() => undefined} />),
    );
    expect(screen.getByText("Bird's-eye")).toBeTruthy();
    expect(screen.getByText('Detailed')).toBeTruthy();
  });
});

describe('ViewToggle — active state', () => {
  it('marks the bird\'s-eye button selected when value="birds"', () => {
    render(
      withTheme(
        <ViewToggle
          value="birds"
          onChange={() => undefined}
          testID="toggle"
        />,
      ),
    );
    const birds = screen.getByTestId('toggle-birds');
    const cards = screen.getByTestId('toggle-cards');
    expect(birds.props.accessibilityState).toMatchObject({ selected: true });
    expect(cards.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('marks the detailed button selected when value="cards"', () => {
    render(
      withTheme(
        <ViewToggle
          value="cards"
          onChange={() => undefined}
          testID="toggle"
        />,
      ),
    );
    const birds = screen.getByTestId('toggle-birds');
    const cards = screen.getByTestId('toggle-cards');
    expect(birds.props.accessibilityState).toMatchObject({ selected: false });
    expect(cards.props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('ViewToggle — interaction', () => {
  it('fires onChange("cards") when the inactive detailed button is pressed', () => {
    const onChange = jest.fn();
    render(
      withTheme(
        <ViewToggle value="birds" onChange={onChange} testID="toggle" />,
      ),
    );
    fireEvent.press(screen.getByTestId('toggle-cards'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('cards');
  });

  it('fires onChange("birds") when the inactive bird\'s-eye button is pressed', () => {
    const onChange = jest.fn();
    render(
      withTheme(
        <ViewToggle value="cards" onChange={onChange} testID="toggle" />,
      ),
    );
    fireEvent.press(screen.getByTestId('toggle-birds'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('birds');
  });

  it('does NOT fire onChange when the already-active segment is pressed', () => {
    const onChange = jest.fn();
    render(
      withTheme(
        <ViewToggle value="birds" onChange={onChange} testID="toggle" />,
      ),
    );
    fireEvent.press(screen.getByTestId('toggle-birds'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ViewToggle — accessibility', () => {
  it('exposes radiogroup role on the outer pill', () => {
    render(
      withTheme(
        <ViewToggle
          value="birds"
          onChange={() => undefined}
          testID="toggle"
        />,
      ),
    );
    expect(screen.getByTestId('toggle').props.accessibilityRole).toBe(
      'radiogroup',
    );
  });

  it('uses descriptive accessibilityLabels on each segment', () => {
    render(
      withTheme(<ViewToggle value="birds" onChange={() => undefined} />),
    );
    expect(
      screen.getByRole('button', { name: "Bird's-eye view" }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Detailed view' }),
    ).toBeTruthy();
  });
});

describe('ViewToggle — value × colorMode snapshot matrix', () => {
  const matrix: Array<{
    value: CaregiverViewMode;
    colorMode: 'dark' | 'light';
  }> = [
    { value: 'birds', colorMode: 'dark' },
    { value: 'birds', colorMode: 'light' },
    { value: 'cards', colorMode: 'dark' },
    { value: 'cards', colorMode: 'light' },
  ];

  for (const { value, colorMode } of matrix) {
    it(`renders value=${value} colorMode=${colorMode}`, () => {
      const { toJSON } = render(
        withTheme(
          <ViewToggle
            value={value}
            onChange={() => undefined}
            testID="toggle"
          />,
          colorMode,
        ),
      );
      expect(toJSON()).toMatchSnapshot();
    });
  }
});
