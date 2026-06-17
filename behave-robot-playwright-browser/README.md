# Behave and Robot + Playwright + SeaLights Browser Agent

Minimal end-to-end demo of **two SeaLights test runners** -- the Python agent's
`behave` runner and a **Robot Framework** runner using the SeaLights custom
listener -- both driving **Playwright** UI tests (via Playwright's native Python
sync API) against a JS app that is **scanned and instrumented by the SeaLights
Node.js agent** so browser coverage is colored per test.

```
   features/*.feature  ->  sl-python behave  ->  Behave runner
                                                       |
                                               page.evaluate
                                                       v
   +-------------------------+      HTTP /add /subtract       +-------------------------+
   | Express backend (:8080) | <----------------------------- | calculator app (:3333)  |
   | run via `slnodejs run`  |   carries x-sl-test-name etc.  | served from ./sl_web    |
   | reads `baggage:` header |                                | window.$SealightsAgent  |
   +-----------+-------------+                                +-----------+-------------+
               |                                                          |
               | backend footprints                                      | browser footprints
               v                                                          v
   +----------------------------------------------------------------------------------+
   |                                SeaLights backend                                  |
   |                  (build mapping + backend + browser footprints)                   |
   +----------------------------------------------------------------------------------+
```

## What the example demonstrates

1. **Build scan** of a JS UI app with `slnodejs scan --instrumentForBrowsers --enableOpenTelemetry`,
   producing an instrumented `sl_web/` tree that injects `window.$SealightsAgent`.
2. **Behave + Playwright** as the test runner, with the SeaLights agent
   auto-detecting `context.page` (Playwright sync Page) per scenario.
3. **Browser coverage coloring** per scenario via the agent dispatching
   `set:context` baggage events into the page (driven by `page.evaluate()`),
   and flushing footprints with `window.$SealightsAgent.sendAllFootprints()`.
4. **Baggage propagation from the FE to the BE server** -- the goal of running
   the backend under `slnodejs run` (see `scripts/run-backend.sh`) with
   `SL_useOtelAgent=true` is to demonstrate that the per-test `baggage` header
   (`x-sl-test-name` / `x-sl-test-session-id`), emitted by the instrumented
   browser, actually reaches the Express server and is picked up by the SeaLights
   Node runtime agent. Backend coverage itself is incidental here, not the point.
5. **Robot Framework as an alternative runner** -- the same app is exercised by a
   Robot suite that drives Playwright through its native Python sync API, with the
   **SeaLights custom Robot listener** (`SLListener.py`) providing the test
   session, test-impact analysis, and per-test browser-coverage coloring. Lives in
   `robot-test-runner/` (see its own README).

## Prerequisites

- Node.js 18+ and `npx`
- Python 3.9+
- A SeaLights agent token (put it in `sltoken.txt` next to this README)
- Pinned versions used in this demo (newer is fine):
  - `slnodejs >= 6.1.327` (latest OTEL-flavored browser agent)
  - `sealights-python-agent` from branch `SLDEV-25948` (Playwright auto-detect)
  - `behave >= 1.2.6`, `playwright >= 1.40`

## One-time setup

### 1. Python environment

Use either a fresh virtualenv for this example **or** any existing one you have
already activated. macOS does not ship a `python` symlink -- always use
`python3` to create venvs.

Fresh venv (recommended):

```bash
python3 -m venv .venv && source .venv/bin/activate
```

Or reuse an existing one (skip the line above -- just make sure the
`(<envname>)` prefix is showing in your shell prompt).

### 2. Install dependencies

```bash
pip install -r requirements.txt
# If you are testing the SLDEV-25948 branch of the Python agent from a local
# checkout instead of pip, replace the line above with:
#   pip install -e /path/to/SL.OnPremise.Agents.Python

playwright install chromium

npm install
(cd backend && npm install)
```

### 3. Drop in your SeaLights token

```bash
echo "YOUR_TOKEN_HERE" > sltoken.txt
```

## Run the demo

Open **four terminals** (or use `tmux`):

