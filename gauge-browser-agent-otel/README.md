# Quick start
This is a short demo project that uses the [browser-agent](https://github.com/Sealights/SL.OnPremise.Agent.JavaScript/tree/main/browser-agent) that has integrated inside the custom [OTEL Plugin](https://github.com/Sealights/SL.OnPremise.BrowserAgent.Otel.CustomPlugin).
The project uses the [Gauge framework](https://gauge.org/) and a `beforeScenario` hook to set the correct `test name` and `execution(session) id` using an event like so:
```
window.emitter.emit("set:baggage", {
    "x-sl-test-name": args.currentScenario.name,
    "x-sl-test-session-id": "sessionId",
});
```

## Run
In order to run the project a backend is required that implements 2 APIs and running on port `8080`
```
/add?n1=&n2=
/subtract?n1=&n2=
```
And than to run the demo:
```
npm run test
```