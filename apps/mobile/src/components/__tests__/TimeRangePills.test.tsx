import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { TimeRangePills } from '../TimeRangePills';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('TimeRangePills', () => {
  it('renders three segments with the given selection', () => {
    render(
      withTheme(
        <TimeRangePills value="30d" onChange={() => undefined} testID="pills" />,
      ),
    );
    const seg30 = screen.getByTestId('pills-30d');
    expect(seg30.props.accessibilityState.selected).toBe(true);
    const seg7 = screen.getByTestId('pills-7d');
    expect(seg7.props.accessibilityState.selected).toBe(false);
  });

  it('emits onChange with the tapped range', () => {
    const onChange = jest.fn();
    render(
      withTheme(
        <TimeRangePills value="7d" onChange={onChange} testID="pills" />,
      ),
    );
    fireEvent.press(screen.getByTestId('pills-90d'));
    expect(onChange).toHaveBeenCalledWith('90d');
  });

  it('matches snapshot', () => {
    const { toJSON } = render(
      withTheme(
        <TimeRangePills value="7d" onChange={() => undefined} testID="pills" />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
