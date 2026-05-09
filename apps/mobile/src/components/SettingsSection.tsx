// SettingsSection — Sprint 10b.1.
//
// Group header for the new Settings hub. Per docs/04-screens/settings.md
// "section header is type.label Bold, color.text.secondary, spacing.l
// above + spacing.s below".
//
// Header is rendered as a screen-reader role="header" so VoiceOver /
// TalkBack announces section transitions. Children are rendered as-is —
// the caller composes ListRow rows inside the section's footprint.

import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  /** Trims the top spacing — used for the first section in a screen so
   *  it doesn't double-pad the safe-area inset. */
  first?: boolean;
  testID?: string;
}

export function SettingsSection({
  title,
  children,
  first = false,
  testID,
}: SettingsSectionProps) {
  const theme = useTheme();
  const labelStyle = theme.type('label');
  return (
    <View
      style={{
        marginTop: first ? theme.spacing.s : theme.spacing.l,
      }}
      testID={testID}
    >
      <View
        accessibilityRole="header"
        style={{
          paddingHorizontal: theme.spacing.l,
          marginBottom: theme.spacing.s,
        }}
      >
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: labelStyle.size,
            lineHeight: labelStyle.lineHeight,
            fontFamily: labelStyle.family,
            fontWeight: '700',
            // Sentence-case headlines per docs/05-voice-and-claims.md.
            // Caller is responsible for already-correct casing.
          }}
        >
          {title}
        </Text>
      </View>
      <View>{children}</View>
    </View>
  );
}
