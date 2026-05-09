/* global module, jest */
// Manual mock for react-native-purchases — auto-loaded by Jest because
// the file sits in __mocks__ adjacent to node_modules. The native module
// loads platform code that doesn't exist in jest's node env, so any
// import of the real package would crash on require.
//
// The adapter at services/purchases/index.ts already wraps require()
// in try/catch and no-ops on load failure, so most tests never touch
// this mock. The few that do (purchases.test.ts) exercise the adapter's
// happy-path branches.

const noopCustomerInfo = { entitlements: { active: {} } };

module.exports = {
  default: {
    configure: jest.fn().mockResolvedValue(undefined),
    logIn: jest.fn().mockResolvedValue(undefined),
    logOut: jest.fn().mockResolvedValue(undefined),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    purchasePackage: jest.fn().mockResolvedValue({ customerInfo: noopCustomerInfo }),
    restorePurchases: jest.fn().mockResolvedValue(noopCustomerInfo),
    setAttributes: jest.fn().mockResolvedValue(undefined),
  },
  // CJS-style consumers that destructure from the module root.
  configure: jest.fn().mockResolvedValue(undefined),
  logIn: jest.fn().mockResolvedValue(undefined),
  logOut: jest.fn().mockResolvedValue(undefined),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  purchasePackage: jest.fn().mockResolvedValue({ customerInfo: noopCustomerInfo }),
  restorePurchases: jest.fn().mockResolvedValue(noopCustomerInfo),
  setAttributes: jest.fn().mockResolvedValue(undefined),
};
