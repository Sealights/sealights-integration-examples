# Overview
This is a short demo project that uses the Sealights Browser Agent OTEL flavored version.
The project uses [Cypress](https://www.cypress.io/) and relevant 
[hooks](https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests) to set the 
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
**IMPORTANT**: Make sure you are running `slnodejs >= 6.1.327` with `npx`, to clear cache use `npx clear-npx-cache`.

After a successful build can you should have a resulting `sl_web` folder under this one and can continue with the steps bellow.

**IMPORTANT:** Do not delete `sltoken.txt` of `buildSessionId` files after the build scan, they are used in the following steps.

## 1.1 Reading Sealights configuration files in Cypress
Cypress supports `setupNodeEvents` in `cypress.config.js` which allows us to define a task to read
two files, the token file and the build session id file. 
We defined `readSealightsConfig` task inside and than in the `before` hook from Cypress we can read
the contents of those files like so:
```ecmascript 6
cy.task("readSealightsConfig").then( async ({ buildSessionId, apiToken }) => {...

```
## 2. Setting the `testSessionId` and `testName`
The very first thing we need before running our tests is having an open test session - 
and in order to open a test session we can use the `before` root-level hook from Cypress like so:
```ecmascript 6
before(async () => {
  // Start a test session by calling Public Sealights API
  const { testSessionId } = (await createTestSession()).data.data;
  testSession = testSessionId; // Store it in a variable in the upper scope
  ....
```
Once we have a test session open we can use the capabilities of the Sealight Browser Agent, particularly the events
that allow us to set the current 'context' and `baggage`, in the form of `test name` and the `test session id` (from above).
We can achieve this using the `beforeEach` hook from Cypress like so:

```ecmascript6
beforeEach(async (scenario) => {
  // Set the correct context (baggage) before a scenario runs with testName and the current testSessionId
  const testName = Cypress.currentTest.title;
  const customEvent = new CustomEvent("set:context", {
     detail: {
       baggage: {
         "x-sl-test-name": testName,
         "x-sl-test-session-id": testSession,
       },
     },
  });
  window.dispatchEvent(customEvent);
});
```

## 3. Unset the current context after each scenario
```ecmascript 6
afterEach(async () => {
  // Unset context after scenario
  const customEvent = new CustomEvent("delete:context");
  window.dispatchEvent(customEvent);
});
```

## 4. Sending test events
We can send test events to Sealights in the `beforeEach` and/or `afterEach` hook, again using Sealights Public API like so:
```ecmascript 6
afterEach(async (scenario) => {
     // Send test event to Sealights
    await SLService.sendTestEvent(
        testSession,
        scenario.currentScenario.name,
        testStartTime,
        Date.now(),
        scenario.currentScenario.isFailed ? "failed" : "passed"
    );
    ...
});
```

## 5. End the test session
```ecmascript 6
after(async () => {
// End the current test session after the running suite using Sealights Public API
    SLService.endTestSession(testSession).finally(() => {
        cy.window().then(async (win) => {
            win.$SealightsAgent.sendAllFootprints().finally(done);
        });
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