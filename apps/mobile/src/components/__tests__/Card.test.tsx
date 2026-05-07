import { type ReactNode } from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Card } from '../Card';
import { ThemeProvider } from '../../theme';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

describe('Card — elevation variants', () => {
  const elevations = ['default', 'low', 'medium', 'high', 'glass'] as const;

  it.each(elevations)('renders the %s elevation variant', (elevation) => {
    render(
      withTheme(
        <Card elevation={elevation} testID="card">
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByText("Mum's reading")).toBeTruthy();
  });
});

describe('Card — accessibility', () => {
  it('does not set accessibilityRole on a static card', () => {
    render(
      withTheme(
        <Card testID="card">
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    const node = screen.getByTestId('card');
    expect(node.props.accessibilityRole).toBeUndefined();
  });

  it('sets accessibilityRole="button" and accessibilityLabel on a tappable card', () => {
    render(
      withTheme(
        <Card
          onPress={() => undefined}
          accessibilityLabel="Mum's reading card, opens reading detail"
        >
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    expect(
      screen.getByRole('button', { name: "Mum's reading card, opens reading detail" }),
    ).toBeTruthy();
  });

  it('warns in development when a tappable card has no accessibilityLabel', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      withTheme(
        <Card onPress={() => undefined}>
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('Card — interaction', () => {
  it('fires onPress when a tappable card is pressed', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <Card onPress={onPress} accessibilityLabel="Mum's reading card">
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    fireEvent.press(screen.getByRole('button', { name: "Mum's reading card" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <Card onPress={onPress} disabled accessibilityLabel="Mum's reading card">
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    fireEvent.press(screen.getByRole('button', { name: "Mum's reading card" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reflects disabled state in accessibilityState', () => {
    render(
      withTheme(
        <Card
          onPress={() => undefined}
          disabled
          accessibilityLabel="Mum's reading card"
        >
          <Text>Mum's reading</Text>
        </Card>,
      ),
    );
    const node = screen.getByRole('button', { name: "Mum's reading card" });
    expect(node.props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('Card — parent mode', () => {
  it('renders without crashing under parent mode', () => {
    render(
      withTheme(
        <Card onPress={() => undefined} accessibilityLabel="Mum's reading card">
          <Text>Mum's reading</Text>
        </Card>,
        'parent',
      ),
    );
    expect(screen.getByRole('button', { name: "Mum's reading card" })).toBeTruthy();
  });
});
