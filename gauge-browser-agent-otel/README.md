# Overview
This is a short demo project that uses the Sealights Browser Agent OTEL flavored version.
The project uses the [Gauge framework](https://gauge.org/) and relevant 
[execution hooks](https://github.com/getgauge/gauge-js/blob/master/docs/syntax/execution-hooks.md) hook to set the 
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
and in order to open a test session we can use the `beforeSuite` hook from gauge like so:
```ecmascript 6
beforeSuite(async () => {
  // Start a test session by calling Public Sealights API
  const { testSessionId } = (await createTestSession()).data.data;
  testSession = testSessionId; // Store it in a variable in the upper scope
  ....
```
Once we have a test session open we can use the capabilities of the Sealight Browser Agent, particularly the events
that allow us to set the current 'context' and `baggage`, in the form of `test name` and the `test session id` (from above).
We can achieve this using the `beforeScenario` hook from Gauge like so:

```ecmascript6
beforeScenario(async (scenario) => {
  // Set the correct context (baggage) before a scenario runs with testName and the current testSessionId
  await evaluate(
    "",
    async (element, args) => {
      const testName = args.scenario.currentScenario.name;
      const customEvent = new CustomEvent("set:baggage", {
        detail: {
          "x-sl-test-name": testName,
          "x-sl-test-session-id": args.testSession,
        },
      });
      window.dispatchEvent(customEvent);
    },
    { args: { scenario, testSession } }
  );
});
```

## 3. Unset the current context after each scenario
```ecmascript 6
afterScenario(async () => {
    // Unset context after scenario
  await evaluate("", async () => {
    const customEvent = new CustomEvent("delete:context");
    window.dispatchEvent(customEvent);
  });
});
```

## 4. Sending test events
We can send test events to Sealights in the `beforeScenario` and/or `afterScenario` hook, again using Sealights Public API like so:
```ecmascript 6
afterScenario(async (scenario) => {
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
afterSuite(async () => {
  // End the current test session after the running suite using Sealights Public API
  await endTestSession(testSession);
  ...
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