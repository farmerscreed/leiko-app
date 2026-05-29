/* global module */
// posthog-react-native mock. Real native module is never reached
// in jest; services/analytics/posthog.ts loadNative() require() call
// resolves to this shim instead.

class PostHog {
  constructor() {}
  capture() {}
  identify() {}
  reset() {}
  flush() {}
}

module.exports = PostHog;
module.exports.default = PostHog;
