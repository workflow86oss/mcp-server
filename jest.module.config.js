module.exports = {
  displayName: 'module',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests/module'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  // Coverage configuration (enabled when running with --coverage)
  coverageDirectory: '<rootDir>/coverage/module',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  globalSetup: "<rootDir>/tests/module/precheck.ts",
  watchman: false,
};
