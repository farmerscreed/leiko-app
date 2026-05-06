// Two test projects:
//
//   "pure" — ts-jest, runs theme tokens, buildTheme, and any other framework-
//   free TypeScript test (formatters, validators, classification rules). No
//   React, no React Native; cheap to run.
//
//   "rn" — jest-expo, runs React Native component tests against
//   @testing-library/react-native. Workspace-aware via the broadened roots
//   (npm hoists expo/ to the monorepo root).
//
// Pure tests bypass jest-expo entirely because jest-expo's setup.js eagerly
// require()s expo/src/winter, whose lazy getters fire after teardown and
// throw "outside the scope of the test code" — the issue documented in
// memory/jest_expo_deferred.md. Splitting projects sidesteps it: pure tests
// never touch the winter polyfill.

module.exports = {
  rootDir: __dirname,
  projects: [
    {
      displayName: 'pure',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: __dirname,
      roots: ['<rootDir>'],
      testMatch: [
        '<rootDir>/__tests__/**/*.test.ts?(x)',
        '<rootDir>/src/theme/**/__tests__/**/*.test.ts?(x)',
        '<rootDir>/src/utils/**/__tests__/**/*.test.ts?(x)',
        '<rootDir>/src/services/**/__tests__/**/*.test.ts?(x)',
        '<rootDir>/src/state/**/__tests__/**/*.test.ts?(x)',
      ],
    },
    {
      displayName: 'rn',
      preset: 'jest-expo',
      rootDir: __dirname,
      roots: ['<rootDir>', '<rootDir>/../../node_modules'],
      setupFiles: ['<rootDir>/jest.setup.rn.js'],
      testMatch: [
        '<rootDir>/src/components/**/__tests__/**/*.test.ts?(x)',
        '<rootDir>/src/screens/**/__tests__/**/*.test.ts?(x)',
        '<rootDir>/src/dev/**/__tests__/**/*.test.ts?(x)',
      ],
      testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
    },
  ],
};
