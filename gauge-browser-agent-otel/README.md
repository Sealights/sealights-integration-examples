# Quick start
This is a short demo project that uses the [browser-agent](https://github.com/Sealights/SL.OnPremise.Agent.JavaScript/tree/main/browser-agent) that has integrated inside the custom [OTEL Plugin](https://github.com/Sealights/SL.OnPremise.BrowserAgent.Otel.CustomPlugin).
The project uses the [Gauge framework](https://gauge.org/) and a `beforeScenario` hook to set the correct `test name` and `execution(session) id` using an event like so:
```ecmascript6
const customEvent = new CustomEvent("set:baggage", {
  detail: {
     "x-sl-test-name": testName,
     "x-sl-test-session-id": args.testSessionId,
  },
});
window.dispatchEvent(customEvent);
```

The test session is started using the [Public Create Test Session API](https://sealights.atlassian.net/wiki/spaces/SUP/pages/2690220039/Test+Sessions+API+a.k.a+TIA+API#Creating-Test-Session), this is done before sending the event and the return value of this call is a `testSessionId` which is than sent as baggage.

## Run
In order to run the project a backend is required that implements 2 APIs and running on port `8080`
```
/add?n1=&n2=
/subtract?n1=&n2=
```

A sample calculator backend project also exists in this demo under the `backend` folder. The calculator
frontend application (already built) can be found inside the `frontend` folder.

**IMPORTANT** : Make sure to scan the frontend application with the latest OTEL flavored browser agent prior to running the demo!

To run this demo from scratch:
```bash
npm i -g httpster
cd backend && npm run start
cd calculator-app && httpster
npm run test
```