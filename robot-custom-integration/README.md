### SLListener (Robot Framework wrapper) — Usage Guide

The `SLListener.py` file provides a Robot Framework listener that integrates your Robot test runs with SeaLights. It creates a test session, optionally narrows execution to recommended tests, instruments Selenium and Playwright for web footprints, and reports results back to SeaLights.

### What it does
- **Test session lifecycle**: Opens a SeaLights Test Session on suite start and closes it on suite end.
- **Test selection**: Fetches recommendations and marks excluded tests as `SKIP` before execution.
- **Tracing**: Starts an OpenTelemetry span per test and sets baggage with test/session identifiers.
- **Selenium instrumentation**: Monkey-patches `WebDriver.get/close/quit` to communicate with the SeaLights Browser Agent when present.
- **Playwright instrumentation**: Monkey-patches `Page.goto/close` and `BrowserContext.close` to communicate with the SeaLights Browser Agent when present.
- **Results reporting**: Uploads aggregated test results (name, status, start/end) to SeaLights.

### Requirements
- Robot Framework (Listener API v3 compatible).
- Python 3.x environment with your regular test dependencies.
- A SeaLights token (`sltoken`) whose JWT payload contains the `x-sl-server` claim.
- One of the following to identify the build session:
  - **Build Session ID** (`bsid`), or
  - **Lab ID** (`labid`) that has an active build session for the specified stage.
- **Stage name** (`stagename`) such as `CI`, `Nightly`, etc.
- **Machine DNS**: Robot requires the `machine_dns` environment variable to be set to the application-under-test URL.

### Listener arguments (positional)
1. `sltoken` (required)
2. `bsid` (optional if `labid` is provided)
3. `stagename` (required)
4. `labid` (optional if `bsid` is provided)
5. `testprojectid` (optional) - enables support for non-integration build labs

Notes:
- Provide at least one of `bsid` or `labid`.
- If both `bsid` and `labid` are provided, the listener resolves the active build session via `labid`.
- When skipping an optional argument to provide later ones, pass an empty string to preserve positions.
- When `testprojectid` is provided, it is sent as the `x-sl-testprojectid` HTTP header on all API calls, included in the session creation body, and added as a query parameter when resolving `bsid` from `labid`.
- This example mirrors the current Python agent listener contract; the old fifth positional `use_tags` argument is no longer supported here.

### Quick start
Use an absolute path to avoid module import collisions. Replace `/path/to/repo` with your local clone path.

With `Build Session ID`:

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export BSID="<your-build-session-id>"
robot --listener "/path/to/repo/sl_python_robot/SLListener.py:${SL_TOKEN}:${BSID}:CI Tests" /path/to/robot/tests.robot
```

With `labid`:

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export LAB_ID="<your-lab-id>"
robot --listener "/path/to/repo/sl_python_robot/SLListener.py:${SL_TOKEN}::CI Tests:${LAB_ID}" /path/to/robot/tests.robot
```

With `labid` and `testprojectid` (non-integration build lab):

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export LAB_ID="<your-lab-id>"
export TEST_PROJECT_ID="<your-test-project-id>"
robot --listener "/path/to/repo/sl_python_robot/SLListener.py:${SL_TOKEN}::CI Tests:${LAB_ID}:${TEST_PROJECT_ID}" /path/to/robot/tests.robot
```

### How endpoints are determined
- The listener decodes the JWT (without signature verification) and reads `x-sl-server`, for example `https://your.sl.server/api`.
- For Test Session APIs it uses the `sl-api` base by converting `/api` to `/sl-api`.
- The session creation endpoint is `POST /v1/test-sessions/test-stage` (the `/test-stage` suffix is required by recent backend versions).
- When resolving `bsid` from `labid`, it calls `GET /v1/lab-ids/{labId}/build-sessions/active` on the API base with query params `agentId`, `testStage`, and `testProjectId` when provided.

