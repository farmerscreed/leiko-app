// Smoke test: proves the "rn" jest-projects entry (jest-expo + RNTL +
// react-test-renderer) is wired correctly. If this fails, no other
// component test under src/components/ will run. Delete once the first
// real component test (Pill, Card, …) replaces it.

import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

describe('jest-expo + RNTL smoke', () => {
  it('renders a react-native Text node', () => {
    const { getByText } = render(<Text>hello</Text>);
    expect(getByText('hello')).toBeTruthy();
  });
});