```bash
# Terminal 1 -- scan + run backend under the SeaLights Node agent
./scripts/scan-be.sh     # one-time: creates buildSessionId-be (backend build session)
./scripts/run-backend.sh # starts the backend wrapped in `slnodejs run`

# Terminal 2 -- scan + serve instrumented frontend
./scripts/scan.sh        # one-time: creates buildSessionId + sl_web/
./scripts/run-web.sh     # serves sl_web/ on http://localhost:3333

# Terminal 3 -- run tests under the SeaLights Behave runner
./scripts/run-tests.sh

# Terminal 4 -- run tests under the SeaLights Robot runner
# (alternative/additional UI runner to Terminal 3; needs Terminals 1 & 2 running)
cd robot-test-runner                                  # the robot runner has its own dir + venv
python3 -m venv .venv && source .venv/bin/activate    # separate venv from the behave runner
pip install -r requirements.txt                       # robotframework + playwright + SL listener deps
playwright install chromium                           # one-time: install the browser binary
./run-tests.sh                                        # Robot Framework via Playwright native sync API (with SeaLights listener)
```

To watch the browser instead of running headless (Behave runner):

```bash
HEADLESS=false ./scripts/run-tests.sh
```

> **Robot runner details:** `robot-test-runner/` has its own
> [README](robot-test-runner/README.md) with the full keyword reference, how the
> SeaLights custom listener attaches, and how to run it **standalone** (without
> the Behave runner). The app-under-test (Terminals 1 & 2) is shared either way.

## How the integration works

### Node agent: instrumenting the UI

`scripts/scan.sh` runs two Node-agent commands:

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `slnodejs config --tokenfile sltoken.txt --appName ... --branch ... --build ...` | Creates a build session ID, written to `./buildSessionId`. |
| 2 | `slnodejs scan --workspacepath ./calculator-app --outputpath ./sl_web --scm none --instrumentForBrowsers --enableOpenTelemetry --allowCORS '*'` | Scans the JS, submits the build mapping, and writes an instrumented copy of every file (with the `$SealightsAgent` preamble) to `./sl_web`. |

Serving `sl_web/` (instead of `calculator-app/`) is what gives the running page
`window.$SealightsAgent`. The `--enableOpenTelemetry` flag turns on baggage
propagation on `fetch`/`XHR`.

### `--allowCORS '*'` is required for cross-origin baggage

The browser-agent's OTEL fetch interceptor only propagates the `baggage` header
to URLs that match the page's own origin **by default**. In this demo:

- Page is served on `http://localhost:3333` (instrumented `sl_web/`)
- Backend API is on `http://localhost:8080` (different origin)

Without `--allowCORS`, every call to `/add` / `/subtract` would arrive at the
backend with `baggage: <none>`. `--allowCORS '*'` enables propagation to all
origins; `--allowCORS 'http://localhost:8080'` would also work.

Override via env var if you want to test allowlisting:

```bash
ALLOW_CORS='http://localhost:8080' ./scripts/scan.sh
```

### Node agent: ingesting the propagated baggage on the backend

The Express backend is **also** a SeaLights component. Two steps wire it up:

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `scripts/scan-be.sh` -> `slnodejs config` + `slnodejs scan --workspacepath ./backend` | Creates a *separate* backend build session (`./buildSessionId-be`) and submits the backend build mapping. |
| 2 | `scripts/run-backend.sh` -> `slnodejs run --buildsessionidfile ../buildSessionId-be --scandir . -- ./app.js` | Starts `app.js` under the SeaLights Node runtime agent so it collects per-request footprints. |

The point of this step is to prove the **baggage round-trip**: with
`SL_useOtelAgent=true` exported in `run-backend.sh`, the runtime agent reads the
incoming `baggage` header (`x-sl-test-name` / `x-sl-test-session-id`) that the
instrumented browser propagated onto its `/add` / `/subtract` calls, confirming
the per-test context survives the FE -> BE hop. The backend uses its **own**
build session (`buildSessionId-be`) so it is tracked as a distinct component from
the instrumented UI (`buildSessionId`); any footprints it attributes to that
context are a side effect, not the objective. Because the runtime agent needs
that session, `scripts/scan-be.sh` must run **before** `run-backend.sh` -- the
latter needs `./buildSessionId-be` to exist.

### Python agent: driving Behave + the browser agent

`scripts/run-tests.sh` invokes:

```bash
sl-python behave \
  --tokenfile sltoken.txt \
  --buildsessionid "$(cat buildSessionId)" \
  --teststage "E2E Tests" \
  features/
```

The build session id alone is enough to identify the build/branch/app to the
agent -- the lab id is optional and intentionally omitted in this demo to keep
the example minimal.

