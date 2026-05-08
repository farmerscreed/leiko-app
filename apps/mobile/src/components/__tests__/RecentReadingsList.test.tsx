import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { RecentReadingsList, type RecentReading } from '../RecentReadingsList';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

const ROWS: RecentReading[] = [
  { id: 'r1', value: '122/78', context: 'Just now · resting', time: '6:42 am' },
  { id: 'r2', value: '124/79', context: 'Yesterday morning', time: 'Mon' },
];

describe('RecentReadingsList', () => {
  it('renders a row per reading', () => {
    render(
      withTheme(
        <RecentReadingsList vital="bp" readings={ROWS} testID="list" />,
      ),
    );
    expect(screen.getByText('122/78')).toBeTruthy();
    expect(screen.getByText('124/79')).toBeTruthy();
    expect(screen.getByText('Just now · resting')).toBeTruthy();
  });

  it('renders the calm empty state when there are no readings', () => {
    render(
      withTheme(
        <RecentReadingsList vital="bp" readings={[]} testID="list" />,
      ),
    );
    expect(screen.getByTestId('list-empty')).toBeTruthy();
    expect(
      screen.getByText('Recent readings will land here as they come in.'),
    ).toBeTruthy();
  });

  it('fires onSelect with the tapped row', () => {
    const onSelect = jest.fn();
    render(
      withTheme(
        <RecentReadingsList
          vital="bp"
          readings={ROWS}
          onSelect={onSelect}
          testID="list"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('list-row-r1'));
    expect(onSelect).toHaveBeenCalledWith(ROWS[0]);
  });

  it('matches snapshot when populated', () => {
    const { toJSON } = render(
      withTheme(
        <RecentReadingsList vital="bp" readings={ROWS} testID="list" />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
