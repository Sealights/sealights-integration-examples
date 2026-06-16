# Robot Framework + Playwright (native sync API) test runner

A minimal Robot Framework suite that drives the calculator demo app through
**Playwright's native Python sync API** (`playwright.sync_api`), exposed to Robot
via a thin custom keyword library (`CalculatorLibrary.py`).

This is deliberately **not** the Robot `Browser` library (which is a Node.js /
gRPC bridge) and not Selenium. The UI is driven through a real
`playwright.sync_api.Page`, which is the integration shape SeaLights supports:
the SeaLights listener instruments `playwright.sync_api.Page` directly, so a real
in-process sync `Page` is what makes per-test browser coverage possible.

## Layout

```
robot-test-runner/
+-- CalculatorLibrary.py   Playwright sync-API keyword library
+-- calculator.robot       the test suite (5 cases)
+-- SLListener.py          SeaLights custom Robot listener (copied from the repo)
+-- requirements.txt       robotframework + playwright + listener deps
+-- run-tests.sh           convenience runner (attaches the SeaLights listener)
+-- README.md              this file
```

## Setup

From this directory (a virtualenv is recommended):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Run

The app under test is served by the parent example. In separate terminals:

```bash
# in ../  (behave-robot-playwright-browser)
./scripts/run-backend.sh    # Express backend on :8080
./scripts/run-web.sh        # serves the app on :3333
```

Then run the suite:

```bash
./run-tests.sh                 # headless
HEADLESS=false ./run-tests.sh  # watch the browser
APP_URL=http://localhost:3333 ./run-tests.sh
```

Robot output (`log.html`, `report.html`, `output.xml`) is written to `results/`.

## Adding SeaLights (the customer flow)

SeaLights is added exactly as a customer would, per the SeaLights docs:
[Robot Framework SeaLights Custom Listener](https://docs.sealights.io/knowledgebase/setup-and-configuration/integrations/sample-integrations/integrating-test-executions-from-various-testing-frameworks#robot-framework-sealights-custom-listener).
Two steps:

1. **Copy `SLListener.py`** into your project (already done here -- copied
   verbatim from `robot-custom-integration/sl_python_robot/SLListener.py`).
2. **Install the listener's dependencies** and **attach it** to the Robot run.

The listener's only hard imports are `requests`, `pyjwt`, and `opentelemetry-api`
(already in `requirements.txt`). Attach it with `--listener`, passing
colon-separated arguments:

```
SLListener.py : <token> : <buildSessionId> : <test stage> : [labId] : [testProjectId]
```

The SeaLights server URL is derived from the token's JWT (`x-sl-server`), so
**there is no domain argument**. `run-tests.sh` wires this up for you, reusing the
parent example's `../sltoken.txt` and `../buildSessionId`:

```bash
robot \
  --outputdir results \
  --listener "SLListener.py:$(cat ../sltoken.txt):$(cat ../buildSessionId):Robot Tests:$(cat ../buildSessionId)" \
  calculator.robot
```

> Note: the public docs page currently shows an older domain-first argument order
> (`domain:token:bsid:stage`). The actual listener in the repo is token-first as
> shown above -- the server comes from the token.

> **Demo workaround (`labId`):** the 5th argument is `labId`, set here to the
> `buildSessionId`. The listener calls `POST /v1/test-sessions/test-stage`, which
> rejects an empty `labId` (`400 Missing parameter 'labId'`), and this demo is a
> bsid-only integration build with no real lab. Passing `labId=bsid` clears the
> 400 so a session is created, but the listener resolves the labId to an active
> build and falls back to a dummy build session -- so coverage attribution is not
> exact yet. The proper fix belongs in the SL listener (fall back to
> `POST /v1/test-sessions` when no `labId` is provided); revisit then.

What the listener does per run: opens a SeaLights test session on suite start,
applies test-impact analysis (marking excluded tests as `SKIP`), instruments the
Playwright `Page` to dispatch `set:context` baggage and flush
`window.$SealightsAgent.sendAllFootprints()` per test, then reports results and
closes the session on suite end.

## Keywords

`CalculatorLibrary.py` provides:

| Keyword | Action |
|---------|--------|
| `Open Calculator` | launch a fresh Playwright context/page and navigate to the app |
| `Close Calculator` | close the current context/page (per test) |
| `Shutdown` | close the browser and stop Playwright (per suite) |
| `Enter Number <field> <value>` | fill `#number1` / `#number2` |
| `Click Operation <button>` | click `#addBtn` / `#subtractBtn` / `#resetBtn` |
| `Result Should Be <value>` / `Result Should Be Empty` | assert on `#result` |
| `Error Should Be <message>` | assert on `#error` |
| `Field Should Be Empty <field>` | assert an input is cleared |
