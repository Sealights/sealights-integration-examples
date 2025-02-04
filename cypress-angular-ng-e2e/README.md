# Cypress Angular NG e2e

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.2.18.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

# Integration with Sealights Cypress Plugin - how to

## 1. Configuration and build scanning

**NOTE**: Assume that you should run all commands from this directory (/cypress-angular-ng-e2e)! <br><br>

First and foremost install dependencies and build the application:

```bash
npm i --force && npm run build
```

After this step the application can be found under the `dist/cypress-ng-schematic` directory (`cypress-ng-schematic` is defined in `angular.json` - usually it's the project name)

In order to run this demo you need a valid Agent Token stored in a file ex. `sltoken.txt`.
Then you can proceed to run `slnodejs` config command to generate a new `build session id`:

```bash
npx slnodejs config --tokenfile sltoken.txt --appName "Cypress Testing App" --branch "master" --build 1.0.0
```

If this command ran successfully you should have `buildSessionId` file in the same folder and can continue to scan the build:

```bash
npx slnodejs scan --workspacepath ./dist/cypress-ng-schematic --tokenfile sltoken.txt --buildsessionidfile buildSessionId --scm none --instrumentForBrowsers --outputpath "sl_dist"
```

**IMPORTANT**: Make sure you are running `slnodejs >= 6.1.853` with `npx`, to clear cache use `npx clear-npx-cache`.

After a successful build can you should have a resulting `sl_dist` folder under this one and can continue with the steps bellow.

**IMPORTANT:** Do not delete `sltoken.txt` of `buildSessionId` files after the build scan, they are used in the following steps.

## 2. Replace the dist files with the instrumented files

This step is not mandatory, but it makes it easier to work with the single dist directory and not have to change Cypress configurations and targets later on. <br>
So in this step we are replacing the build files from Angular with the instrumented code: <br>

```bash
rm -rf dist/cypress-ng-schematic && mkdir dist/cypress-ng-schematic && cp -r sl_dist/* dist/cypress-ng-schematic
```

## 3. Installing the Cypress Plugin

```shell
npm i sealights-cypress-plugin // Use --force if needed because of ng version missmatch
```

## 4. Configuring Cypress config

Follow the instructions in our README to implement the plugin: https://www.npmjs.com/package/sealights-cypress-plugin <br><br>
**IMPORTANT**: Keep in mind that for different Cypress versions the configuration might be different, that is why we always recommend following the official documentation of the plugin on NPM. <br>

For this particular applicaiton, we can setup the plugin like bellow. <br>
In `cypress.config.js` register the plugin like so:

```typescript
import { defineConfig } from "cypress";
import { registerSealightsTasks } from "sealights-cypress-plugin";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4200",
    supportFile: false,
    setupNodeEvents(on, config) {
      registerSealightsTasks(on, config);
    },
  },

  component: {
    devServer: {
      framework: "angular",
      bundler: "webpack",
    },
    specPattern: "**/*.cy.ts",
  },
});
```

## 5. Import Sealights Cypress support file

In `cypress/support/e2e.ts` import our support file:

```typescript
// existing file content
//...

import "sealights-cypress-plugin/support";
```

## 6. Required Environment Variables for integration

In order for the Sealights integration to work, three parameters have to be exported to the Cypress config.
This can be done using environment variables and exposing them to Cypress. The three environment variables are:

```shell
SL_BUILD_SESSION_ID
SL_TOKEN
SL_TEST_STAGE
```

For them to be available to Cypress, they have to be prefixed with CYPRESS\_, for example from terminal:

```shell
export CYPRESS_SL_TOKEN={token}
```

More about defining the environment variables in Cypress at the following link: https://docs.cypress.io/guides/guides/environment-variables

## 7. Replacing the Angular serve command

### Step 1: Adjust angular.json

By default when you run `ng e2e` command it takes the configuration from the `angular.json` file. <br>
Inside this file you can observe the configuration and initially it looked like so:

```javascript
        "e2e": {
          "builder": "@cypress/schematic:cypress",
          "options": {
            "devServerTarget": "y:serve",
            "watch": true,
            "headless": false
          },
          "configurations": {
            "production": {
              "devServerTarget": "y:serve:production"
            }
          }
        }
```

Remove the `devServerTarget` in the Cypress builder configuration for e2e and make the `production` object empty. This will prevent Angular CLI from trying to serve your files when running `npm run e2e`. <br>
Replace the e2e configuration as bellow:

```javascript
"e2e": {
  "builder": "@cypress/schematic:cypress",
  "options": {
    "watch": true,
    "headless": false
  },
  "configurations": {
    "production": {}
  }
}
```

### Step 2: Update the package.json

Add the following scripts to `package.json`:

```javascript
{
  "scripts": {
    "serve:dist": "npx httpster -d dist/cypress-ng-schematic -p 4200",
    "e2e": "npm run serve:dist & ng e2e && pkill -f httpster"
  }
}
```

**NOTE**: Is `npx httpster` does not work for your pipeline, you can install httpster and use it directly <br>

```bash
npm i httpster
httpster -d dist/cypress-ng-schematic -p 4200
```

## Explanation:

- `serve:dist`: Serves your dist directory using httpster on port 4200.
- `e2e`: Combines the above steps:
  - Serves the files using httpster.
  - Runs Cypress with the baseUrl set to the httpster server.
  - Kills the httpster server after tests are complete.

This setup ensures that your Cypress tests will run against the production build served by httpster (the Sealights instrumented files), not by the Angular development server.

**IMPORTANT**: Please note that we cannot predict your existing Cypress configuration, these are just general guidelines how to get up and running from a basic example. <br> Issues you might encounter are for example different port usage in your application, for that you need to adjust the `-p` parameter for `httpster` in the `serve` script. As well as your `baseUrl` configuration might be different than in this example. Please adjust those variables accordingly.

**IMPORTANT**: `pfkill` is a Unix-like operating system command, you might need to adjust this for your operating system. For example on Windows, the command `pkill` is not available. Instead, you can use `taskkill` to terminate the process. To adapt the script for Windows, you can replace the `pkill -f httpster` with a `taskkill` command.
<br>

## Running

```bash
npm run e2e
```
