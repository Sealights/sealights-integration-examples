# Jest Unit Testing with Sealights Integration Example

This project demonstrates how to set up a TypeScript project with Jest unit testing and integrate it with the Sealights Jest Plugin. It uses a simple calculator implementation as an example.

## Project Structure

```
jest-unit-tests/
├── src/
│   └── index.ts         # Calculator implementation
├── test/
│   └── calculator.test.ts    # Test cases
├── jest.config.js       # TypeScript Jest configuration
├── jest.config.js.js    # JavaScript Jest configuration
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

## Running Tests

The project supports both TypeScript and JavaScript test execution, and we will demonstrate how to run tests with Sealights for both cases.

- Run TypeScript tests directly (with ts-jest): `npm run test:ts`
- Run JavaScript tests (compiled): `npm run test:js`
- Run tests in watch mode: `npm run test:watch`

## Implementing Sealights Jest Plugin

### 1. Configure TypeScript

Ensure your `tsconfig.json` has source map generation enabled:

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "sourceRoot": "."
    // ... other options
  }
}
```

### 2. Modify Jest Configuration

Update your Jest configuration to use the Sealights plugin. Modify `jest.config.js`:

```javascript
const { configCreator } = require('sealights-jest-plugin');

const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  verbose: true
};

module.exports = configCreator(config);
```
**NOTE:** In our case we modified both `jest.config.js` and `jest.config.js.js` to use the Sealights plugin both when running with `ts-jest` and `jest` respectively.

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

    For the TypeScript tests:
    ```bash
    jest --config jest.config.js --sl-testStage='TypeScript Tests' --sl-tokenfile=sltoken.txt --sl-buildsessionidfile=buildSessionId # or npm run test:sealights:ts
    ```
    For the JavaScript tests:
    ```bash
    jest --config jest.config.js.js --sl-testStage='JavaScript Tests' --sl-tokenfile=sltoken.txt --sl-buildsessionidfile=buildSessionId # or npm run test:sealights:js
    ```

## Additional Configuration and Documentation

For more information on how to configure the Sealights Jest Plugin, please refer to the [Sealights Jest Plugin NPM Package](https://www.npmjs.com/package/sealights-jest-plugin).
