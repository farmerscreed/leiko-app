/* global module, jest */
// Manual jest mock for expo-linking — Sprint 15.

const addEventListener = jest.fn(() => ({ remove: jest.fn() }));
const removeEventListener = jest.fn();
const getInitialURL = jest.fn().mockResolvedValue(null);
const openURL = jest.fn().mockResolvedValue(undefined);
const canOpenURL = jest.fn().mockResolvedValue(true);
const parse = jest.fn((url) => ({ hostname: '', path: url, queryParams: {} }));
const createURL = jest.fn((path, options) => {
  const scheme = (options && options.scheme) || 'leiko';
  return `${scheme}://${path}`;
});

module.exports = {
  addEventListener,
  removeEventListener,
  getInitialURL,
  openURL,
  canOpenURL,
  parse,
  createURL,
};
