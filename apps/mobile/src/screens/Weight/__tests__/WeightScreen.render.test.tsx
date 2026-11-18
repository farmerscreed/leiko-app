const mockInvoke: jest.Mock = jest.fn().mockResolvedValue({ data: { inserted: 1, duplicates: 0, rejected: [] }, error: null });
jest.mock('../../../services/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) }),
    }),
  },
}));
jest.mock('../../../services/users/updateProfile', () => ({ updateProfile: jest.fn().mockResolvedValue({}) }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { useAuth } from '../../../state/auth';
import { useWeight } from '../../../state/weight';
import { mmkv } from '../../../services/storage';
import { WeightScreen, WEIGHT_RANGE_ERROR } from '../WeightScreen';

const nav = { goBack: jest.fn() } as unknown as Parameters<typeof WeightScreen>[0]['navigation'];
const route = { key: 'w', name: 'Weight' } as unknown as Parameters<typeof WeightScreen>[0]['route'];

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <WeightScreen navigation={nav} route={route} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mmkv.clearAll();
  useWeight.getState().reset();
  useAuth.setState({ profile: { id: 'u1', timezone: 'Africa/Lagos', weight_kg: 115, weight_target_kg: null } as never });
});

describe('WeightScreen', () => {
  it('shows the empty prompt, then the logged weight', async () => {
    renderScreen();
    expect(screen.getByTestId('weight-empty')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('weight-input'), '114.5');
    fireEvent.press(screen.getByTestId('weight-save'));
    await waitFor(() => expect(screen.getByTestId('weight-latest')).toBeTruthy());
    expect(screen.getAllByText('114.5 kg').length).toBe(2); // hero + recent list
    expect(screen.getByText('No target set')).toBeTruthy();
  });

  it('explains an out-of-range entry', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('weight-input'), '5');
    fireEvent.press(screen.getByTestId('weight-save'));
    expect(await screen.findByText(WEIGHT_RANGE_ERROR)).toBeTruthy();
  });
});
