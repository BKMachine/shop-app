/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
  testPathIgnorePatterns: [
    '/node_modules/', // Default to ignore node_modules
    '/__tests__/', // Ignore all files in __tests__ folders
  ],
};
