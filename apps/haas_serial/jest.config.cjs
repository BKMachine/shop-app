/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    // Types are covered by `check-types`; Jest only needs the code transpiled.
    // The package is ESM, but Jest runs here in CommonJS mode so that jest.mock() works.
    '^.+.tsx?$': [
      'ts-jest',
      {
        transpilation: true,
        tsconfig: { module: 'CommonJS', moduleResolution: 'bundler', verbatimModuleSyntax: false },
      },
    ],
  },
  moduleNameMapper: {
    // Source imports use the .js extension that ESM requires; point them at the .ts files.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@repo/utilities/logger$': '<rootDir>/src/__tests__/__stubs__/utilities_logger.ts',
  },
  testPathIgnorePatterns: [
    '/node_modules/', // Default to ignore node_modules
    '/__tests__/', // Ignore all files in __tests__ folders
    '/dist/', // Compiled copies of the tests
  ],
};
