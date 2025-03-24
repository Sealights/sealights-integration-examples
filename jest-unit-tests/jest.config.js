/** @type {import('jest').Config} */
const { configCreator } = require('sealights-jest-plugin');

const config = {
  // Default test environment is 'node'
  testEnvironment: "node",
  // Use projects to configure multiple test environments
  projects: [
    {
      displayName: "node",
      testMatch: ["<rootDir>/dist/test/**/calculator.test.js"],
      testEnvironment: "node",
    },
    {
      displayName: "jsdom",
      testMatch: ["<rootDir>/dist/test/**/calculator.jsdom.test.js"],
      testEnvironment: "jsdom",
      setupFiles: ["<rootDir>/test/setup-jsdom.js"],
    },
  ],
  testMatch: ["<rootDir>/dist/test/**/*.test.js"],
  verbose: true,
  rootDir: ".",
};

module.exports = configCreator(config); 