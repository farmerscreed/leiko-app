// WeightScreen — weight log + target (2026-11-18).
//
// Log today's weight, see the recent trend, set a target. Weight sits
// next to BP because it's one of the things that moves it most; this
// screen just records it — it makes no claims about what a change will
// do (docs/05-voice-and-claims.md).
//
// Data: state/weight.ts (MMKV first, then /sync-external-vitals as
// 'leiko_manual'). Weights from a scale via Apple Health / Health
// Connect show here too once loaded from the server. kg only for now.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Sparkline } from '../../components/Sparkline';
import { useTheme } from '../../theme';
import { useAuth } from '../../state/auth';
import {
  isValidWeightKg,
  useWeight,
  weightChangeOver,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  type WeightEntry,
} from '../../state/weight';
import { monthDayInZone } from '../../utils/timeInZone';
import type { SelfBuyerScreenProps } from '../../navigation/types';

export const WEIGHT_RANGE_ERROR = `Enter a weight between ${WEIGHT_KG_MIN} and ${WEIGHT_KG_MAX} kg.`;

export function parseKg(text: string): number | null {
  const v = Number(text.replace(',', '.').trim());
  return Number.isFinite(v) && text.trim() !== '' ? v : null;
}

function fmtKg(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

export function changeLabel(delta: number | null, days: number): string | null {
  if (delta === null) return null;
  if (delta === 0) return `No change in ${days} days`;
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta).toFixed(1)} kg in ${days} days`;
}

export function targetLabel(latestKg: number | null, targetKg: number | null): string {
  if (targetKg === null || targetKg === undefined) return 'No target set';
  if (latestKg === null) return `Target ${fmtKg(targetKg)}`;
  const gap = Math.round((latestKg - targetKg) * 10) / 10;
  if (Math.abs(gap) < 0.1) return `Target ${fmtKg(targetKg)} · you're there`;
  return `Target ${fmtKg(targetKg)} · ${Math.abs(gap).toFixed(1)} kg from it`;
}

function sourceLabel(e: WeightEntry): string {
  return e.source === 'leiko_manual' ? 'Logged in Leiko' : 'From your scale';
}

type Props = SelfBuyerScreenProps<'Weight'>;