### Test selection behavior
- On suite start, the listener calls `GET /v1/test-sessions/{id}/exclude-tests`.
- Test names returned from this endpoint are marked as `SKIP` before execution.
- If a skipped test has a teardown, it is removed to avoid side effects.
- Console logs include counts and decisions for transparency.

### Selenium instrumentation
- If `selenium` is installed, the listener applies:
  - After `WebDriver.get`: injects a `CustomEvent("set:context")` with baggage containing `x-sl-test-name` and `x-sl-test-session-id`.
  - On `close` and `quit`: attempts `await window.$SealightsAgent.sendAllFootprints()`.
- The listener also tracks `WebDriver` instances created before `start_test` (for example, browsers opened in Suite Setup) and dispatches the context to them when each test starts, so the patched `get()` does not need to fire first.
- Ensure your application pages include the SeaLights Browser Agent so `window.$SealightsAgent` is available to collect web footprints.

### Playwright instrumentation
- If the `playwright` Python package is installed, the listener applies:
  - After `Page.goto`: injects the same `CustomEvent("set:context")` with baggage containing `x-sl-test-name` and `x-sl-test-session-id`.
  - On `Page.close`: calls `window.$SealightsAgent.sendAllFootprints()` to flush browser footprints before closing.
  - On `BrowserContext.close`: flushes footprints from all open pages in the context before closing.
- The listener also tracks `Page` instances created before `start_test` and dispatches the context to them at test start, mirroring the Selenium behavior.
- The same JavaScript events are dispatched as with Selenium — the SeaLights Browser Agent must be present on the application pages.
- This works with direct Playwright Python API usage (for example, custom Robot keyword libraries that use `playwright.sync_api`). The `robotframework-browser` (Browser Library) uses a Node.js gRPC bridge and may require a different integration approach.

### Logging and environment
- Console log lines are prefixed with `[SeaLights]` for easy filtering.
- The listener disables default OpenTelemetry exporters by setting:
  - `OTEL_METRICS_EXPORTER=none`
  - `OTEL_TRACES_EXPORTER=none`

### Failure and disable behavior
- Missing `stagename` or missing both `bsid` and `labid` disables the listener and logs the reason.
- `labid` resolution outcomes:
  - `200` -> sets `bsid` and continues
  - `404`, `500`, or other errors -> listener is disabled with an explanatory message
- Session creation or results upload failures are logged with HTTP status codes.

### Troubleshooting
- "Listener disabled: Stage name is required" -> provide `stagename` as the third argument.
- "Either 'bsid' or 'labId' must be provided" -> pass at least one; for `labid` only, leave `bsid` empty.
- "Failed to open Test Session" -> verify token validity, network access, and the `x-sl-server` claim.
- "No active build session for labId" -> ensure the lab has an active build session for the given stage.
- Selenium JS errors -> ensure your app pages load the SeaLights Browser Agent (`window.$SealightsAgent`).
- Playwright JS errors -> same as Selenium: ensure your app pages load the SeaLights Browser Agent (`window.$SealightsAgent`).

### File locations
- Listener source: `sl_python_robot/SLListener.py`
- Unit tests: `sl_python_robot/tests/test_sl_listener_unit.py`
- Component tests: `sl_python_robot/tests/test_sl_listener_component.py`
- Test fixtures and stubs: `sl_python_robot/tests/conftest.py`
- Dependency list: `sl_python_robot/requirements.txt`

### Running tests

```bash
cd sl_python_robot
pip install -r requirements.txt
python3 -m pytest tests/ -v
```

The test suite covers:
- Initialization with and without `testprojectid`
- Header and request payload handling for `testProjectId`
- `labid` resolution query parameter behavior
- Playwright instrumentation: `Page.goto`, `Page.close`, `BrowserContext.close`, and `try_instrument_playwright`
- End-to-end HTTP traffic against a mock SeaLights server (component tests)
