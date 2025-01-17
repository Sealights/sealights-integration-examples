/** @type {import('jest').Config} */
const { configCreator } = require('sealights-jest-plugin');

const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  verbose: true
};

module.exports = configCreator(config); 