import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { DoctorCoverPreview } from '../DoctorCoverPreview';
import { ThemeProvider } from '../../theme';
import { lintVoiceText } from '../../services/voice/voiceLint';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

describe('DoctorCoverPreview', () => {
  it('renders the letterhead + title for self-buyer mode', () => {
    render(
      withTheme(
        <DoctorCoverPreview
          preparedFor="Adaeze Okeke"
          rangeLabel="30 days"
          datesLabel="Apr 12 – May 12, 2026"
          accountType="self_buyer"
          testID="cover"
        />,
      ),
    );
    expect(screen.getByTestId('cover-letterhead').props.children).toBe('Leiko');
    expect(screen.getByTestId('cover-title-line-1').props.children.join('')).toContain('For your');
    expect(screen.getByTestId('cover-title-line-2').props.children).toBe('doctor');
  });

  it("switches the possessive for caregiver mode", () => {
    render(
      withTheme(
        <DoctorCoverPreview
          preparedFor="Marian Okeke"
          rangeLabel="7 days"
          datesLabel="May 5 – May 12, 2026"
          accountType="caregiver"
          testID="cover"
        />,
      ),
    );
    expect(screen.getByTestId('cover-title-line-1').props.children.join('')).toContain('For her');
  });

  it('renders all 7 PDF sections', () => {
    render(
      withTheme(
        <DoctorCoverPreview
          preparedFor="Adaeze Okeke"
          rangeLabel="30 days"
          datesLabel="Apr 12 – May 12, 2026"
          accountType="self_buyer"
          testID="cover"
        />,
      ),
    );
    const sections = screen.getByTestId('cover-sections');
    // 7 sections per D13 §10.2.
    expect(sections.children.length).toBe(7);
  });

  it('shows the Plus-preview overlay for free users', () => {
    render(
      withTheme(
        <DoctorCoverPreview
          preparedFor="Adaeze"
          rangeLabel="7 days"
          datesLabel="May 5 – May 12, 2026"
          accountType="self_buyer"
          freeUser
          testID="cover"
        />,
      ),
    );
    expect(screen.getByTestId('cover-plus-overlay')).toBeTruthy();
  });

  it('disclaimer copy passes voice-lint', () => {
    render(
      withTheme(
        <DoctorCoverPreview
          preparedFor="Adaeze"
          rangeLabel="7 days"
          datesLabel="May 5 – May 12, 2026"
          accountType="self_buyer"
          testID="cover"
        />,
      ),
    );
    const disclaimer = String(
      screen.getByTestId('cover-disclaimer').props.children,
    );
    // The disclaimer mentions "diagnosis" (negated) — voice-lint
    // hard-fails on "diagnose" / "diagnosis". Strip the negation
    // before checking; the inflexion is a known IFU disclaimer
    // exception the spec licenses verbatim per D13 §10.2.
    const allowed = disclaimer.replace(/It is not a diagnosis\./, '');
    expect(lintVoiceText(allowed).passes).toBe(true);
  });
});
