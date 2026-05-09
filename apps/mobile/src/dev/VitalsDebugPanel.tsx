// Dev-only vitals debug panel — Sprint 7.5.
//
// Renders the live state of every Sprint 7.5 vital slice + the sync
// orchestrator. NOT a production UI surface — wrapped in `__DEV__` at
// the call site, mounted only inside ComponentGallery, never reachable
// from the user's nav stack.
//
// Per CLAUDE.md data rule: reading VALUES never appear in analytics
// events. This panel renders values to the device's own screen for
// developer eyeballing — that's distinct from telemetry leaving the
// device. Nothing here is sent anywhere.
//
// When Sprint 7.7 lands and the new vitals get a real production UI,
// this file can be deleted in one commit; nothing else imports from it.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { useReadings } from '../state/readings';
import { useHR } from '../state/hr';
import { useSpO2 } from '../state/spo2';
import { useSleep } from '../state/sleep';
import { useActivity } from '../state/activity';
import { useDailyPulseData } from '../state/dailyPulse';
import { useSyncOrchestrator } from '../state/syncOrchestrator';
import { usePairing } from '../state/pairing';
import { getVitalCursor, resetVitalCursors } from '../services/sync/syncBacklog';
import { peekRecent } from '../services/analytics/logger';

// Sync-related events worth showing on the timeline. Anything else
// from the analytics ring buffer is filtered out so the panel reads
// as a focused sync log.
const TIMELINE_EVENTS = new Set([
  'sync_started',
  'sync_completed',
  'sync_skipped',
  'sync_failed',
  'background_sync_registered',
  'background_sync_fired',
  'background_sync_unavailable',
  'device_config_flushed',
  'device_config_failed',
  'reading_sync_success',
  'reading_sync_failed',
  'ble_disconnected',
]);

function filterTimeline(
  events: Array<{ name: string; props: unknown; ts: number }>,
): Array<{ name: string; props: unknown; ts: number }> {
  return events
    .filter((e) => TIMELINE_EVENTS.has(e.name))
    .slice(-12)
    .reverse();
}

