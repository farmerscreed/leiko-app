// AddSomeoneChooserSheet — Sprint 19 Block 2.
//
// Replaces the direct "+ Add someone" → Settings navigation with a
// chooser that disambiguates the two distinct actions a family_owner
// might mean:
//
//   1. "Care for another person"  → create a NEW family circle, with
//                                   yourself as family_owner. Adds a
//                                   second orb to the dashboard.
//   2. "Invite a caregiver"        → invite ANOTHER USER to view the
//                                   wearers you already care for.
//                                   No new orb; adds a co-caregiver.
//
// Pre-Sprint-19 the button conflated these — tapping it routed to the
// invite flow, leading caregivers who wanted a second wearer to be
// confused when no new card appeared.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { useTheme } from '../theme';

export interface AddSomeoneChooserSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Opens the new-family setup screen ("Care for another person"). */
  onAddPerson: () => void;
  /** Opens the existing caregiver-invite flow ("Invite a caregiver"). */
  onInviteCaregiver: () => void;
  testID?: string;
}

interface RowProps {
  title: string;
  sub: string;
  onPress: () => void;
  testID: string;
}

function ChooserRow({ title, sub, onPress, testID }: RowProps) {
  const theme = useTheme();
  const titleStyle = theme.type('title');
  const body = theme.type('bodyM');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => ({
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.l,
        borderRadius: theme.radii.m,
        backgroundColor: theme.colors.surface.elevated,
        opacity: pressed ? 0.7 : 1,
        marginBottom: theme.spacing.m,
      })}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: titleStyle.size,
          lineHeight: titleStyle.lineHeight,
          fontFamily: titleStyle.family,
          fontWeight: titleStyle.weight as '600',
          marginBottom: theme.spacing.xs,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: body.size,
          lineHeight: body.lineHeight,
          fontFamily: body.family,
        }}
      >
        {sub}
      </Text>
    </Pressable>
  );
}

export function AddSomeoneChooserSheet({
  visible,
  onDismiss,
  onAddPerson,
  onInviteCaregiver,
  testID,
}: AddSomeoneChooserSheetProps) {
  const theme = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      size="compact"
      surface="solid"
      title="Add to your circle"
      testID={testID}
    >
      <View
        style={[
          styles.container,
          { paddingHorizontal: theme.spacing.l, paddingBottom: theme.spacing.l },
        ]}
      >
        <ChooserRow
          title="Care for another person"
          sub="Set up a new circle for someone else you look after."
          onPress={onAddPerson}
          testID={testID ? `${testID}-add-person` : 'chooser-add-person'}
        />
        <ChooserRow
          title="Invite a caregiver"
          sub="Add another person who can see the readings."
          onPress={onInviteCaregiver}
          testID={testID ? `${testID}-invite-caregiver` : 'chooser-invite-caregiver'}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 8 },
});
