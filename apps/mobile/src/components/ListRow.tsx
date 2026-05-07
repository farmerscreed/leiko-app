// Sourced from docs/03-components/list-row.md (D8 §3.5). 5 variants —
// navigation / toggle / action / data / select — sharing one anatomy:
// optional leading slot, title (type.bodyL), optional subtitle (type.bodyS,
// color.text.secondary), variant-specific trailing, and a 1pt divider below.
//
// Sprint 1 deviation: the spec calls for Phosphor icons (CaretRight 16pt for
// `navigation`, Check 20pt for `select` selected state). We don't ship an
// icon library in Sprint 1 — Phosphor isn't installed and the stack pin
// (docs/00-tech-stack.md) blocks adding one here. Until the icon library
// lands in a later sprint, we render Unicode glyphs ('›' chevron, '✓' check)
// styled with theme colors. Glyph swap is one line per variant.
//
// Toggle variant uses the platform <Switch>, which honours OS Reduce Motion
// natively — we deliberately do NOT animate it ourselves, per the spec's
// "instant toggle" reduced-motion fallback.

import { type ReactNode } from 'react';
import {
  Pressable,
  Switch,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type ListRowVariant = 'navigation' | 'toggle' | 'action' | 'data' | 'select';

export interface ListRowProps {
  variant: ListRowVariant;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  value?: string;
  selected?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  showDivider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

// Numeric value heuristic — value is rendered in monospace if it parses
// cleanly as a number, optionally with mmHg / bpm / % suffixes that BP
// reading rows commonly show. Spec: "value (type.body-l, monospace if
// numeric)".
function isNumericValue(value: string): boolean {
  return /^-?\d+(\.\d+)?\s*(\/\s*\d+(\.\d+)?)?\s*(mmHg|bpm|%|kg|lbs)?$/i.test(value.trim());
}

function composeA11yLabel(
  title: string,
  subtitle: string | undefined,
  variant: ListRowVariant,
  value: string | undefined,
  override: string | undefined,
): string {
  if (override !== undefined) return override;
  const parts: string[] = [title];
  if (subtitle) parts.push(subtitle);
  if (variant === 'data' && value) parts.push(value);
  return parts.join(', ');
}

export function ListRow({
  variant,
  title,
  subtitle,
  leading,
  value,
  selected = false,
  switchValue = false,
  onSwitchChange,
  destructive = false,
  onPress,
  disabled = false,
  showDivider = true,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const titleStyle = theme.type('bodyL');
  const subtitleStyle = theme.type('bodyS');

  const isTappable =
    variant === 'navigation' || variant === 'action' || variant === 'select';

  const titleColor =
    variant === 'action' && destructive
      ? theme.colors.state.urgent
      : theme.colors.text.primary;

  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.listRowMinHeight,
    paddingHorizontal: theme.spacing.l,
    backgroundColor: 'transparent',
  };

  const contentStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: disabled ? theme.opacity.disabled : theme.opacity.full,
  };

  const titleTextStyle: TextStyle = {
    fontSize: titleStyle.size,
    lineHeight: titleStyle.lineHeight,
    fontFamily: titleStyle.family,
    fontWeight: titleStyle.weight as TextStyle['fontWeight'],
    color: titleColor,
  };

  const subtitleTextStyle: TextStyle = {
    fontSize: subtitleStyle.size,
    lineHeight: subtitleStyle.lineHeight,
    fontFamily: subtitleStyle.family,
    fontWeight: subtitleStyle.weight as TextStyle['fontWeight'],
    color: theme.colors.text.secondary,
    marginTop: 2,
  };

  const dividerStyle: ViewStyle = {
    height: 1,
    backgroundColor: theme.colors.border.subtle,
    marginLeft: theme.spacing.l,
    marginRight: theme.spacing.l,
  };

  const trailing = renderTrailing({
    variant,
    value,
    selected,
    switchValue,
    onSwitchChange,
    disabled,
    theme,
  });

  const body = (
    <View style={contentStyle}>
      {leading ? (
        <View style={{ marginRight: theme.spacing.m }}>{leading}</View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={titleTextStyle}>{title}</Text>
        {subtitle ? <Text style={subtitleTextStyle}>{subtitle}</Text> : null}
      </View>
      {trailing ? (
        <View style={{ marginLeft: theme.spacing.m }}>{trailing}</View>
      ) : null}
    </View>
  );

  const a11yLabel = composeA11yLabel(title, subtitle, variant, value, accessibilityLabel);

  if (variant === 'toggle') {
    // The platform <Switch> is the only switch-roled node — it carries the
    // composed accessibilityLabel and accessibilityState. The visual row
    // around it is decorative; double-roling the wrapper would confuse
    // screen readers and make role queries ambiguous.
    return (
      <View testID={testID}>
        <View style={rowStyle}>
          <View style={contentStyle}>
            {leading ? (
              <View style={{ marginRight: theme.spacing.m }}>{leading}</View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={titleTextStyle}>{title}</Text>
              {subtitle ? <Text style={subtitleTextStyle}>{subtitle}</Text> : null}
            </View>
            <View style={{ marginLeft: theme.spacing.m }}>
              <Switch
                value={switchValue}
                onValueChange={onSwitchChange}
                disabled={disabled}
                accessibilityLabel={a11yLabel}
                accessibilityState={{ checked: switchValue, disabled }}
                testID="listrow-switch"
              />
            </View>
          </View>
        </View>
        {showDivider ? <View style={dividerStyle} /> : null}
      </View>
    );
  }

  if (variant === 'data') {
    // Static, no role.
    return (
      <View testID={testID}>
        <View accessibilityLabel={a11yLabel} style={rowStyle}>
          {body}
        </View>
        {showDivider ? <View style={dividerStyle} /> : null}
      </View>
    );
  }

  // Tappable variants: navigation / action / select.
  if (isTappable) {
    return (
      <View testID={testID}>
        <Pressable
          disabled={disabled}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ disabled, selected: variant === 'select' ? selected : undefined }}
          accessibilityLabel={a11yLabel}
          style={({ pressed }) => [
            rowStyle,
            pressed && !disabled
              ? { backgroundColor: theme.colors.surface.subtle }
              : null,
          ]}
        >
          {body}
        </Pressable>
        {showDivider ? <View style={dividerStyle} /> : null}
      </View>
    );
  }

  // Fallthrough — should not be reachable given the union, but keeps
  // the function total.
  return (
    <View testID={testID}>
      <View accessibilityLabel={a11yLabel} style={rowStyle}>
        {body}
      </View>
      {showDivider ? <View style={dividerStyle} /> : null}
    </View>
  );
}

interface TrailingArgs {
  variant: ListRowVariant;
  value: string | undefined;
  selected: boolean;
  switchValue: boolean;
  onSwitchChange: ((v: boolean) => void) | undefined;
  disabled: boolean;
  theme: ReturnType<typeof useTheme>;
}

function renderTrailing(args: TrailingArgs): ReactNode {
  const { variant, value, selected, theme } = args;

  if (variant === 'navigation') {
    // Phosphor CaretRight deferred — Unicode '›' (U+203A) at type.bodyL,
    // muted. Replace with <CaretRight /> when the icon library lands.
    // Note: we deliberately don't set accessibilityElementsHidden here.
    // The parent Pressable's accessibilityLabel shadows descendant text for
    // screen readers, AND `accessibilityElementsHidden` would also hide the
    // node from React Native Testing Library's queries by default.
    const t = theme.type('bodyL');
    const style: TextStyle = {
      fontSize: t.size,
      lineHeight: t.lineHeight,
      color: theme.colors.text.secondary,
    };
    return (
      <Text style={style} testID="listrow-chevron">
        {'›'}
      </Text>
    );
  }

  if (variant === 'data' && value) {
    const t = theme.type('bodyL');
    const numeric = isNumericValue(value);
    const style: TextStyle = {
      fontSize: t.size,
      lineHeight: t.lineHeight,
      fontFamily: numeric ? theme.fontFamilies.numeric : t.family,
      fontWeight: t.weight as TextStyle['fontWeight'],
      color: theme.colors.text.primary,
      textAlign: 'right',
    };
    return (
      <Text style={style} testID="listrow-value">
        {value}
      </Text>
    );
  }

  if (variant === 'select' && selected) {
    // Phosphor Check deferred — Unicode '✓' (U+2713) at type.bodyL,
    // brand primary. Replace with <Check /> when the icon library lands.
    // The parent Pressable's accessibilityLabel covers screen readers; we
    // skip accessibilityElementsHidden so the testID stays queryable.
    const t = theme.type('bodyL');
    const style: TextStyle = {
      fontSize: t.size,
      lineHeight: t.lineHeight,
      color: theme.colors.brand.primary,
      fontWeight: '600',
    };
    return (
      <Text style={style} testID="listrow-check">
        {'✓'}
      </Text>
    );
  }

  return null;
}

