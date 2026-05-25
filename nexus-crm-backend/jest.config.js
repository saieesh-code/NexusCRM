/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/utils/seeder.js',
    '!src/server.js',
  ],
  coverageReporters: ['text', 'lcov'],
  setupFiles: ['./tests/setup.js'],
};
