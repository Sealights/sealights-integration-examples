# Jest Unit Testing with Sealights Integration Example

This project demonstrates how to set up a TypeScript project with Jest unit testing and integrate it with the Sealights Jest Plugin. It includes two examples:
1. A simple calculator implementation using Node.js environment
2. A browser-based calculator using JSDOM environment

**NOTE:** Running the tests with `ts-jest` is not supported by the Sealights Jest Plugin!

## Project Structure

```
jest-unit-tests/
├── src/
│   ├── index.ts             # Calculator implementation for Node.js
│   ├── index.jsdom.ts       # Calculator implementation for browser (JSDOM)
├── test/
│   ├── calculator.test.ts        # Node.js environment test cases
│   ├── calculator.jsdom.test.ts  # JSDOM environment test cases  
│   └── setup-jsdom.js            # JSDOM setup configuration
├── jest.config.js           # Jest configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies and scripts
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Install Sealights Jest Plugin:
```bash
npm install sealights-jest-plugin
```

## Implementing Sealights Jest Plugin

### 1. Configure TypeScript

Ensure your `tsconfig.json` has source map generation enabled:

```json
{
  "compilerOptions": {
    "sourceMap": true,
    // ... other options
  }
}
```
Also make sure you have the `sourceRoot` set to an empty string or another valid value for your use case in your `tsconfig.json` file if you notice wrong source map paths or no coverage reports.

### 2. Modify Jest Configuration

Update your Jest configuration to use the Sealights plugin. Modify `jest.config.js`:

```javascript
/** @type {import('jest').Config} */
const { configCreator } = require('sealights-jest-plugin');

const config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/dist/test/**/*.test.js"],
  verbose: true,
  rootDir: ".",
};

module.exports = configCreator(config); 
```
**NOTE:** In our case we modified `jest.config.js` to use the Sealights plugin. You will need to modify your configuration according to your needs - the main idea is to wrap the `config` object with the `configCreator` function from Sealights.

### 3. Running Tests with Sealights

Before running tests with Sealights:
1. Make sure to build the project first
```bash
npm run build
```
2. Run the `config` and `scan` commands from `slnodejs`
```bash
npx slnodejs config --appname "Calculator Jest Plugin Tests" --branch main --build 1
npx slnodejs scan --workspacepath ./dist --scm none
```
3. Execute tests with Sealights parameters:

```bash
jest --config jest.config.js --sl-testStage='JavaScript Tests' # or npm run test:sealights:js
```

## JSDOM Example Configuration

This project includes an example of using JSDOM to test browser-oriented JavaScript code with Jest. Here's how it's configured:

### 1. JSDOM Dependencies

Install the necessary JSDOM packages:

```bash
npm install --save-dev jsdom @types/jsdom jest-environment-jsdom
```

### 2. Multi-Environment Jest Configuration

The `jest.config.js` is set up to support both Node.js and JSDOM environments:

```javascript
const config = {
  // Default test environment is 'node'
  testEnvironment: "node",
  // Use projects to configure multiple test environments
  projects: [
    {
      displayName: 'node',
      testMatch: ["<rootDir>/dist/test/**/calculator.test.js"],
      testEnvironment: "node",
    },
    {
      displayName: 'jsdom',
      testMatch: ["<rootDir>/dist/test/**/calculator.jsdom.test.js"],
      testEnvironment: "jsdom",
      setupFiles: ['<rootDir>/test/setup-jsdom.js']
    }
  ],
  testMatch: ["<rootDir>/dist/test/**/*.test.js"],
  verbose: true,
  rootDir: ".",
};
```

### 3. JSDOM Setup File

To make JSDOM work properly with Jest, we created a setup file that provides necessary globals:

```javascript
// test/setup-jsdom.js
const { TextEncoder, TextDecoder } = require('util');

// Add TextEncoder and TextDecoder to the global scope
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
```

### 4. Window Type Extensions

In the JSDOM test file, we extended the Window interface to include our custom calculator object:

```typescript
// Extend the Window interface to include our calculator property
declare global {
  interface Window {
    calculator: {
      add: (a: number, b: number) => number;
      subtract: (a: number, b: number) => number;
      multiply: (a: number, b: number) => number;
      divide: (a: number, b: number) => number;
      percentage: (a: number, b: number) => number;
    };
  }
}
```

### 5. Running JSDOM Tests

To run only the JSDOM tests:

```bash
npm run test:jsdom
```

## Additional Configuration and Documentation

For more information on how to configure the Sealights Jest Plugin, please refer to the [Sealights Jest Plugin NPM Package](https://www.npmjs.com/package/sealights-jest-plugin).

For more information on JSDOM, refer to the [JSDOM Documentation](https://github.com/jsdom/jsdom).
