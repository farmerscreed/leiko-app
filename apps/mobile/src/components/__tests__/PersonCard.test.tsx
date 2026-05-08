import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { PersonCard, type PersonCardProps } from '../PersonCard';
import type { Status } from '../StatusPill';

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

// Three test personas drawn from the design's PersonPage fixture cast.
const MOM: PersonCardProps = {
  accent: ACCENT_CORAL,
  initial: 'M',
  fullName: 'Marian Okeke',
  relation: 'Mom',
  age: 71,
  status: 'clear',
  headline: 'A calm morning.',
  sentence: 'BP 122/78 a moment ago. Inside her usual band.',
  vitalStrip: { bp: '122/78', hr: '64', spo2: '98%', sleep: '7:42' },
  footerLeftLabel: 'Read · 6:42 am',
};

const DAD: PersonCardProps = {
  accent: ACCENT_AMBER,
  initial: 'E',
  fullName: 'Emeka Okeke',
  relation: 'Dad',
  age: 74,
  status: 'attention',
  headline: 'BP is trending up.',
  sentence: 'BP 138/89 — a little above the usual band.',
  vitalStrip: { bp: '138/89', hr: '72', spo2: '96%', sleep: '6:18' },
  footerLeftLabel: 'Read · 7:08 am',
};

const AUNT: PersonCardProps = {
  accent: ACCENT_PERIWINKLE,
  initial: 'J',
  fullName: 'Joy Adeyemi',
  relation: 'Aunt',
  age: 68,
  status: 'sleeping',
  headline: 'Resting quietly.',
  sentence: 'Asleep since 11 pm. Twenty-one percent deep so far.',
  vitalStrip: { bp: '118/74', hr: '58', spo2: '97%', sleep: 'now' },
  footerLeftLabel: 'Last reading · now',
};

describe('PersonCard — render', () => {
  it('renders name, relation, headline, sentence, and all four vital labels', () => {
    render(withTheme(<PersonCard {...MOM} testID="card" />));
    // Header
    expect(screen.getByText('Marian Okeke')).toBeTruthy();
    // Headline (rendered with curly quotes)
    expect(screen.getByText('“A calm morning.”')).toBeTruthy();
    // Sentence
    expect(
      screen.getByText('BP 122/78 a moment ago. Inside her usual band.'),
    ).toBeTruthy();
    // Vital labels — all four uppercased
    expect(screen.getByText('BP')).toBeTruthy();
    expect(screen.getByText('HR')).toBeTruthy();
    expect(screen.getByText('SPO₂')).toBeTruthy();
    expect(screen.getByText('SLEEP')).toBeTruthy();
    // Vital values
    expect(screen.getByText('122/78')).toBeTruthy();
    expect(screen.getByText('64')).toBeTruthy();
    expect(screen.getByText('98%')).toBeTruthy();
    expect(screen.getByText('7:42')).toBeTruthy();
    // Footer
    expect(screen.getByText('Read · 6:42 am')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
  });
});

describe('PersonCard — eyebrow age rendering', () => {
  it('includes " · {age}" when age is provided', () => {
    render(withTheme(<PersonCard {...MOM} testID="card" />));
    expect(screen.getByText('MOM · 71')).toBeTruthy();
  });

  it('omits the " · {age}" segment when age is absent', () => {
    const { age: _age, ...momWithoutAge } = MOM;
    void _age;
    render(withTheme(<PersonCard {...momWithoutAge} testID="card" />));
    expect(screen.getByText('MOM')).toBeTruthy();
    expect(screen.queryByText('MOM · 71')).toBeNull();
  });
});

describe('PersonCard — accessibility', () => {
  it('humanises status="urgent" to "Urgent" inside the composed label', () => {
    const urgentDad: PersonCardProps = { ...DAD, status: 'urgent' };
    render(withTheme(<PersonCard {...urgentDad} testID="card" />));
    const node = screen.getByTestId('card');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityLabel).toContain('Urgent');
    expect(node.props.accessibilityLabel.startsWith('Emeka')).toBe(true);
  });
});

describe('PersonCard — interaction', () => {
  it('fires onPress when the card is tapped', () => {
    const onPress = jest.fn();
    render(
      withTheme(<PersonCard {...MOM} onPress={onPress} testID="card" />),
    );
    fireEvent.press(screen.getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('PersonCard — sleeping opacity', () => {
  it('drops opacity to 0.92 when status="sleeping"', () => {
    render(withTheme(<PersonCard {...AUNT} testID="card" />));
    const node = screen.getByTestId('card');
    // The Pressable's style is an array (cardStyle, style). RN-test-renderer
    // returns the style array on the host node's props.style.
    const styleProp = node.props.style;
    const flat = Array.isArray(styleProp)
      ? styleProp.reduce(
          (acc: Record<string, unknown>, s: unknown) =>
            s && typeof s === 'object' ? { ...acc, ...(s as object) } : acc,
          {},
        )
      : (styleProp ?? {});
    expect((flat as { opacity?: number }).opacity).toBe(0.92);
  });

  it('keeps opacity at 1 when status is not sleeping', () => {
    render(withTheme(<PersonCard {...MOM} testID="card" />));
    const node = screen.getByTestId('card');
    const styleProp = node.props.style;
    const flat = Array.isArray(styleProp)
      ? styleProp.reduce(
          (acc: Record<string, unknown>, s: unknown) =>
            s && typeof s === 'object' ? { ...acc, ...(s as object) } : acc,
          {},
        )
      : (styleProp ?? {});
    expect((flat as { opacity?: number }).opacity).toBe(1);
  });
});

describe('PersonCard — status × mode snapshot matrix', () => {
  const STATUSES: Status[] = [
    'clear',
    'watch',
    'attention',
    'urgent',
    'offline',
    'sleeping',
  ];
  const modes: Array<'dark' | 'light'> = ['dark', 'light'];

  for (const mode of modes) {
    for (const status of STATUSES) {
      it(`renders status=${status} mode=${mode}`, () => {
        const { toJSON } = render(
          withTheme(
            <PersonCard {...MOM} status={status} testID="card" />,
            mode,
          ),
        );
        expect(toJSON()).toMatchSnapshot();
      });
    }
  }
});
