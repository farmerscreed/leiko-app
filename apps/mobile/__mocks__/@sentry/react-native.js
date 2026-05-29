/* global module, jest */
// Sentry mock — Jest never reaches the real native module.
// All exports are no-op shims so services/sentry.ts loads cleanly in
// tests without pulling the native bridge.

module.exports = {
  init: jest.fn(),
  setUser: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
};
