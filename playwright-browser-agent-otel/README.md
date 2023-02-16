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
**IMPORTANT**: Make sure you are running `slnodejs >= 6.1.278` with `npx`, to clear cache use `npx clear-npx-cache`.

After a successful build can you should have a resulting `sl_web` folder under this one and can continue with the steps bellow.

**IMPORTANT:** Do not delete `sltoken.txt` of `buildSessionId` files after the build scan, they are used in the following steps.

## 2. Setting the `testSessionId` and `testName`
The very first thing we need before running our tests is having an open test session -
and in order to open a test session we can use the `test.beforeAll` hook from Playwright like so:
```ecmascript 6
test.beforeAll(async () => {
  // Start a test session
  const { testSessionId } = (await SLService.createTestSession()).data;
  testSession = testSessionId;
});
```
Once we have a test session open we can use the capabilities of the Sealight Browser Agent, particularly the events
that allow us to set the current 'baggage', in the form of `test name` and the `test session id` (from above).
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
    { title, testSession }
  );
  await page.goto("http://localhost:3333");
});
```

## 3. Unset the current baggage after each test scenario
```ecmascript 6
test.afterEach(async ({ page }, testInfo) => {
    // Unset baggage after scenario
    await page.evaluate(() => {
        const customEvent = new CustomEvent("delete:baggage");
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
```ecmascript 6
test.afterAll(async ({ page }) => {
    // End the current test session after the running suite
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
cd sl_web && npx httpster
npm i && npm run test
```