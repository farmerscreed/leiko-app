// Shared navigation ref — Sprint 15.
//
// Exposed so non-screen code (notification tap handlers, deep-link
// router, OS background tasks) can navigate without an active screen
// scope. RootNavigator attaches this ref to NavigationContainer.
//
// jest-expo's mock for @react-navigation/native does not provide
// createNavigationContainerRef, so we fall back to a no-op shim
// in tests. At runtime the real factory returns a usable ref.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const navModule = require('@react-navigation/native') as {
  createNavigationContainerRef?: () => NavigationRefLike;
};

interface NavigationRefLike {
  isReady: () => boolean;
  navigate: (...args: unknown[]) => void;
  current?: unknown;
}

const fallbackRef: NavigationRefLike = {
  isReady: () => false,
  navigate: () => {},
  current: null,
};

export const navigationRef: NavigationRefLike = navModule.createNavigationContainerRef
  ? navModule.createNavigationContainerRef()
  : fallbackRef;
