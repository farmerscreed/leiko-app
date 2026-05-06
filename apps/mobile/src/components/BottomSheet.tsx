// Sourced from docs/03-components/bottom-sheet.md (D8 §3.7). The primary
// modal pattern in Leiko — full-screen modals are reserved for paywall
// and onboarding only.
//
// Sprint 1 deliverables:
//   - compact / default / tall sizing variants ('full' deferred — per the
//     spec, prefer a navigation push)
//   - drag-to-dismiss with a 30% threshold
//   - reduced-motion path (hard cut — CLAUDE.md anti-pattern: "bottom-sheet
//     appears as hard cut, not slide")
//   - keyboard-avoidance
//   - confirmed-urgent variant (backdrop non-dismissible, drag disabled,
//     primary action is required to dismiss)
//
// Animation + gesture come from react-native-gesture-handler@2.28.0 and
// react-native-reanimated@4.1.7 (see ADR-0004). The translateY is a
// shared value driven on the UI thread so drag stays at 60fps.

import { useEffect, useState, type ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

export type BottomSheetSize = 'compact' | 'default' | 'tall';

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  size?: BottomSheetSize;
  /**
   * Confirmed-urgent dispatcher mode (D8 §3.7). Backdrop tap and drag-down
   * are both disabled; consumer is responsible for calling onDismiss from
   * an explicit primary action ("OK, I've called").
   */
  confirmedUrgent?: boolean;
  title?: string;
  children: ReactNode;
  testID?: string;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 0.3; // 30% drag-down per docs/03-components/bottom-sheet.md

// Map design-token easing curves to reanimated's Easing.bezier.
const EASE_DECELERATE = Easing.bezier(0, 0, 0, 1);
const EASE_ACCELERATE = Easing.bezier(0.3, 0, 1, 1);

function sizeToDimension(size: BottomSheetSize): { height?: number; maxHeight?: number } {
  switch (size) {
    case 'compact':
      // Spec: "sized to content, max 50% screen, not expandable".
      return { maxHeight: SCREEN_HEIGHT * 0.5 };
    case 'default':
      return { height: SCREEN_HEIGHT * 0.6 };
    case 'tall':
      return { height: SCREEN_HEIGHT * 0.8 };
  }
}

export function BottomSheet({
  visible,
  onDismiss,
  size = 'default',
  confirmedUrgent = false,
  title,
  children,
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const dimension = sizeToDimension(size);
  // For drag math we need a concrete sheet height; if 'compact' is content-
  // sized, fall back to half the cap as a reasonable threshold seed.
  const sheetHeight = dimension.height ?? SCREEN_HEIGHT * 0.5;

  // mounted lags `visible` so the close animation can finish before the
  // Modal unmounts. visible=true mounts immediately and animates in;
  // visible=false animates out, then mounted flips to false on completion.
  const [mounted, setMounted] = useState(false);

  // translateY: 0 = fully open, sheetHeight (or SCREEN_HEIGHT) = offscreen.
  const translateY = useSharedValue(SCREEN_HEIGHT);

  // Animation duration honours reduceMotion (collapses normal/slow → fast or
  // instant per docs/02-design-tokens.md §6.3).
  const openDuration = theme.duration('slow');
  const fastDuration = theme.duration('fast');

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, {
        duration: openDuration,
        easing: EASE_DECELERATE,
      });
    } else if (mounted) {
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        { duration: openDuration, easing: EASE_ACCELERATE },
        (finished) => {
          if (finished) {
            runOnJS(setMounted)(false);
          }
        },
      );
    }
  }, [visible, mounted, openDuration, translateY]);

  const dismissFromGesture = () => {
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: openDuration, easing: EASE_ACCELERATE },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
          runOnJS(onDismiss)();
        }
      },
    );
  };

  const panGesture = Gesture.Pan()
    .enabled(!confirmedUrgent)
    .onChange((event) => {
      // Sprint 1: clamp drag to downward only. Upward expand is deferred
      // along with the 'full' size variant.
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const past30 = event.translationY > sheetHeight * DISMISS_THRESHOLD;
      if (past30) {
        dismissFromGesture();
      } else {
        translateY.value = withTiming(0, { duration: fastDuration, easing: EASE_DECELERATE });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Render nothing while fully closed — keeps the Modal out of the tree.
  if (!mounted) return null;

  const surfaceStyle: ViewStyle = {
    backgroundColor: theme.colors.surface.elevated,
    borderTopLeftRadius: theme.radii.l,
    borderTopRightRadius: theme.radii.l,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.s,
    paddingBottom: theme.spacing.xxl,
    ...(dimension.height !== undefined ? { height: dimension.height } : {}),
    ...(dimension.maxHeight !== undefined ? { maxHeight: dimension.maxHeight } : {}),
    ...theme.elevation.medium.ios,
    ...theme.elevation.medium.android,
  };

  const titleStyle = theme.type('title');
  const titleTextStyle: TextStyle = {
    fontSize: titleStyle.size,
    lineHeight: titleStyle.lineHeight,
    fontWeight: titleStyle.weight as TextStyle['fontWeight'],
    fontFamily: titleStyle.family,
    color: theme.colors.text.primary,
    flex: 1,
  };

  const showHeader = !!title || !confirmedUrgent;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={confirmedUrgent ? () => undefined : onDismiss}
      statusBarTranslucent
      testID={testID}
    >
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {/* Backdrop — navy at opacity.scrim. Tap dismisses unless urgent. */}
        <Pressable
          accessible={!confirmedUrgent}
          accessibilityHint={confirmedUrgent ? undefined : 'Closes sheet'}
          onPress={confirmedUrgent ? undefined : onDismiss}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(15, 35, 64, ${theme.opacity.scrim})` },
          ]}
          testID="bottomsheet-backdrop"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kbAvoid}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.sheetWrapper, animatedSheetStyle]}>
              <View style={surfaceStyle}>
                <View
                  style={[
                    styles.dragHandle,
                    {
                      backgroundColor: theme.colors.border.default,
                      marginBottom: theme.spacing.s,
                    },
                  ]}
                  accessibilityLabel="Drag to dismiss"
                />
                {showHeader ? (
                  <View style={styles.titleRow}>
                    {title ? <Text style={titleTextStyle}>{title}</Text> : <View style={{ flex: 1 }} />}
                    {!confirmedUrgent ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        onPress={onDismiss}
                        hitSlop={12}
                        testID="bottomsheet-close"
                      >
                        <Text style={{ fontSize: 24, color: theme.colors.text.primary }}>
                          {'×'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {children}
              </View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kbAvoid: { flex: 1, justifyContent: 'flex-end' },
  sheetWrapper: { width: '100%' },
  dragHandle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
