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
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, ScrollView: View },
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (toValue, _config, callback) => {
      if (typeof callback === 'function') callback(true);
      return toValue;
    },
    withSpring: (toValue, _config, callback) => {
      if (typeof callback === 'function') callback(true);
      return toValue;
    },
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Easing: {
      bezier: () => ({}),
      linear: ({}),
      ease: ({}),
    },
  };
});
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
