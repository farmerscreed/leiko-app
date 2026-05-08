import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { Portrait, type PortraitSize } from '../Portrait';

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

const ACCENT_CORAL = '#FF7350';
const ACCENT_AMBER = '#F2A618';
const ACCENT_PERIWINKLE = '#7B67CC';

describe('Portrait — render', () => {
  it('renders the initial', () => {
    render(
      withTheme(
        <Portrait initial="M" accent={ACCENT_CORAL} testID="portrait" />,
      ),
    );
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByTestId('portrait')).toBeTruthy();
  });

  it('exposes no accessibility role or label (consumer composes the full label)', () => {
    render(
      withTheme(
        <Portrait initial="M" accent={ACCENT_CORAL} testID="portrait" />,
      ),
    );
    const node = screen.getByTestId('portrait');
    expect(node.props.accessibilityRole).toBeUndefined();
    expect(node.props.accessibilityLabel).toBeUndefined();
  });
});

describe('Portrait — size × accent snapshot matrix', () => {
  const sizes: PortraitSize[] = ['sm', 'md', 'lg'];
  const accents = [
    { name: 'coral', hex: ACCENT_CORAL },
    { name: 'amber', hex: ACCENT_AMBER },
    { name: 'periwinkle', hex: ACCENT_PERIWINKLE },
  ];

  for (const size of sizes) {
    for (const a of accents) {
      it(`renders size=${size} accent=${a.name}`, () => {
        const { toJSON } = render(
          withTheme(
            <Portrait
              initial="J"
              accent={a.hex}
              size={size}
              testID="portrait"
            />,
          ),
        );
        expect(toJSON()).toMatchSnapshot();
      });
    }
  }
});
