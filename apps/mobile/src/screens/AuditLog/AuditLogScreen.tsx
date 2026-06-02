// AuditLogScreen — Sprint 10b.3.
//
// Read-only viewer of the user's last 90 days of public.audit_log.
// RLS already permits "self reads own audit"; this screen just renders
// what the query returns. Per D6 US-82: "I can see who's accessed my
// data and when".
//
// Voice: action codes are translated to plain-language sentences. Raw
// action strings (e.g. 'reading.read', 'subscription.activated') stay
// behind the wall — the user sees "Sarah viewed today's reading" or
// "Leiko Plus started".
//
// Empty state per docs/05-voice-and-claims.md: "Activity from the last
// 90 days will appear here. Nothing to see yet."

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListRow } from '../../components/ListRow';
import { useAuth } from '../../state/auth';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../theme';
import type { CaregiverScreenProps } from '../../navigation/types';

interface AuditEntry {
  id: number;
  occurred_at: string;
  action: string;
  metadata: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  'reading.read': 'A reading was viewed',
  'subscription.activated': 'Leiko Plus started',
  'subscription.renewed': 'Leiko Plus renewed',
  'subscription.lapsed': 'Leiko Plus ended',
  'subscription.event_replayed': 'Subscription event replayed',
  'sync.invalid_sample': 'A reading was rejected',
  'family.role_change': 'A family role changed',
  'data.export_started': 'Data export started',
  'data.export_completed': 'Data export completed',
  'account.delete_requested': 'Account deletion requested',
};

function actionToLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatTime(iso: string): string {
  // Sprint 16.5i — use device locale (was hardcoded 'en-US'). Per
  // CLAUDE.md the app ships in Nigeria + US; en-NG users got
  // MM/DD formatting that doesn't match their conventions.
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} · ${time}`;
}

type Props =
  | CaregiverScreenProps<'AuditLog'>
  | { navigation: { goBack: () => void } };

export function AuditLogScreen({ navigation }: Props) {
  const theme = useTheme();
  const userId = useAuth((s) => s.session?.user.id ?? null);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      return;
    }
    setError(null);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: queryError } = await supabase
      .from('audit_log')
      .select('id, occurred_at, action, metadata')
      .eq('actor_user_id', userId)
      .gte('occurred_at', ninetyDaysAgo)
      .order('occurred_at', { ascending: false })
      .limit(200);
    if (queryError) {
      setError("We couldn't load your activity log. Pull down to retry.");
      return;
    }
    setEntries((data ?? []) as AuditEntry[]);
  }, [userId]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const headlineStyle = theme.type('displayM');
  const bodyStyle = theme.type('bodyL');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.warmBase }]}
      edges={['top', 'bottom']}
      testID="audit-log-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ paddingHorizontal: theme.spacing.l, paddingTop: theme.spacing.l }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={theme.spacing.m}
            testID="audit-log-back"
            style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.l }}
          >
            <Text
              style={{
                color: theme.colors.brand.primary,
                fontSize: bodyStyle.size,
                fontFamily: bodyStyle.family,
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
              marginBottom: theme.spacing.s,
            }}
          >
            Activity
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              marginBottom: theme.spacing.l,
            }}
          >
            The last 90 days of activity on your account.
          </Text>
        </View>

        {error ? (
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              padding: theme.spacing.l,
              textAlign: 'center',
            }}
            testID="audit-log-error"
          >
            {error}
          </Text>
        ) : entries === null ? (
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              padding: theme.spacing.l,
              textAlign: 'center',
            }}
            testID="audit-log-loading"
          >
            Loading…
          </Text>
        ) : entries.length === 0 ? (
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: bodyStyle.size,
              fontFamily: bodyStyle.family,
              padding: theme.spacing.l,
              textAlign: 'center',
            }}
            testID="audit-log-empty"
          >
            Nothing here yet. Activity will appear as it happens.
          </Text>
        ) : (
          entries.map((entry, idx) => (
            <ListRow
              key={`${entry.id}-${entry.occurred_at}`}
              variant="data"
              title={actionToLabel(entry.action)}
              subtitle={formatTime(entry.occurred_at)}
              showDivider={idx !== entries.length - 1}
              testID={`audit-log-entry-${entry.id}`}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
});
