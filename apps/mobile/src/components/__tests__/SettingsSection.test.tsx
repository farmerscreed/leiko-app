import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme';
import { SettingsSection } from '../SettingsSection';

function withTheme(node: React.ReactNode) {
  return <ThemeProvider mode="caregiver">{node}</ThemeProvider>;
}

describe('<SettingsSection />', () => {
  it('renders the title and the children', () => {
    render(
      withTheme(
        <SettingsSection title="Profile" testID="section-profile">
          <Text>Display name</Text>
        </SettingsSection>,
      ),
    );
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Display name')).toBeTruthy();
    expect(screen.getByTestId('section-profile')).toBeTruthy();
  });

  it('exposes the title as a screen-reader header', () => {
    render(
      withTheme(
        <SettingsSection title="Notifications">
          <Text>Daily summary</Text>
        </SettingsSection>,
      ),
    );
    // The header view wraps the title; test that it carries the role.
    const header = screen.getByText('Notifications').parent;
    // accessibilityRole is on the parent View per the component's anatomy.
    expect(header?.parent?.props.accessibilityRole).toBe('header');
  });
});
