import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AmbientPulse } from '../AmbientPulse';

describe('AmbientPulse — render', () => {
  it('renders children unchanged when inactive', () => {
    render(
      <AmbientPulse active={false} testID="pulse">
        <Text>Live HR</Text>
      </AmbientPulse>,
    );
    expect(screen.getByTestId('pulse')).toBeTruthy();
    expect(screen.getByText('Live HR')).toBeTruthy();
  });

  it('renders children when active', () => {
    render(
      <AmbientPulse active testID="pulse">
        <Text>Live HR</Text>
      </AmbientPulse>,
    );
    expect(screen.getByText('Live HR')).toBeTruthy();
  });

  it('accepts a bpm prop without crashing', () => {
    render(
      <AmbientPulse active bpm={72} testID="pulse">
        <Text>Live HR</Text>
      </AmbientPulse>,
    );
    expect(screen.getByTestId('pulse')).toBeTruthy();
  });

  it('clamps a frantic bpm without crashing', () => {
    render(
      <AmbientPulse active bpm={200} testID="pulse">
        <Text>Live HR</Text>
      </AmbientPulse>,
    );
    expect(screen.getByTestId('pulse')).toBeTruthy();
  });
});
