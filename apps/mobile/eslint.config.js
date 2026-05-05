const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: [
      'node_modules',
      'android',
      'ios',
      'dist',
      '.expo',
      'web-build',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
