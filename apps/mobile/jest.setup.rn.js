// Runs after jest-expo's preset setup, which requires `expo/src/winter` and
// installs lazy getters via defineLazyObjectProperty. Those getters self-
// replace with cached values on first access — so touching them here forces
// eager evaluation. Without this, jest tears down the test environment, then
// something (jest internals, RN cleanup, fast-refresh hooks) reads
// __ExpoImportMetaRegistry, the lazy getter fires `require()`, and jest-
// runtime throws "outside the scope of the test code" because
// `isInsideTestCode === false`. See memory/jest_expo_deferred.md.

/* global jest, process */

void globalThis.__ExpoImportMetaRegistry;
void globalThis.URLSearchParams;
void globalThis.structuredClone;

// Supabase env vars — services/supabase.ts throws at module load if these
// are missing. Screens that touch the auth or onboarding store transitively
// import that file, so the rn test runner needs them set.
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

// Reanimated 4 + worklets expect a native module in the bundle that doesn't
// exist under jest. The shipped `react-native-reanimated/mock` re-imports
// the real reanimated and fails. Hand-rolled mocks below cover the surface
// our components actually use — useSharedValue, useAnimatedStyle,
// withTiming (synchronous in tests), runOnJS, Easing, default Animated.View.
// gesture-handler exposes `Gesture.Pan()` builders and <GestureDetector>;
// the official jestSetup module mocks them.
jest.mock('react-native-reanimated', () => {
  const { View, Text } = jest.requireActual('react-native');
  // createAnimatedComponent passes the wrapped component through as-is.
  // animatedProps is merged into props at render time so SVG attributes
  // appear on the underlying element for snapshot inspection.
  const createAnimatedComponent = (Component) => Component;
  return {
    __esModule: true,
    default: { View, ScrollView: View, Text, createAnimatedComponent },
    createAnimatedComponent,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (fn) => fn(),
    useAnimatedProps: (fn) => fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    withTiming: (toValue, _config, callback) => {
      if (typeof callback === 'function') callback(true);
      return toValue;
    },
    withSpring: (toValue, _config, callback) => {
      if (typeof callback === 'function') callback(true);
      return toValue;
    },
    withRepeat: (anim) => anim,
    withSequence: (...anims) => anims[anims.length - 1],
    withDelay: (_delay, anim) => anim,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Easing: {
      bezier: () => ({}),
      linear: ({}),
      ease: ({}),
      // Wrapping easings — `Easing.inOut(fn)` returns a symmetric easing
      // around `fn`. In the mock these are no-op pass-throughs since
      // animations resolve synchronously.
      inOut: (fn) => fn,
      in: (fn) => fn,
      out: (fn) => fn,
    },
  };
});
// expo-blur exposes a native BlurView. In jest we render it as a plain View
// so the rest of the tree mounts normally; the actual blur effect isn't
// testable in jest anyway.
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});

// expo-haptics is consumed by theme/tokens/haptics.ts (imported by any
// component that fires a haptic via `fireHaptic`). Mock to no-op promises;
// haptic firing is verified by behavioural intent, not by native effect.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  const PanGestureBuilder = {
    enabled: () => PanGestureBuilder,
    onChange: () => PanGestureBuilder,
    onEnd: () => PanGestureBuilder,
    onUpdate: () => PanGestureBuilder,
    onBegin: () => PanGestureBuilder,
    onFinalize: () => PanGestureBuilder,
  };
  return {
    Gesture: {
      Pan: () => PanGestureBuilder,
      Tap: () => PanGestureBuilder,
    },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    State: {},
    Directions: {},
  };
});
