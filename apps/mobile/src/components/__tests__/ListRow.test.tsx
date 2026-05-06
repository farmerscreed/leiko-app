import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ListRow, type ListRowVariant } from '../ListRow';
import { ThemeProvider } from '../../theme';
import { palette } from '../../theme/tokens';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

describe('ListRow — variants render', () => {
  const variants: ListRowVariant[] = ['navigation', 'toggle', 'action', 'data', 'select'];

  it.each(variants)('renders the %s variant', (variant) => {
    render(
      withTheme(
        <ListRow
          variant={variant}
          title="Notifications"
          subtitle="Daily, weekly, anomaly"
          value={variant === 'data' ? '128/82 mmHg' : undefined}
          switchValue={false}
        />,
      ),
    );
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Daily, weekly, anomaly')).toBeTruthy();
  });
});

describe('ListRow — navigation', () => {
  it('exposes role=button and fires onPress', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <ListRow variant="navigation" title="Notifications" onPress={onPress} />,
      ),
    );
    const node = screen.getByRole('button', { name: 'Notifications' });
    expect(node).toBeTruthy();
    fireEvent.press(node);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a chevron glyph in the trailing slot', () => {
    render(
      withTheme(<ListRow variant="navigation" title="Notifications" />),
    );
    expect(screen.getByTestId('listrow-chevron')).toBeTruthy();
  });

  it('composes accessibilityLabel from title + subtitle', () => {
    render(
      withTheme(
        <ListRow
          variant="navigation"
          title="Notifications"
          subtitle="Daily, weekly, anomaly"
          onPress={() => undefined}
        />,
      ),
    );
    expect(
      screen.getByLabelText('Notifications, Daily, weekly, anomaly'),
    ).toBeTruthy();
  });
});

describe('ListRow — toggle', () => {
  it('reflects switchValue=true in the Switch accessibilityState', () => {
    render(
      withTheme(
        <ListRow
          variant="toggle"
          title="Large text mode"
          switchValue={true}
          onSwitchChange={() => undefined}
        />,
      ),
    );
    const node = screen.getByTestId('listrow-switch');
    expect(node.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('reflects switchValue=false in the Switch accessibilityState', () => {
    render(
      withTheme(
        <ListRow
          variant="toggle"
          title="Large text mode"
          switchValue={false}
          onSwitchChange={() => undefined}
        />,
      ),
    );
    const node = screen.getByTestId('listrow-switch');
    expect(node.props.accessibilityState).toMatchObject({ checked: false });
  });

  it('calls onSwitchChange when the platform switch toggles', () => {
    const onSwitchChange = jest.fn();
    render(
      withTheme(
        <ListRow
          variant="toggle"
          title="Large text mode"
          switchValue={false}
          onSwitchChange={onSwitchChange}
        />,
      ),
    );
    fireEvent(screen.getByTestId('listrow-switch'), 'valueChange', true);
    expect(onSwitchChange).toHaveBeenCalledWith(true);
  });
});

describe('ListRow — action', () => {
  it('exposes role=button', () => {
    render(
      withTheme(
        <ListRow variant="action" title="Sign out" onPress={() => undefined} />,
      ),
    );
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('renders the title in urgent color when destructive is set', () => {
    render(
      withTheme(
        <ListRow
          variant="action"
          title="Delete account"
          destructive
          onPress={() => undefined}
        />,
      ),
    );
    const titleNode = screen.getByText('Delete account');
    // Style may be a single object or an array — flatten and read color.
    const flat = Array.isArray(titleNode.props.style)
      ? Object.assign({}, ...titleNode.props.style)
      : titleNode.props.style;
    expect(flat.color).toBe(palette.crimson[700]);
  });

  it('uses primary text color for non-destructive action rows', () => {
    render(
      withTheme(
        <ListRow variant="action" title="Sign out" onPress={() => undefined} />,
      ),
    );
    const titleNode = screen.getByText('Sign out');
    const flat = Array.isArray(titleNode.props.style)
      ? Object.assign({}, ...titleNode.props.style)
      : titleNode.props.style;
    expect(flat.color).toBe(palette.text.primary);
  });
});

describe('ListRow — data', () => {
  it('has no accessibility role and renders the value in the trailing slot', () => {
    render(
      withTheme(<ListRow variant="data" title="Phone" value="+234 800 000 0000" />),
    );
    // No role=button, no role=switch.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    const valueNode = screen.getByTestId('listrow-value');
    expect(valueNode).toBeTruthy();
    expect(screen.getByText('+234 800 000 0000')).toBeTruthy();
  });

  it('appends value to accessibilityLabel for data rows', () => {
    render(
      withTheme(
        <ListRow
          variant="data"
          title="Last reading"
          subtitle="This morning"
          value="128/82 mmHg"
        />,
      ),
    );
    expect(
      screen.getByLabelText('Last reading, This morning, 128/82 mmHg'),
    ).toBeTruthy();
  });
});

describe('ListRow — select', () => {
  it('shows the check glyph when selected', () => {
    render(
      withTheme(
        <ListRow
          variant="select"
          title="English"
          selected
          onPress={() => undefined}
        />,
      ),
    );
    expect(screen.getByTestId('listrow-check')).toBeTruthy();
  });

  it('omits the check glyph when not selected', () => {
    render(
      withTheme(
        <ListRow
          variant="select"
          title="English"
          selected={false}
          onPress={() => undefined}
        />,
      ),
    );
    expect(screen.queryByTestId('listrow-check')).toBeNull();
  });

  it('exposes role=button with selected accessibilityState', () => {
    render(
      withTheme(
        <ListRow
          variant="select"
          title="English"
          selected
          onPress={() => undefined}
        />,
      ),
    );
    const node = screen.getByRole('button', { name: 'English' });
    expect(node.props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('ListRow — disabled', () => {
  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      withTheme(
        <ListRow
          variant="navigation"
          title="Notifications"
          onPress={onPress}
          disabled
        />,
      ),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ListRow — parent mode', () => {
  it('renders without crashing under parent mode (listRowMinHeight = 64)', () => {
    render(
      withTheme(
        <ListRow
          variant="navigation"
          title="Notifications"
          onPress={() => undefined}
        />,
        'parent',
      ),
    );
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });
});
