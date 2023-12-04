# Overview
This is a short demo project that uses the Sealights Browser Agent OTEL flavored version.
The project uses [Playwright](https://playwright.dev/) and relevant 
[hooks](https://playwright.dev/docs/writing-tests#using-test-hooks) to set the 
correct `test name` and `execution(session) id`.

# Integration with Sealights - how to

## 1. Configuration and build scanning
In order to run this demo you need a valid Agent Token stored in a file ex. `sltoken.txt`.
Than you can proceed to run `slnodejs` config command to generate a new `build session id`:
```bash
npx slnodejs config --tokenfile sltoken.txt --appName "Browser Example" --branch "master" --build 1.0.0
```
If this command ran successfully you should have `buildSessionId` file in the same folder and can continue to scan the build:
```bash
npx slnodejs scan --workspacepath ./calculator-app --tokenfile sltoken.txt --buildsessionidfile buildSessionId --scm none --instrumentForBrowsers --enableOpenTelemetry --outputpath "sl_web"
```

**IMPORTANT**: It may not be obvious from the command above but we added one additional parameter `--enableOpenTelemetry` which turns on coloring of HTTP calls by using the `baggage` header.

**IMPORTANT**: Make sure you are running `slnodejs >= 6.1.327` with `npx`, to clear cache use `npx clear-npx-cache`.

After a successful build can you should have a resulting `sl_web` folder under this one and can continue with the steps bellow.

**IMPORTANT:** Do not delete `sltoken.txt` of `buildSessionId` files after the build scan, they are used in the following steps.

## 2. Setting the `testSessionId` and `testName`
The very first thing we need before running our tests is having an open test session -
and in order to open a test session we can use the [globalSetup](https://playwright.dev/docs/test-advanced#global-setup-and-teardown)
from Playwright's advanced configuration. <br>
Before adding the config file in `playwright.config.js` we need to specify where the file is located:
```ecmascript 6
module.exports = defineConfig({
    globalSetup: require.resolve("./playwright/global-setup.js"),
    globalTeardown: require.resolve("./playwright/global-teardown.js"),
    ...
```
And this is how our current setup looks like:
```ecmascript 6
const SLService = require("../services/sealightsService");

module.exports = async () => {
    // Start a test session
    const { testSessionId } = (await SLService.createTestSession()).data;
    process.env.SEALIGHTS_TEST_SESSION_ID = testSessionId;
};
```
Once we have a test session open we can use the capabilities of the Sealight Browser Agent, particularly the events
that allow us to set the current 'context' and `baggage`, in the form of `test name` and the `test session id` (from above).
We can achieve this using the `test.beforeEach` hook from Playwright like so:

```ecmascript6
test.beforeEach(async ({ page }, testInfo) => {
  // Capture and output logs from browser console
  page.on("console", (msg) => console.log(msg.text()));

  const title = testInfo.title;
  await page.evaluate(
    ({ title, testSession }) => {
      const customEvent = new CustomEvent("set:baggage", {
        detail: {
          "x-sl-test-name": title,
          "x-sl-test-session-id": testSession,
        },
      });
      window.dispatchEvent(customEvent);
    },
    { title, testSession: process.env.SEALIGHTS_TEST_SESSION_ID }
  );
  await page.goto("http://localhost:3333");
  testStartTime = Date.now();
});
```

## 3. Unset the current context after each scenario
```ecmascript 6
test.afterEach(async ({ page }, testInfo) => {
    // Unset context after scenario
    await page.evaluate(() => {
        const customEvent = new CustomEvent("delete:context");
        window.dispatchEvent(customEvent);
    });
});
```

## 4. Sending test events
We can send test events to Sealights in the `test.beforeEach` and/or `test.afterEach` hook, again using Sealights Public API like so:
```ecmascript 6
test.afterEach(async ({ page }, testInfo) => {
    // Send test event to Sealights
    await SLService.sendTestEvent(
        testSession,
        testInfo.title,
        testStartTime,
        Date.now(),
        testInfo.status
    );
    testStartTime = undefined;
});
```

## 5. End the test session
Again we use the global configuration from Playwright but this time `globalTeardown`:
```ecmascript 6
const SLService = require("../services/sealightsService");

module.exports = async (config) => {
   // End the current test session after the running suite
    await SLService.endTestSession(process.env.SEALIGHTS_TEST_SESSION_ID);
    await browser.close();
};
```

And at the same time we want to assure all footprints have been sent to Sealights:
```ecmascript 6
test.afterAll(async ({ page }) => {
  // Submit all footprints
  await page.evaluate(async () => {
    await window.$SealightsAgent.sendAllFootprints();
  });
});
```

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
npm i && npm run test
```