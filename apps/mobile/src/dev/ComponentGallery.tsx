// Dev-only component gallery — mounted from App.tsx when __DEV__.
// Renders every Sprint 1 component × variant × state for visual review.
// The mode toggle at the top swaps between caregiver (48pt taps, smaller
// type) and parent (64pt taps, larger type). Doubles as the Sprint 1
// "demo" for the definition-of-done.
//
// Voice rules apply to every visible string here, even though this file
// is dev-only — drift in dev copy tends to migrate to production. Test
// fixtures use spec patterns: "Mum" / "Dad", verb + object CTAs, sentence
// case, no fear language.

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ListRow } from '../components/ListRow';
import { Pill } from '../components/Pill';
import { BottomSheet, type BottomSheetSize } from '../components/BottomSheet';
import { useTheme, type ThemeMode } from '../theme';

interface Props {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}

export function ComponentGallery({ mode, onModeChange }: Props) {
  const theme = useTheme();
  const [largeSwitch, setLargeSwitch] = useState(false);
  const [pushSwitch, setPushSwitch] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'today' | 'week' | 'month'>('week');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetSize, setSheetSize] = useState<BottomSheetSize>('default');
  const [sheetUrgent, setSheetUrgent] = useState(false);

  const headlineStyle = {
    fontSize: theme.type('headline').size,
    lineHeight: theme.type('headline').lineHeight,
    fontWeight: '600' as const,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.l,
  };
  const sectionTitleStyle = {
    fontSize: theme.type('title').size,
    lineHeight: theme.type('title').lineHeight,
    fontWeight: '600' as const,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.m,
    marginTop: theme.spacing.xxxl,
  };
  const captionStyle = {
    fontSize: theme.type('caption').size,
    lineHeight: theme.type('caption').lineHeight,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.s,
  };
  const bodyStyle = {
    fontSize: theme.type('bodyL').size,
    lineHeight: theme.type('bodyL').lineHeight,
    color: theme.colors.text.primary,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surface.base }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xxl }}>
        <Text style={headlineStyle}>Leiko design system</Text>

        {/* Mode toggle */}
        <Text style={captionStyle}>Mode</Text>
        <View style={styles.modeRow}>
          <Pill
            variant="outline"
            selected={mode === 'caregiver'}
            onPress={() => onModeChange('caregiver')}
          >
            Caregiver
          </Pill>
          <View style={{ width: theme.spacing.s }} />
          <Pill
            variant="outline"
            selected={mode === 'parent'}
            onPress={() => onModeChange('parent')}
          >
            Parent
          </Pill>
        </View>
        <Text style={captionStyle}>
          {mode === 'caregiver' ? '48pt tap targets · standard type' : '64pt tap targets · larger type'}
          {theme.reduceMotion ? ' · reduced motion on' : ''}
        </Text>

        {/* Pill */}
        <Text style={sectionTitleStyle}>Pill</Text>
        <View style={styles.pillRow}>
          <Pill variant="neutral">Today</Pill>
          <Pill variant="info">Start here</Pill>
          <Pill variant="accent">Worth a look</Pill>
          <Pill variant="urgent">Talk to Dad now</Pill>
          <Pill variant="success">In range</Pill>
          <Pill variant="outline">Filter</Pill>
        </View>
        <Text style={captionStyle}>Selectable filter chips</Text>
        <View style={styles.pillRow}>
          {(['today', 'week', 'month'] as const).map((key) => (
            <Pill
              key={key}
              variant="outline"
              selected={selectedFilter === key}
              onPress={() => setSelectedFilter(key)}
            >
              {key === 'today' ? 'Today' : key === 'week' ? 'This week' : 'This month'}
            </Pill>
          ))}
        </View>

        {/* Card */}
        <Text style={sectionTitleStyle}>Card</Text>
        <Card>
          <Text style={bodyStyle}>Default — taupe on cream, no shadow.</Text>
        </Card>
        <View style={{ height: theme.spacing.l }} />
        <Card elevation="low">
          <Text style={bodyStyle}>Low elevation — white on cream, subtle shadow.</Text>
        </Card>
        <View style={{ height: theme.spacing.l }} />
        <Card elevation="medium">
          <Text style={bodyStyle}>Medium elevation — for sheet content.</Text>
        </Card>
        <View style={{ height: theme.spacing.l }} />
        <Card
          onPress={() => undefined}
          accessibilityLabel="Mum's reading card, opens reading detail"
        >
          <Text style={bodyStyle}>Tappable card — press me.</Text>
        </Card>

        {/* ListRow */}
        <Text style={sectionTitleStyle}>List row</Text>
        <Card>
          <View style={{ marginHorizontal: -theme.spacing.l, marginVertical: -theme.spacing.l }}>
            <ListRow
              variant="navigation"
              title="Notifications"
              subtitle="Daily, weekly, anomaly"
              onPress={() => undefined}
            />
            <ListRow
              variant="toggle"
              title="Large text mode"
              switchValue={largeSwitch}
              onSwitchChange={setLargeSwitch}
            />
            <ListRow
              variant="toggle"
              title="Push notifications"
              subtitle="Daily summaries and anomalies"
              switchValue={pushSwitch}
              onSwitchChange={setPushSwitch}
            />
            <ListRow variant="data" title="Phone" value="+234 800 000 0000" />
            <ListRow variant="data" title="Last reading" value="128/82 mmHg" />
            <ListRow
              variant="select"
              title="English"
              selected
              onPress={() => undefined}
            />
            <ListRow
              variant="action"
              title="Sign out"
              onPress={() => undefined}
              showDivider={false}
            />
          </View>
        </Card>
        <View style={{ height: theme.spacing.l }} />
        <Card>
          <View style={{ marginHorizontal: -theme.spacing.l, marginVertical: -theme.spacing.l }}>
            <ListRow
              variant="action"
              title="Delete account"
              destructive
              onPress={() => undefined}
              showDivider={false}
            />
          </View>
        </Card>

        {/* Button — variants */}
        <Text style={sectionTitleStyle}>Button — variants</Text>
        <View style={styles.buttonRow}>
          <Button variant="primary" onPress={() => undefined}>Pair watch</Button>
        </View>
        <View style={styles.buttonRow}>
          <Button variant="accent" onPress={() => undefined}>Add a note</Button>
        </View>
        <View style={styles.buttonRow}>
          <Button variant="secondary" onPress={() => undefined}>Add a family member</Button>
        </View>
        <View style={styles.buttonRow}>
          <Button variant="ghost" onPress={() => undefined}>Skip</Button>
        </View>
        <View style={styles.buttonRow}>
          <Button variant="destructive" onPress={() => undefined}>Sign out</Button>
        </View>

        <Text style={sectionTitleStyle}>Button — states</Text>
        <View style={styles.buttonRow}>
          <Button variant="primary" onPress={() => undefined}>Default</Button>
        </View>
        <View style={styles.buttonRow}>
          <Button variant="primary" onPress={() => undefined} loading>
            Saving
          </Button>
        </View>
        <View style={styles.buttonRow}>
          <Button variant="primary" onPress={() => undefined} disabled>
            Disabled
          </Button>
        </View>

        {/* BottomSheet — triggers */}
        <Text style={sectionTitleStyle}>Bottom sheet</Text>
        <View style={styles.buttonRow}>
          <Button
            variant="secondary"
            onPress={() => {
              setSheetSize('compact');
              setSheetUrgent(false);
              setSheetVisible(true);
            }}
          >
            Open compact
          </Button>
        </View>
        <View style={styles.buttonRow}>
          <Button
            variant="secondary"
            onPress={() => {
              setSheetSize('default');
              setSheetUrgent(false);
              setSheetVisible(true);
            }}
          >
            Open default
          </Button>
        </View>
        <View style={styles.buttonRow}>
          <Button
            variant="secondary"
            onPress={() => {
              setSheetSize('tall');
              setSheetUrgent(false);
              setSheetVisible(true);
            }}
          >
            Open tall
          </Button>
        </View>
        <View style={styles.buttonRow}>
          <Button
            variant="destructive"
            onPress={() => {
              setSheetSize('default');
              setSheetUrgent(true);
              setSheetVisible(true);
            }}
          >
            Open confirmed-urgent
          </Button>
        </View>

        <View style={{ height: theme.spacing.xxxxl }} />
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        onDismiss={() => setSheetVisible(false)}
        size={sheetSize}
        confirmedUrgent={sheetUrgent}
        title={sheetUrgent ? 'Please call Dad' : 'Add a note'}
      >
        <Text style={bodyStyle}>
          {sheetUrgent
            ? 'Three high readings in the last hour. We recommend reaching out now.'
            : 'Notes are visible to everyone in the family circle. Tap and hold to edit.'}
        </Text>
        {sheetUrgent ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Button variant="primary" onPress={() => setSheetVisible(false)}>
              I&apos;ve called
            </Button>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  buttonRow: {
    marginBottom: 12,
  },
});