The agent's `behave_execution.py` wraps Behave's `run_hook`:

| Behave hook | What the SL agent does |
|-------------|------------------------|
| `before_all`  | `SeaLightsAPI.start_execution(...)` then user `before_all` |
| `before_scenario` | SL backend (TIA / test start) -> **user `before_scenario` creates `context.page` and navigates** -> SL `run_browser_set_test` (`page.evaluate` -> `set:context` baggage) |
| `after_scenario`  | SL `run_browser_flush` (`page.evaluate` -> `window.$SealightsAgent.sendAllFootprints()`) -> user `after_scenario` (close page) -> SL test end |
| `after_all`   | user `after_all` -> final browser flush -> `send_all()` -> `end_execution()` |

Auto-detection: anything on `context.page` with a callable `.evaluate` is
treated as a Playwright page. If you keep your page on a different attribute,
pass `--browser-page-attr my_attr` to the agent.

### Browser footprints submission (production note)

The `scripts/scan.sh` in this demo runs the scan **without** `--collectorurl`, so
the instrumented page's browser-agent submits build-mapping/footprints/clock-sync
calls **directly** to the SeaLights backend (the `x-sl-server` claim baked into
your token). This is the simplest possible setup, but it depends on that
SeaLights backend allowing `http://localhost:3333` as a CORS origin.

If you see `CORS policy: No 'Access-Control-Allow-Origin'` errors against the
SeaLights URL in `logs/browser-console.log`:

- The **tests still pass** (the assertions only check the calculator UI).
- The **build mapping submission worked** (that runs from Node, server-side,
  during `scripts/scan.sh`).
- The **per-scenario browser footprints do NOT reach SeaLights** because the
  browser-agent's XHR is being blocked by the browser.

The production-ready fix is to run a **SeaLights Collector** on
`http://localhost:16500` and re-scan with `--collectorurl http://localhost:16500`.
The Collector accepts the browser's CORS calls locally and forwards everything
to the SeaLights backend server-to-server (no browser CORS in play). The
Collector is not bundled with this example; see the SeaLights On-Premise
Collector docs for how to run one alongside.

### `set:context` payload (the proven contract)

The agent dispatches a CustomEvent into the page on each scenario:

```js
window.dispatchEvent(new CustomEvent('set:context', {
  detail: {
    baggage: {
      'x-sl-test-session-id': '<executionId>',
      'x-sl-test-name': '<Feature>:<Scenario>',
    }
  }
}));
```

The Node browser-agent's `setContextHandler` flattens this into a `set:baggage`
event internally and tags every coverage hit with that test identifier until
the next scenario.

## Project layout

```
behave-robot-playwright-browser/
+-- README.md                  (this file)
+-- backend/                   Express /add /subtract (port 8080)
|   +-- app.js
|   +-- package.json
+-- calculator-app/            Source JS UI (the thing being scanned)
|   +-- index.html
|   +-- assets/app.js
|   +-- assets/styles.css
+-- features/                  Behave suite
|   +-- environment.py         Playwright lifecycle (creates context.page)
|   +-- calculator.feature
|   +-- steps/calculator_steps.py
+-- robot-test-runner/         Robot Framework runner (has its own README)
|   +-- calculator.robot       Robot suite (5 cases)
|   +-- CalculatorLibrary.py   Playwright sync-API keyword library
|   +-- SLListener.py          SeaLights custom Robot listener
|   +-- run-tests.sh           runs Robot with the SeaLights listener attached
|   +-- requirements.txt       robotframework + playwright + listener deps
|   +-- README.md              full robot-runner details + standalone run
+-- scripts/
|   +-- scan.sh                slnodejs config + scan of the UI (one-time per build)
|   +-- scan-be.sh             slnodejs config + scan of the backend (one-time per build)
|   +-- run-backend.sh         starts Express backend under `slnodejs run`
|   +-- run-web.sh             serves sl_web/ on :3333
|   +-- run-tests.sh           sl-python behave features/
+-- package.json               slnodejs devDep + npm scripts
+-- requirements.txt           behave + playwright + sealights-python-agent
+-- .gitignore
```

After `scripts/scan.sh` and `scripts/scan-be.sh` run you will also have:

