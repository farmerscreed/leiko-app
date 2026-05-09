// FamilyMembersScreen — Sprint 10c.2 polish.
//
// Read-only list of every member of the user's family circle.
// Reached from Settings → Family → "Family members". The wearer's
// row sits at the top with a "You" tag; caregivers follow in
// joined-at order.
//
// Per D8 §4.11 + D8a §10.2. Removal of a caregiver from the circle is
// a future polish (writes use the "owner edits members" RLS policy
// already in place); the read-only surface lands first so the user
// has visibility into their own circle.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListRow } from '../../components/ListRow';
import { SettingsSection } from '../../components/SettingsSection';
import {
  listFamilyMembers,
  type FamilyMember,
} from '../../services/families/listMembers';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';
import { useAuth } from '../../state/auth';
import { useTheme } from '../../theme';
import type { CaregiverScreenProps } from '../../navigation/types';
import type { FamilyRole } from '../../types/database';

const ROLE_LABEL: Record<FamilyRole, string> = {
  family_owner: 'Family owner',
  parent_owner: 'Wearer',
  caregiver: 'Caregiver',
  parent_viewer: 'Family',
};

function formatJoined(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

type Props =
  | CaregiverScreenProps<'FamilyMembers'>
  | { navigation: { goBack: () => void } };

export function FamilyMembersScreen({ navigation }: Props) {
  const theme = useTheme();
  const { parents } = useFamilyReadings();
  const familyId = parents[0]?.familyId ?? null;
  const myUserId = useAuth((s) => s.session?.user.id ?? null);

  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!familyId) {
      setMembers([]);
      return;
    }
    setError(null);
    try {
      const list = await listFamilyMembers(familyId);
      setMembers(list);
    } catch {
      setError("We couldn't load your family list. Pull down to retry.");
    }
  }, [familyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="family-members-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.m }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="family-members-back"
            style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.xxl }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                fontWeight: '500',
              }}
            >
              Back
            </Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text.primary,
              fontSize: headlineStyle.size,
              lineHeight: headlineStyle.lineHeight,
              fontWeight: headlineStyle.weight as '700',
              fontFamily: headlineStyle.family,
              letterSpacing: -0.6,
              marginBottom: theme.spacing.s,
            }}
          >
            Family members
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.l,
            }}
          >
            Everyone in your circle.
          </Text>
        </View>

        {error ? (
          <View style={{ paddingHorizontal: theme.spacing.l }}>
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
                textAlign: 'center',
                paddingVertical: theme.spacing.l,
              }}
              testID="family-members-error"
            >
              {error}
            </Text>
          </View>
        ) : members === null ? (
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              textAlign: 'center',
              padding: theme.spacing.l,
            }}
            testID="family-members-loading"
          >
            Loading…
          </Text>
        ) : members.length === 0 ? (
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              textAlign: 'center',
              padding: theme.spacing.l,
            }}
            testID="family-members-empty"
          >
            No one here yet. Invite someone from Settings → Family.
          </Text>
        ) : (
          <SettingsSection title="Members" first testID="family-members-section">
            {members.map((member, idx) => {
              const isYou = member.userId === myUserId;
              const subtitle = `${ROLE_LABEL[member.role]} · joined ${formatJoined(member.joinedAt)}`;
              return (
                <ListRow
                  key={member.userId}
                  variant="data"
                  title={isYou ? `${member.displayName} (you)` : member.displayName}
                  subtitle={subtitle}
                  showDivider={idx !== members.length - 1}
                  testID={`family-member-${member.userId}`}
                />
              );
            })}
          </SettingsSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
