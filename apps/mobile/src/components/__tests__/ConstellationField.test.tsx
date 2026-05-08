import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import {
  ConstellationField,
  type ConstellationPerson,
} from '../ConstellationField';

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

const PEOPLE: ConstellationPerson[] = [
  {
    id: 'mom',
    initial: 'M',
    fullName: 'Marian Okeke',
    accent: '#FF7350',
    status: 'clear',
    bpLabel: '122/78',
  },
  {
    id: 'dad',
    initial: 'E',
    fullName: 'Emeka Okeke',
    accent: '#F2A618',
    status: 'attention',
    bpLabel: '138/89',
  },
  {
    id: 'aunt',
    initial: 'J',
    fullName: 'Joy Adeyemi',
    accent: '#7B67CC',
    status: 'sleeping',
    bpLabel: '118/74',
  },
];

describe('ConstellationField — canvas', () => {
  it('renders the 360x360 field with the centre "You" label', () => {
    render(withTheme(<ConstellationField people={PEOPLE} testID="field" />));
    expect(screen.getByTestId('field')).toBeTruthy();
    expect(screen.getByTestId('field-svg')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
  });
});

describe('ConstellationField — three-person fixture', () => {
  it('renders each person\'s first name + BP label', () => {
    render(withTheme(<ConstellationField people={PEOPLE} testID="field" />));
    // First name only (PersonOrb splits on the first space).
    expect(screen.getByText('Marian')).toBeTruthy();
    expect(screen.getByText('Emeka')).toBeTruthy();
    expect(screen.getByText('Joy')).toBeTruthy();
    expect(screen.getByText('122/78')).toBeTruthy();
    expect(screen.getByText('138/89')).toBeTruthy();
    expect(screen.getByText('118/74')).toBeTruthy();
  });

  it('mounts one orb wrapper per person', () => {
    render(withTheme(<ConstellationField people={PEOPLE} testID="field" />));
    expect(screen.getByTestId('field-orb-mom')).toBeTruthy();
    expect(screen.getByTestId('field-orb-dad')).toBeTruthy();
    expect(screen.getByTestId('field-orb-aunt')).toBeTruthy();
  });
});

describe('ConstellationField — fewer-than-three fallbacks', () => {
  it('renders nothing-but-the-canvas with an empty people list', () => {
    render(withTheme(<ConstellationField people={[]} testID="field" />));
    expect(screen.getByTestId('field')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.queryByText('Marian')).toBeNull();
  });

  it('renders only the supplied person when one is given', () => {
    render(
      withTheme(
        <ConstellationField people={[PEOPLE[0]]} testID="field" />,
      ),
    );
    expect(screen.getByText('Marian')).toBeTruthy();
    expect(screen.queryByText('Emeka')).toBeNull();
    expect(screen.queryByText('Joy')).toBeNull();
  });

  it('renders only the supplied two when two are given', () => {
    render(
      withTheme(
        <ConstellationField people={[PEOPLE[0], PEOPLE[1]]} testID="field" />,
      ),
    );
    expect(screen.getByText('Marian')).toBeTruthy();
    expect(screen.getByText('Emeka')).toBeTruthy();
    expect(screen.queryByText('Joy')).toBeNull();
  });
});

describe('ConstellationField — clamp at three', () => {
  it('renders only the first three and warns once when more are passed', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fourth: ConstellationPerson = {
      id: 'cousin',
      initial: 'A',
      fullName: 'Ada Nwosu',
      accent: '#FF7350',
      status: 'clear',
      bpLabel: '120/80',
    };
    render(
      withTheme(
        <ConstellationField
          people={[...PEOPLE, fourth]}
          testID="field"
        />,
      ),
    );
    expect(screen.getByText('Marian')).toBeTruthy();
    expect(screen.getByText('Emeka')).toBeTruthy();
    expect(screen.getByText('Joy')).toBeTruthy();
    expect(screen.queryByText('Ada')).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/ConstellationField/);
    warnSpy.mockRestore();
  });
});

describe('ConstellationField — interaction', () => {
  it('fires onSelectPerson with the tapped person\'s id', () => {
    const onSelectPerson = jest.fn();
    render(
      withTheme(
        <ConstellationField
          people={PEOPLE}
          onSelectPerson={onSelectPerson}
          testID="field"
        />,
      ),
    );
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Emeka, Needs attention, blood pressure 138/89',
      }),
    );
    expect(onSelectPerson).toHaveBeenCalledTimes(1);
    expect(onSelectPerson).toHaveBeenCalledWith('dad');

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Marian, All clear, blood pressure 122/78',
      }),
    );
    expect(onSelectPerson).toHaveBeenCalledTimes(2);
    expect(onSelectPerson).toHaveBeenLastCalledWith('mom');

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Joy, Sleeping, blood pressure 118/74',
      }),
    );
    expect(onSelectPerson).toHaveBeenCalledTimes(3);
    expect(onSelectPerson).toHaveBeenLastCalledWith('aunt');
  });
});

describe('ConstellationField — snapshot per colorMode', () => {
  const modes: Array<'dark' | 'light'> = ['dark', 'light'];
  for (const mode of modes) {
    it(`renders three-person fixture in mode=${mode}`, () => {
      const { toJSON } = render(
        withTheme(
          <ConstellationField people={PEOPLE} testID="field" />,
          mode,
        ),
      );
      expect(toJSON()).toMatchSnapshot();
    });
  }
});
