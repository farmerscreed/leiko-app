// Sprint 7 placeholder — parent reading-list detail.
//
// Per Sprint 7 card: "Tap on parent card → routes to that parent's
// reading list (placeholder OK; full screen in later sprint)". This
// file owns that placeholder so the route exists and the navigation
// graph compiles. The full list view is a Sprint 9 deliverable
// (docs/04-screens/reading-list.md).

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme';
import type { CaregiverStackParamList } from '../../navigation/types';
import { useFamilyReadings } from '../../hooks/useFamilyReadings';

type Route = RouteProp<CaregiverStackParamList, 'ParentReadings'>;

export function ParentReadingsList() {
  const theme = useTheme();
  const route = useRoute<Route>();
  const { familyId } = route.params;
  const { parents } = useFamilyReadings();
  const parent = parents.find((p) => p.familyId === familyId);

  const headline = theme.type('displayM');
  const body = theme.type('bodyL');
  const caption = theme.type('caption');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface.base }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xxl,
          paddingTop: theme.spacing.xxl,
          paddingBottom: theme.spacing.xxxl,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text.primary,
            fontSize: headline.size,
            lineHeight: headline.lineHeight,
            fontFamily: headline.family,
            fontWeight: headline.weight as '700',
            marginBottom: theme.spacing.s,
          }}
        >
          {parent?.parentDisplayName ?? 'Readings'}
        </Text>
        {parent?.parentRelationship ? (
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: caption.size,
              fontFamily: caption.family,
              textTransform: 'capitalize',
              marginBottom: theme.spacing.xl,
            }}
          >
            {parent.parentRelationship}
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: theme.colors.surface.subtle,
            borderRadius: theme.radii.m,
            padding: theme.spacing.l,
            marginBottom: theme.spacing.xl,
          }}
        >
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: body.size,
              lineHeight: body.lineHeight,
              fontFamily: body.family,
              marginBottom: theme.spacing.s,
            }}
          >
            {parent
              ? `${parent.recentReadings.length} reading${parent.recentReadings.length === 1 ? '' : 's'} synced.`
              : 'Loading…'}
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: caption.size,
              fontFamily: caption.family,
            }}
          >
            The full reading history view is on the way.
          </Text>
        </View>

        {parent?.latestReading ? (
          <Button
            variant="primary"
            onPress={() => undefined}
            accessibilityLabel="Open the latest reading"
            style={{ alignSelf: 'flex-start' }}
          >
            View latest reading
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
