# Jest Unit Testing with Sealights Integration Example

This project demonstrates how to set up a TypeScript project with Jest unit testing and integrate it with the Sealights Jest Plugin. It uses a simple calculator implementation as an example.

**NOTE:** Running the tests with `ts-jest` is not supported by the Sealights Jest Plugin!

## Project Structure

```
jest-unit-tests/
├── src/
│   └── index.ts         # Calculator implementation
├── test/
│   └── calculator.test.ts    # Test cases
├── jest.config.js       # Jest configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project dependencies and scripts
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

## Additional Configuration and Documentation

For more information on how to configure the Sealights Jest Plugin, please refer to the [Sealights Jest Plugin NPM Package](https://www.npmjs.com/package/sealights-jest-plugin).
