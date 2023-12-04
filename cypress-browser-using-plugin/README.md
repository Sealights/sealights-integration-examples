# Overview
This is a short demo project that uses the Sealights Browser Agent and our Cypress plugin.

# Integration with Sealights - how to

## 1. Configuration and build scanning
**NOTE**: Assume that you should run all commands from this directory (/cypress-browser-using-plugin)! <br><br>
In order to run this demo you need a valid Agent Token stored in a file ex. `sltoken.txt`.
Then you can proceed to run `slnodejs` config command to generate a new `build session id`:
```bash
npx slnodejs config --tokenfile sltoken.txt --appName "Cypress Testing App" --branch "master" --build 1.0.0
```
If this command ran successfully you should have `buildSessionId` file in the same folder and can continue to scan the build:
```bash
npx slnodejs scan --workspacepath ./calculator-app --tokenfile sltoken.txt --buildsessionidfile buildSessionId --scm none --instrumentForBrowsers --enableOpenTelemetry --outputpath "sl_web"
```
**IMPORTANT**: It may not be obvious from the command above but we added one additional parameter `--enableOpenTelemetry` which turns on coloring of HTTP calls by using the `baggage` header.

**IMPORTANT**: Make sure you are running `slnodejs >= 6.1.327` with `npx`, to clear cache use `npx clear-npx-cache`.

After a successful build can you should have a resulting `sl_web` folder under this one and can continue with the steps bellow.

**IMPORTANT:** Do not delete `sltoken.txt` of `buildSessionId` files after the build scan, they are used in the following steps.

## 2. Installing the Cypress Plugin
```shell
npm i sealights-cypress-plugin
```

## 3. Configuring Cypress config
In your `cypress.config.js` register the plugin like so:

```javascript
const { defineConfig } = require("cypress");
const { registerSealightsTasks } = require("sealights-cypress-plugin");

module.exports = defineConfig({
    e2e: {
        experimentalInteractiveRunEvents: true, // If you want to run with 'npm cypress open' and still report coverage
        setupNodeEvents(on, config) {
            registerSealightsTasks(on, config);
        },
    },
});
```

## 4. Import SL Cypress support file 
In your `cypress/support/e2e.js` import our support file:
```javascript
// This is your existing support/e2e.js or index.js file content
// ...
import "sealights-cypress-plugin/support";
```

# Required Environment Variables for integration
In order for the Sealights integration to work, three parameters have to be exported to the Cypress config.
This can be done using environment variables and exposing them to Cypress. The three environment variables are:
```shell
SL_BUILD_SESSION_ID
SL_LAB_ID
SL_TOKEN
SL_TEST_STAGE
```
For them to be available to Cypress, they have to be prefixed with CYPRESS_, for example from terminal:
```shell
export CYPRESS_SL_TOKEN={token}
```

More about defining the environment variables in Cypress at the following link: https://docs.cypress.io/guides/guides/environment-variables

## Run
In order to run the project a backend is required that implements 2 APIs and running on port `8080`
```
/add?n1=&n2=
/subtract?n1=&n2=
```

A sample calculator backend project also exists in this demo under the `backend` folder. The calculator
frontend application (already built) can be found inside the `calculator-app` folder.

**IMPORTANT** : Make sure to scan the frontend application with the latest OTEL flavored browser agent prior to running the demo!

To run this demo from scratch:
```bash
cd backend && npm i && npm run start
cd sl_web && npx httpster
npm i && npm run test
```