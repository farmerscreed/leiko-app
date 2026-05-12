import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  TrendsAskAffordance,
  TRENDS_ASK_LABEL,
} from '../TrendsAskAffordance';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('TrendsAskAffordance', () => {
  it('renders the label', () => {
    render(
      withTheme(<TrendsAskAffordance onPress={() => undefined} testID="ask" />),
    );
    expect(screen.getByTestId('ask-label').props.children).toBe(
      TRENDS_ASK_LABEL,
    );
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      withTheme(<TrendsAskAffordance onPress={onPress} testID="ask" />),
    );
    fireEvent.press(screen.getByTestId('ask'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityRole="button" with the label', () => {
    render(
      withTheme(<TrendsAskAffordance onPress={() => undefined} testID="ask" />),
    );
    const node = screen.getByTestId('ask');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityLabel).toBe(TRENDS_ASK_LABEL);
  });

  it('label passes voice-lint', () => {
    expect(lintVoiceText(TRENDS_ASK_LABEL).passes).toBe(true);
  });
});