function summarizeProps(name: string, props: unknown): string {
  if (!props || typeof props !== 'object') return '';
  const p = props as Record<string, unknown>;
  if (name === 'sync_started') return String(p.trigger ?? '');
  if (name === 'sync_completed')
    return `pulled ${p.pulled ?? 0} · ${p.batches ?? 0} batches`;
  if (name === 'sync_skipped') return `${p.trigger ?? ''} → ${p.reason ?? ''}`;
  if (name === 'sync_failed') return `${p.trigger ?? ''} · ${p.reason ?? ''}`;
  if (name === 'background_sync_registered') return `every ${p.intervalMin ?? '?'}m`;
  if (name === 'background_sync_fired') return `result=${p.result ?? '?'}`;
  if (name === 'background_sync_unavailable') return String(p.reason ?? '');
  if (name === 'device_config_flushed') return `${p.steps ?? 0} steps`;
  if (name === 'device_config_failed') return String(p.failedStep ?? '');
  if (name === 'reading_sync_success') return p.duplicate ? 'dupe' : 'new';
  if (name === 'reading_sync_failed') return String(p.reason ?? '');
  if (name === 'ble_disconnected') return String(p.reason ?? '');
  return '';
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatRelative(ms: number | null): string {
  if (ms === null) return '—';
  const ageMs = Date.now() - ms;
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`;
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h ago`;
  return `${Math.floor(ageMs / 86_400_000)}d ago`;
}

function formatSec(sec: number | null | undefined): string {
  if (!sec) return '—';
  return formatRelative(sec * 1000);
}

export function VitalsDebugPanel() {
  const theme = useTheme();
  const paired = usePairing((s) => s.pairedDevice);
  const ortStatus = useSyncOrchestrator((s) => s.status);
  const ortLastSyncAt = useSyncOrchestrator((s) => s.lastSyncAt);
  const ortError = useSyncOrchestrator((s) => s.lastError);
  const runSync = useSyncOrchestrator((s) => s.runSync);

  const dp = useDailyPulseData();
  const bpPending = useReadings((s) => s.pending.length);
  const bpRecent = useReadings((s) => s.recent.length);
  const hrPending = useHR((s) => s.pending.length);
  const hrRecent = useHR((s) => s.recent.length);
  const spo2Pending = useSpO2((s) => s.pending.length);
  const spo2Recent = useSpO2((s) => s.recent.length);
  const sleepPending = useSleep((s) => s.pending.length);
  const sleepRecent = useSleep((s) => s.recent.length);
  const stepsPending = useActivity((s) => s.pendingSteps.length);
  const stepsRecent = useActivity((s) => s.recentSteps.length);
  const kcalPending = useActivity((s) => s.pendingCalories.length);
  const kcalRecent = useActivity((s) => s.recentCalories.length);

  const [busy, setBusy] = useState(false);
  const cursor = paired ? getVitalCursor(paired.bleId) : null;

  // Sync timeline — auto-refreshes from the analytics ring buffer
  // every 2s while the panel is mounted. Shows the last 12 sync-
  // adjacent events newest-first so the developer can verify
  // foreground / background / live-notify cadence.
  const [timeline, setTimeline] = useState<Array<{
    name: string;
    props: unknown;
    ts: number;
  }>>(() => filterTimeline(peekRecent(60)));
  useEffect(() => {
    const id = setInterval(() => {
      setTimeline(filterTimeline(peekRecent(60)));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const titleStyle: TextStyle = {
    fontSize: theme.type('title').size,
    lineHeight: theme.type('title').lineHeight,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.m,
    marginTop: theme.spacing.xxxl,
  };
  const labelStyle: TextStyle = {
    fontSize: theme.type('caption').size,
    lineHeight: theme.type('caption').lineHeight,
    color: theme.colors.text.secondary,
  };
  const valueStyle: TextStyle = {
    fontSize: theme.type('caption').size,
    lineHeight: theme.type('caption').lineHeight,
    color: theme.colors.text.primary,
  };
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  };
  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface.elevated,
    borderRadius: 12,
    padding: theme.spacing.l,
    marginBottom: theme.spacing.m,
  };
  const buttonStyle: ViewStyle = {
    backgroundColor: theme.colors.brand.primary,
    paddingVertical: theme.spacing.m,
    paddingHorizontal: theme.spacing.l,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: theme.spacing.m,
    opacity: busy ? 0.5 : 1,
  };

  return (
    <View>
      <Text style={titleStyle}>Vitals debug (Sprint 7.5)</Text>
      <Text style={[labelStyle, { marginBottom: theme.spacing.l }]}>
        Dev-only · not a production surface · zero rows = either watch is idle
        or auto-HR/SpO2 is off on the watch face
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={buttonStyle}
        onPress={async () => {
          setBusy(true);
          try {
            await runSync('manual_force');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text
          style={{
            color: theme.colors.text.onBrand,
            fontSize: theme.type('bodyL').size,
            fontWeight: '600',
          }}
        >
          {busy ? 'Syncing…' : 'Force sync now'}
        </Text>
      </Pressable>

      {/* Reset cursors → next sync re-pulls every vital from the start
          of the watch's stored history. Recovery path when MMKV ends up
          out of step with the watch (e.g. after uninstall + reinstall).
          Dev-only — never wired into production navigation. */}
      <Pressable
        accessibilityRole="button"
        disabled={busy || !paired}
        style={[
          buttonStyle,
          {
            backgroundColor: theme.colors.surface.warmElevated,
            borderWidth: 0.5,
            borderColor: theme.colors.border.rim,
            opacity: busy || !paired ? 0.5 : 1,
          },
        ]}
        onPress={async () => {
          if (!paired) return;
          setBusy(true);
          try {
            resetVitalCursors(paired.bleId);
            await runSync('manual_force');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.type('bodyL').size,
            fontWeight: '600',
          }}
        >
          Reset cursors + re-sync
        </Text>
      </Pressable>

      {/* Orchestrator + paired device + cursor */}
      <View style={cardStyle}>
        <View style={rowStyle}>
          <Text style={labelStyle}>Orchestrator</Text>
          <Text style={valueStyle}>{ortStatus}</Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>Last sync</Text>
          <Text style={valueStyle}>{formatRelative(ortLastSyncAt)}</Text>
        </View>
        {ortError ? (
          <View style={rowStyle}>
            <Text style={labelStyle}>Error</Text>
            <Text style={[valueStyle, { color: theme.colors.state.urgent }]}>
              {ortError}
            </Text>
          </View>
        ) : null}
        <View style={rowStyle}>
          <Text style={labelStyle}>Paired device</Text>
          <Text style={valueStyle}>
            {paired ? `${paired.name ?? 'unnamed'} (${paired.macSuffix})` : 'none'}
          </Text>
        </View>
        {cursor ? (
          <>
            <View style={rowStyle}>
              <Text style={labelStyle}>cursor.bp</Text>
              <Text style={valueStyle}>{cursor.bp || '0'}</Text>
            </View>
            <View style={rowStyle}>
              <Text style={labelStyle}>cursor.hr</Text>
              <Text style={valueStyle}>{cursor.hr || '0'}</Text>
            </View>
            <View style={rowStyle}>
              <Text style={labelStyle}>cursor.spo2</Text>
              <Text style={valueStyle}>{cursor.spo2 || '—'}</Text>
            </View>
            <View style={rowStyle}>
              <Text style={labelStyle}>cursor.sleep</Text>
              <Text style={valueStyle}>{cursor.sleep || '—'}</Text>
            </View>
            <View style={rowStyle}>
              <Text style={labelStyle}>cursor.activity</Text>
              <Text style={valueStyle}>{cursor.activity || '—'}</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Sync timeline — last 12 sync-adjacent events from the
          analytics ring buffer. Auto-refreshes every 2s. */}
      <Text style={[labelStyle, { marginBottom: theme.spacing.s }]}>Sync timeline</Text>
      <View style={cardStyle}>
        {timeline.length === 0 ? (
          <View style={rowStyle}>
            <Text style={[labelStyle, { color: theme.colors.text.tertiary }]}>
              No sync events yet — waiting for first trigger.
            </Text>
          </View>
        ) : (
          timeline.map((entry, idx) => (
            <View
              key={`${entry.ts}-${idx}`}
              style={[
                rowStyle,
                {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  paddingVertical: 6,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <Text style={[valueStyle, { flex: 1 }]}>{entry.name}</Text>
                <Text style={labelStyle}>{formatTime(entry.ts)}</Text>
              </View>
              {summarizeProps(entry.name, entry.props) ? (
                <Text
                  style={[
                    labelStyle,
                    { color: theme.colors.text.tertiary, marginTop: 2 },
                  ]}
                >
                  {summarizeProps(entry.name, entry.props)}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Per-vital sections */}
      <Text style={[labelStyle, { marginBottom: theme.spacing.s }]}>BP</Text>
      <View style={cardStyle}>
        <View style={rowStyle}>
          <Text style={labelStyle}>pending / recent</Text>
          <Text style={valueStyle}>
            {bpPending} / {bpRecent}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>latest</Text>
          <Text style={valueStyle}>
            {dp.bp.latest
              ? `${dp.bp.latest.systolic}/${dp.bp.latest.diastolic}` +
                (dp.bp.latest.pulse ? ` p${dp.bp.latest.pulse}` : '')
              : '—'}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>tier</Text>
          <Text style={valueStyle}>{dp.bp.classification?.tier ?? '—'}</Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>staleness</Text>
          <Text style={valueStyle}>{dp.bp.staleness}</Text>
        </View>
      </View>

      <Text style={[labelStyle, { marginBottom: theme.spacing.s }]}>HR</Text>
      <View style={cardStyle}>
        <View style={rowStyle}>
          <Text style={labelStyle}>pending / recent</Text>
          <Text style={valueStyle}>
            {hrPending} / {hrRecent}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>resting today</Text>
          <Text style={valueStyle}>
            {dp.hr.restingToday !== null
              ? `${Math.round(dp.hr.restingToday)} bpm`
              : '—'}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>tier</Text>
          <Text style={valueStyle}>{dp.hr.classification?.tier ?? '—'}</Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>staleness</Text>
          <Text style={valueStyle}>{dp.hr.staleness}</Text>
        </View>
      </View>

      <Text style={[labelStyle, { marginBottom: theme.spacing.s }]}>SpO2</Text>
      <View style={cardStyle}>
        <View style={rowStyle}>
          <Text style={labelStyle}>pending / recent</Text>
          <Text style={valueStyle}>
            {spo2Pending} / {spo2Recent}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>latest %</Text>
          <Text style={valueStyle}>
            {dp.spo2.latestPercent !== null ? `${dp.spo2.latestPercent}%` : '—'}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>overnight lows (n)</Text>
          <Text style={valueStyle}>{dp.spo2.overnightLowsRecent.length}</Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>tier</Text>
          <Text style={valueStyle}>{dp.spo2.classification?.tier ?? '—'}</Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>staleness</Text>
          <Text style={valueStyle}>{dp.spo2.staleness}</Text>
        </View>
      </View>

      <Text style={[labelStyle, { marginBottom: theme.spacing.s }]}>Sleep</Text>
      <View style={cardStyle}>
        <View style={rowStyle}>
          <Text style={labelStyle}>pending / recent</Text>
          <Text style={valueStyle}>
            {sleepPending} / {sleepRecent}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>last session total</Text>
          <Text style={valueStyle}>
            {dp.sleep.session
              ? `${Math.floor(dp.sleep.session.totalMinutes / 60)}h ${dp.sleep.session.totalMinutes % 60}m`
              : '—'}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>last session ended</Text>
          <Text style={valueStyle}>{formatSec(dp.sleep.session?.sessionEndSec)}</Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>score / tier</Text>
          <Text style={valueStyle}>
            {dp.sleep.classification
              ? `${dp.sleep.classification.sleepScore} · ${dp.sleep.classification.tier}`
              : '—'}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>staleness</Text>
          <Text style={valueStyle}>{dp.sleep.staleness}</Text>
        </View>
      </View>

      <Text style={[labelStyle, { marginBottom: theme.spacing.s }]}>Activity</Text>
      <View style={cardStyle}>
        <View style={rowStyle}>
          <Text style={labelStyle}>steps pending / recent</Text>
          <Text style={valueStyle}>
            {stepsPending} / {stepsRecent}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>kcal pending / recent</Text>
          <Text style={valueStyle}>
            {kcalPending} / {kcalRecent}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>steps today / target</Text>
          <Text style={valueStyle}>
            {dp.activity.stepsToday} / {dp.activity.targetSteps}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>tier</Text>
          <Text style={valueStyle}>
            {dp.activity.classification
              ? `${dp.activity.classification.tier} · ${(dp.activity.classification.percentOfTarget * 100).toFixed(0)}%`
              : '—'}
          </Text>
        </View>
        <View style={rowStyle}>
          <Text style={labelStyle}>staleness</Text>
          <Text style={valueStyle}>{dp.activity.staleness}</Text>
        </View>
      </View>
    </View>
  );
}

// Suppress unused-style warnings if RN ever adds StyleSheet validation.
const _styles = StyleSheet.create({});
void _styles;
