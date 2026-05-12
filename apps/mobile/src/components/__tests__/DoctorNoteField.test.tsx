import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  DoctorNoteField,
  DOCTOR_NOTE_EYEBROW,
  doctorNotePlaceholder,
} from '../DoctorNoteField';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('DoctorNoteField', () => {
  it('renders eyebrow + placeholder for self-buyer', () => {
    render(
      withTheme(
        <DoctorNoteField
          value=""
          onChange={() => undefined}
          accountType="self_buyer"
          testID="note"
        />,
      ),
    );
    expect(screen.getByTestId('note-eyebrow').props.children).toBe(
      DOCTOR_NOTE_EYEBROW,
    );
    expect(screen.getByTestId('note-input').props.placeholder).toBe(
      doctorNotePlaceholder('self_buyer'),
    );
  });

  it('flips placeholder for caregiver mode', () => {
    render(
      withTheme(
        <DoctorNoteField
          value=""
          onChange={() => undefined}
          accountType="caregiver"
          testID="note"
        />,
      ),
    );
    expect(screen.getByTestId('note-input').props.placeholder).toBe(
      doctorNotePlaceholder('caregiver'),
    );
  });

  it('fires onChange when the user types', () => {
    const onChange = jest.fn();
    render(
      withTheme(
        <DoctorNoteField
          value=""
          onChange={onChange}
          accountType="self_buyer"
          testID="note"
        />,
      ),
    );
    fireEvent.changeText(screen.getByTestId('note-input'), 'My fasting numbers');
    expect(onChange).toHaveBeenCalledWith('My fasting numbers');
  });

  it('eyebrow + both placeholders pass voice-lint', () => {
    expect(lintVoiceText(DOCTOR_NOTE_EYEBROW).passes).toBe(true);
    expect(lintVoiceText(doctorNotePlaceholder('self_buyer')).passes).toBe(true);
    expect(lintVoiceText(doctorNotePlaceholder('caregiver')).passes).toBe(true);
  });
});