export function WeightScreen({ navigation }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const profile = useAuth((s) => s.profile);
  const tz = profile?.timezone ?? null;
  const pending = useWeight((s) => s.pending);
  const recent = useWeight((s) => s.recent);
  const addEntry = useWeight((s) => s.addEntry);
  const setTarget = useWeight((s) => s.setTarget);
  const [input, setInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void useWeight.getState().flush();
    void useWeight.getState().loadFromServer();
  }, []);

  const entries = useMemo(() => useWeight.getState().all(), [pending, recent]);
  const latest = entries[0] ?? null;
  const nowSec = Math.floor(Date.now() / 1000);
  const change = changeLabel(weightChangeOver(entries, 30, nowSec), 30);
  const target = profile?.weight_target_kg ?? null;
  const trend = entries.slice(0, 30).reverse().map((e) => e.kg);

  const h = theme.type('headline');
  const body = theme.type('bodyM');
  const cap = theme.type('caption');
  const big = theme.type('numericXl');
  const label = theme.type('labelUppercase');

  const onSave = async () => {
    const kg = parseKg(input);
    if (kg === null || !isValidWeightKg(kg)) {
      setError(WEIGHT_RANGE_ERROR);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addEntry(kg);
      setInput('');
    } finally {
      setSaving(false);
    }
  };

  const onSaveTarget = async (clear = false) => {
    const kg = clear ? null : parseKg(targetInput);
    if (!clear && (kg === null || !isValidWeightKg(kg))) {
      setError(WEIGHT_RANGE_ERROR);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setTarget(kg);
      setEditingTarget(false);
      setTargetInput('');
    } catch {
      setError("We couldn't save the target. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radii.m,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    color: theme.colors.text.primary,
    fontSize: body.size,
    fontFamily: body.family,
    flex: 1,
  } as const;
  const sectionLabel = {
    fontFamily: label.family,
    fontSize: label.size,
    letterSpacing: label.letterSpacing,
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase' as const,
    marginBottom: theme.spacing.s,
    marginTop: theme.spacing.xl,
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]} edges={['top', 'bottom']} testID="weight-screen">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.l }}
          testID="weight-back"
        >
          <Text style={{ color: theme.colors.brand.primary, fontSize: body.size, fontFamily: body.family, fontWeight: '500' }}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ color: theme.colors.text.primary, fontSize: h.size, lineHeight: h.lineHeight, fontFamily: h.family, fontWeight: h.weight as '700' }}>
          Weight
        </Text>

        {latest ? (
          <View style={{ marginTop: theme.spacing.l }} testID="weight-latest">
            <Text style={{ fontFamily: big.family, fontSize: big.size, lineHeight: big.lineHeight, color: theme.colors.text.primary }}>
              {fmtKg(latest.kg)}
            </Text>
            <Text style={{ fontFamily: cap.family, fontSize: cap.size, color: theme.colors.text.secondary }}>
              {`Last logged ${monthDayInZone(latest.measuredAtSec * 1000, tz)}`}
              {change ? ` · ${change}` : ''}
            </Text>
          </View>
        ) : (
          <Text style={{ marginTop: theme.spacing.l, fontFamily: body.family, fontSize: body.size, lineHeight: body.lineHeight, color: theme.colors.text.secondary }} testID="weight-empty">
            Log your weight now and then. Over a few weeks it sits next to your blood pressure, so you can see how the two move together.
          </Text>
        )}

        {trend.length >= 2 ? (
          <View style={{ marginTop: theme.spacing.l }} accessibilityLabel={`Weight trend over your last ${trend.length} entries`}>
            <Sparkline values={trend} width={width - theme.spacing.xl * 2} height={56} color={theme.colors.brand.primary} testID="weight-trend" />
          </View>
        ) : null}

        <Text style={sectionLabel}>Log today's weight</Text>
        <View style={styles.row}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="kg"
            placeholderTextColor={theme.colors.text.tertiary}
            keyboardType="decimal-pad"
            maxLength={5}
            style={inputStyle}
            accessibilityLabel="Weight in kilograms"
            testID="weight-input"
          />
          <Button onPress={() => void onSave()} disabled={saving} accessibilityLabel="Save weight" testID="weight-save">
            Save
          </Button>
        </View>

        <Text style={sectionLabel}>Target</Text>
        <Text style={{ fontFamily: body.family, fontSize: body.size, color: theme.colors.text.primary }} testID="weight-target-label">
          {targetLabel(latest?.kg ?? null, target)}
        </Text>
        {editingTarget ? (
          <View style={[styles.row, { marginTop: theme.spacing.s }]}>
            <TextInput
              value={targetInput}
              onChangeText={setTargetInput}
              placeholder="Target kg"
              placeholderTextColor={theme.colors.text.tertiary}
              keyboardType="decimal-pad"
              maxLength={5}
              style={inputStyle}
              accessibilityLabel="Target weight in kilograms"
              testID="weight-target-input"
            />
            <Button onPress={() => void onSaveTarget()} disabled={saving} accessibilityLabel="Save target" testID="weight-target-save">
              Save
            </Button>
          </View>
        ) : null}
        <View style={[styles.row, { marginTop: theme.spacing.s }]}>
          <Button
            variant="ghost"
            onPress={() => setEditingTarget((v) => !v)}
            accessibilityLabel={target === null ? 'Set a target' : 'Change target'}
            testID="weight-target-edit"
          >
            {editingTarget ? 'Cancel' : target === null ? 'Set a target' : 'Change target'}
          </Button>
          {target !== null && !editingTarget ? (
            <Button variant="ghost" onPress={() => void onSaveTarget(true)} accessibilityLabel="Clear target" testID="weight-target-clear">
              Clear target
            </Button>
          ) : null}
        </View>

        {error ? (
          <Text style={{ marginTop: theme.spacing.s, fontFamily: cap.family, fontSize: cap.size, color: theme.colors.text.secondary }} testID="weight-error">
            {error}
          </Text>
        ) : null}

        {entries.length > 0 ? (
          <>
            <Text style={sectionLabel}>Recent</Text>
            {entries.slice(0, 20).map((e) => (
              <View key={`${e.source}:${e.measuredAtSec}`} style={[styles.row, styles.entry, { borderBottomColor: theme.colors.border.subtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: body.family, fontSize: body.size, color: theme.colors.text.primary }}>
                    {monthDayInZone(e.measuredAtSec * 1000, tz)}
                  </Text>
                  <Text style={{ fontFamily: cap.family, fontSize: cap.size, color: theme.colors.text.tertiary }}>{sourceLabel(e)}</Text>
                </View>
                <Text style={{ fontFamily: theme.fontFamilies.numeric, fontSize: body.size, color: theme.colors.text.primary }}>{fmtKg(e.kg)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entry: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
