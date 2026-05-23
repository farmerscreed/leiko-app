// EditFamilyDetailsSheet — Sprint 19 Block 3.
//
// Owner-side edit for a family's parent_display_name +
// parent_relationship. Reached from Settings → Family → "Edit family
// details" (owners only). Mirrors the FamilyParent input shape minus
// the timezone (timezone lives on the caregiver's profile, not the
// family).
//
// On submit: calls updateFamilyDetails → invalidates the family-
// readings cache so CaregiverHome re-renders the corrected name.

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Pill } from './Pill';
import { useAuth } from '../state/auth';
import { updateFamilyDetails } from '../services/families/updateFamilyDetails';
import { useTheme } from '../theme';

type ParentRelationship = 'mother' | 'father' | 'aunt' | 'uncle' | 'other';

interface ChipOption {
  value: ParentRelationship;
  label: string;
}

const CHIPS: ChipOption[] = [
  { value: 'mother', label: 'Mum' },
  { value: 'father', label: 'Dad' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'other', label: 'Other' },
];

export interface EditFamilyDetailsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Family being edited. */
  familyId: string;
  /** Current parent_display_name as the form's seed. */
  initialName: string;
  /** Current parent_relationship — may be 'mother', 'father', 'self',
   *  'other:<label>', etc. We decode the stored shape into the chip +
   *  custom label state when the sheet opens. */
  initialRelationship: string;
  onSuccess?: () => void;
  testID?: string;
}

function decodeRelationship(stored: string): {
  rel: ParentRelationship | null;
  custom: string;
} {
  const s = (stored ?? '').trim().toLowerCase();
  if (!s || s === 'self') return { rel: null, custom: '' };
  if (s === 'mother' || s === 'father' || s === 'aunt' || s === 'uncle') {
    return { rel: s, custom: '' };
  }
  if (s.startsWith('other:')) {
    return { rel: 'other', custom: stored.slice('other:'.length) };
  }
  if (s === 'other') return { rel: 'other', custom: '' };
  return { rel: 'other', custom: stored };
}

export function EditFamilyDetailsSheet({
  visible,
  onDismiss,
  familyId,
  initialName,
  initialRelationship,
  onSuccess,
  testID,
}: EditFamilyDetailsSheetProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userId = useAuth((s) => s.session?.user.id ?? null);

  const initialDecoded = decodeRelationship(initialRelationship);
  const [name, setName] = useState(initialName);
  const [rel, setRel] = useState<ParentRelationship | null>(initialDecoded.rel);
  const [custom, setCustom] = useState(initialDecoded.custom);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the sheet (re)opens with possibly new seed
  // values. Without this, opening the sheet for a different family
  // would keep stale state from the prior open.
  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    const decoded = decodeRelationship(initialRelationship);
    setRel(decoded.rel);
    setCustom(decoded.custom);
    setError(null);
    setSubmitting(false);
  }, [visible, initialName, initialRelationship]);

  const customRequired = rel === 'other';
  const customValid = !customRequired || custom.trim().length > 0;
  const valid = name.trim().length > 0 && rel !== null && customValid;

  const body = theme.type('bodyM');
  const label = theme.type('label');

  const encode = (): string => {
    if (!rel) return '';
    if (rel === 'other') {
      const trimmed = custom.trim();
      return trimmed.length > 0 ? `other:${trimmed}` : 'other';
    }
    return rel;
  };

  const handleSubmit = async () => {
    if (!valid || !rel || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateFamilyDetails({
        familyId,
        parentDisplayName: name,
        parentRelationship: encode(),
      });
      await queryClient.invalidateQueries({ queryKey: ['family-readings', userId] });
      setSubmitting(false);
      onSuccess?.();
      onDismiss();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn't save those changes. Try again in a moment.",
      );
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      size="tall"
      surface="solid"
      title="Edit family details"
      testID={testID}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: label.size,
            fontWeight: label.weight as '500',
            fontFamily: label.family,
            marginBottom: theme.spacing.s,
          }}
        >
          Their name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Mama Linda"
          placeholderTextColor={theme.colors.text.secondary}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          accessibilityLabel="The name you call them"
          testID="edit-family-name"
          style={{
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radii.m,
            paddingHorizontal: theme.spacing.l,
            paddingVertical: theme.spacing.m,
            fontSize: body.size,
            fontFamily: body.family,
            color: theme.colors.text.primary,
            borderWidth: 1,
            borderColor: theme.colors.border.default,
            minHeight: theme.minTapTarget,
            marginBottom: theme.spacing.xl,
          }}
        />

        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: label.size,
            fontWeight: label.weight as '500',
            fontFamily: label.family,
            marginBottom: theme.spacing.s,
          }}
        >
          Who are they to you?
        </Text>
        <View
          accessible
          accessibilityRole="radiogroup"
          accessibilityLabel="Their relationship"
          style={styles.chipsRow}
        >
          {CHIPS.map((chip) => (
            <View
              key={chip.value}
              style={{ marginRight: theme.spacing.s, marginBottom: theme.spacing.s }}
            >
              <Pill
                selected={rel === chip.value}
                onPress={() => setRel(chip.value)}
                accessibilityLabel={chip.label}
                testID={`edit-family-chip-${chip.value}`}
              >
                {chip.label}
              </Pill>
            </View>
          ))}
        </View>

        {customRequired ? (
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder="Aunt Tola, Godfather, …"
            placeholderTextColor={theme.colors.text.secondary}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="Custom relationship"
            testID="edit-family-custom"
            style={{
              backgroundColor: theme.colors.surface.elevated,
              borderRadius: theme.radii.m,
              paddingHorizontal: theme.spacing.l,
              paddingVertical: theme.spacing.m,
              fontSize: body.size,
              fontFamily: body.family,
              color: theme.colors.text.primary,
              borderWidth: 1,
              borderColor: theme.colors.border.default,
              minHeight: theme.minTapTarget,
              marginTop: theme.spacing.s,
              marginBottom: theme.spacing.l,
            }}
          />
        ) : (
          <View style={{ height: theme.spacing.l }} />
        )}

        <Button
          variant="primary"
          onPress={() => {
            void handleSubmit();
          }}
          disabled={!valid || submitting}
          testID="edit-family-save"
          style={{ width: '100%' }}
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            testID="edit-family-error"
            style={{
              color: theme.colors.state.urgent,
              fontSize: body.size,
              fontFamily: body.family,
              marginTop: theme.spacing.l,
              textAlign: 'center',
            }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingTop: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
