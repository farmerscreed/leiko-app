import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button, type ButtonVariant } from '../Button';
import { ThemeProvider } from '../../theme';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

describe('Button — variants', () => {
  const variants: ButtonVariant[] = [
    'primary',
    'accent',
    'secondary',
    'ghost',
    'destructive',
  ];

  // CTA fixtures use verb + object phrasing per docs/05-voice-and-claims.md.
  // Bare "Continue" / "OK" / "Submit" are forbidden — even in test fixtures.
  it.each(variants)('renders the %s variant', (variant) => {
    render(withTheme(<Button variant={variant}>Pair watch</Button>));
    expect(screen.getByText('Pair watch')).toBeTruthy();
  });
});

describe('Button — accessibility', () => {
  it('exposes role=button with the children string as the accessibility label', () => {
    render(withTheme(<Button>Sign in</Button>));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('reflects disabled state in accessibilityState', () => {
    render(
      withTheme(
        <Button onPress={() => undefined} disabled>
          Add a family member
        </Button>,
      ),
    );
    const node = screen.getByRole('button', { name: 'Add a family member' });
    expect(node.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('reflects busy state in accessibilityState when loading', () => {
    render(
      withTheme(
        <Button onPress={() => undefined} loading>
          Sign in
        </Button>,
      ),
    );
    // Loading appends a state suffix to the label per docs/03-components/button.md.
    const node = screen.getByRole('button', { name: 'Sign in, button, loading' });
    expect(node.props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe('Button — interaction', () => {
  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    render(withTheme(<Button onPress={onPress}>Pair watch</Button>));
    fireEvent.press(screen.getByRole('button', { name: 'Pair watch' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <Button onPress={onPress} disabled>
          Pair watch
        </Button>,
      ),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Pair watch' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire onPress when loading', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <Button onPress={onPress} loading>
          Pair watch
        </Button>,
      ),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Pair watch, button, loading' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Button — loading state', () => {
  it('hides the label text — the children string is no longer queryable by getByText', () => {
    const { rerender } = render(withTheme(<Button>Sign in</Button>));
    // Sanity: label is rendered in the default state.
    expect(screen.getByText('Sign in')).toBeTruthy();

    rerender(withTheme(<Button loading>Sign in</Button>));
    // The label Text node is unmounted while the spinner stands in.
    expect(screen.queryByText('Sign in')).toBeNull();
  });
});

describe('Button — parent mode', () => {
  it('renders without crashing under parent mode', () => {
    render(withTheme(<Button onPress={() => undefined}>Pair watch</Button>, 'parent'));
    expect(screen.getByRole('button', { name: 'Pair watch' })).toBeTruthy();
  });
});
