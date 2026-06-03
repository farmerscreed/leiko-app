// VitalHistoryScreen — full-window browse (ADR-0008 follow-up).
//
// The hook is mocked; these tests cover the pure day-grouping, the
// per-kind row time labels, and the screen's four states (loading /
// error / empty / data).

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import {
  VitalHistoryScreen,
  groupRowsByDay,
  rowTimeLabel,
} from '../VitalHistoryScreen';
import type { VitalHistoryRow } from '../../../services/vitalHistory';

let mockHistory: {
  rows: VitalHistoryRow[];
  totalCount: number | null;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
};

jest.mock('../../../hooks/useVitalHistory', () => ({
  useVitalHistory: () => mockHistory,
}));

function resetHistory() {
  mockHistory = {
    rows: [],
    totalCount: null,
    isLoading: false,
    isFetchingMore: false,
    error: null,
    hasMore: false,
    loadMore: () => undefined,
    refresh: async () => undefined,
  };
}
beforeEach(resetHistory);

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 720 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver" colorMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const PARAMS = {
  vital: 'bp' as const,
  range: '30d' as const,
  familyId: 'fam-1',
  timeZone: 'Africa/Lagos',
};

function renderScreen(goBack: () => void = () => undefined) {
  return render(
    withProviders(
      <VitalHistoryScreen
        navigation={{ goBack }}
        route={{ params: PARAMS }}
      />,
    ),
  );
}

function row(id: string, iso: string, value: string): VitalHistoryRow {
  return {
    id,
    measuredAtSec: Math.floor(Date.parse(iso) / 1000),
    value,
    detail: null,
  };
}

describe('groupRowsByDay', () => {
  it('groups by the wearer-local day, preserving newest-first order', () => {
    // 23:30 UTC on Jun 2 is already Jun 3 in Lagos (UTC+1) — the section
    // split must follow the wearer's calendar, not UTC.
    const rows = [
      row('a', '2026-06-02T23:30:00Z', '120/80'), // Lagos Jun 3
      row('b', '2026-06-02T12:00:00Z', '121/81'), // Lagos Jun 2
      row('c', '2026-06-02T08:00:00Z', '122/82'), // Lagos Jun 2
    ];
    const sections = groupRowsByDay(rows, 'Africa/Lagos');
    expect(sections.map((s) => s.key)).toEqual(['2026-06-03', '2026-06-02']);
    expect(sections[1].data.map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('rowTimeLabel', () => {
  const sec = Math.floor(Date.parse('2026-06-02T12:00:00Z') / 1000);
  it('clock time for bp/spo2, night for sleep, blank for activity', () => {
    expect(rowTimeLabel('bp', sec, 'Africa/Lagos')).toMatch(/1:00/);
    expect(rowTimeLabel('sleep', sec, 'Africa/Lagos')).toBe('night');
    expect(rowTimeLabel('activity', sec, 'Africa/Lagos')).toBe('');
  });
});

describe('VitalHistoryScreen states', () => {
  it('loading', () => {
    mockHistory.isLoading = true;
    renderScreen();
    expect(screen.getByTestId('vital-history-loading')).toBeTruthy();
  });

  it('error with retry', () => {
    mockHistory.error = new Error('boom');
    renderScreen();
    expect(screen.getByTestId('vital-history-error')).toBeTruthy();
  });

  it('empty state', () => {
    mockHistory.totalCount = 0;
    renderScreen();
    expect(screen.getByTestId('vital-history-empty')).toBeTruthy();
  });

  it('renders the true total, day sections, and rows', () => {
    mockHistory.rows = [
      row('a', '2026-06-02T12:00:00Z', '144/91'),
      row('b', '2026-06-01T09:00:00Z', '128/83'),
    ];
    mockHistory.totalCount = 92;
    renderScreen();
    expect(screen.getByTestId('vital-history-sub').props.children.join('')).toContain(
      '92 readings',
    );
    expect(screen.getByText('144/91')).toBeTruthy();
    expect(screen.getByText('128/83')).toBeTruthy();
  });

  it('back button calls goBack', () => {
    const goBack = jest.fn();
    mockHistory.totalCount = 0;
    renderScreen(goBack);
    fireEvent.press(screen.getByTestId('vital-history-back'));
    expect(goBack).toHaveBeenCalled();
  });
});