- `buildSessionId`    -- UI build session, created by `slnodejs config` in `scan.sh`
- `buildSessionId-be` -- backend build session, created by `slnodejs config` in `scan-be.sh`
- `sl_web/`           -- instrumented copy of `calculator-app/` served on :3333

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|-------------------|
| Backend logs show `baggage: <none>` on every request | The page and backend are on different origins and the scan was run without `--allowCORS`. Re-run `scripts/scan.sh` -- it now passes `--allowCORS '*'` by default. Tighten via `ALLOW_CORS='http://localhost:8080'` if you want explicit allowlisting. |
| Test failures with `to_have_text` timing out and browser console shows `Request header field <name> is not allowed by Access-Control-Allow-Headers` | The browser-agent's OTEL fetch interceptor adds dynamic headers (`baggage`, `traceparent`, `persist`, etc.) which preflight against the backend. The Express backend in `backend/app.js` reflects requested headers by omitting `allowedHeaders` -- if you replaced this with a hard-coded list, switch back. |
| Browser console shows `Access to XMLHttpRequest at '<sl-server>/clock/sync' has been blocked by CORS policy` | The browser-agent calls the SeaLights backend (the `x-sl-server` claim in your token) directly from the page. If that backend does not send permissive `Access-Control-Allow-Origin` for `http://localhost:3333`, every browser-agent XHR (clock sync, active-execution check, **and footprints submission**) is blocked. The tests still pass because they don't depend on the browser-agent succeeding -- but browser coverage will NOT reach the dashboard. See "Browser footprints submission" below for the fix (point the browser-agent at a local SeaLights Collector instead of direct-to-backend). |
| Tests pass but no browser coverage in SeaLights | Most likely causes, in order: (1) the page is being served from `calculator-app/` instead of `sl_web/` -- check `scripts/run-web.sh`; (2) `window.$SealightsAgent` wasn't ready before navigation -- raise `WAIT_FOR_AGENT_MS` for slow CI; (3) browser-agent XHR to the SeaLights backend is being CORS-blocked (see "Browser footprints submission" above and tail `logs/browser-console.log` for `CORS policy: ...` errors). |
| Behave is not installed error | `pip install -r requirements.txt` inside an activated venv. |
| `sl-python` not found | The Python agent isn't installed in the active environment. `pip install sealights-python-agent` or `pip install -e /path/to/SL.OnPremise.Agents.Python`. |
| Browser-side `setBaggage event with missing testName/executionId` warning | You're on a Python agent version older than the `set:context` fix in this branch. Upgrade or apply the patch in `python_agent/test_listener/coloring/playwright_helper.py`. |
| `run-backend.sh` errors that `buildSessionId-be` is missing | The backend runtime agent needs the backend build session first. Run `scripts/scan-be.sh` before `scripts/run-backend.sh`. |
| Backend started but no backend coverage in SeaLights | Check that `run-backend.sh` is wrapping `./app.js` with `slnodejs run` (not bare `npm start`) and that `SL_useOtelAgent=true` is exported so the agent ingests the incoming `baggage` test context. |
| `npx slnodejs` is stale | `npx clear-npx-cache` then re-run `scripts/scan.sh`. |
| CORS errors in browser console | Make sure the backend was started (`scripts/run-backend.sh`) -- it allows the `baggage` header out of the box. |
| Want to see what the browser-agent is doing? | Browser console logs are written to `logs/browser-console.log` (truncated each run). Behave captures stdout/stderr per scenario and only shows it on failure -- that's why we log to a file instead of `print()`. Tail with `tail -f logs/browser-console.log` while tests run. The default filter shows errors/warnings + every structured agent log (lines containing `"level":"`). For a full firehose (including app debug noise) set `LOG_BROWSER_CONSOLE_VERBOSE=true`. Disable entirely with `LOG_BROWSER_CONSOLE=false`. Change the directory with `LOG_DIR=/tmp/sl-logs`. |

## Notes for the SLDEV-25948 branch

The Python agent on `SLDEV-25948` is the first version with Playwright
auto-detection for the Behave runner. Behavior:

- `--browser` flag was added then removed (`f5e73e3`); detection is now
  automatic based on `context.page` having a callable `.evaluate`.
- `--browser-page-attr` lets you change the attribute name (default: `page`).
- The helper dispatches `set:context` (nested baggage), not `set:baggage`
  (flat), because the Node browser-agent's `setBaggageHandler` reads flat
  keys -- `setContextHandler` is what accepts the nested form and flattens it
  internally.
