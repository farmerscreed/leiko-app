/* global module */
// Minimal `react-native` stand-in for the "pure" (ts-jest, node) test
// project. The pure project deliberately bypasses jest-expo, so it has
// no real react-native to transform — importing the package directly
// dies with "Cannot use import statement outside a module" (RN ships
// ESM that ts-jest doesn't transpile from node_modules).
//
// Historically no pure-graph module imported `react-native` at all.
// The BLE foreground-service wrapper (services/ble/foregroundService.ts)
// is the first — it's pulled into the pure graph via state/auth and
// state/pairing. It only touches `Platform.OS` and `NativeModules`, so
// this stub exposes just those. The wrapper short-circuits to a no-op
// when the native module is absent, which is exactly the pure-test
// shape (NativeModules is empty here).
//
// This file lives outside __mocks__/ on purpose: a manual mock named
// react-native.js there would be auto-applied to the jest-expo `rn`
// project too and clobber the real react-native it needs. It's wired
// in only for the pure project via moduleNameMapper in jest.config.js.

const Platform = {
  OS: 'android',
  select: (spec) =>
    spec && Object.prototype.hasOwnProperty.call(spec, 'android')
      ? spec.android
      : spec
        ? spec.default
        : undefined,
};

module.exports = {
  Platform,
  NativeModules: {},
};
