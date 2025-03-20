/** @type {import('jest').Config} */
const { configCreator } = require('sealights-jest-plugin');

const config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/dist/test/**/*.test.js"],
  verbose: true,
  rootDir: ".",
};

module.exports = configCreator(config); 