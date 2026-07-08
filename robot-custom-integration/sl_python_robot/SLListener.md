### SLListener (Robot Framework wrapper) — Usage Guide

The `SLListener.py` provides a Robot Framework listener that integrates your Robot test runs with SeaLights. It creates a test session, optionally narrows execution to recommended tests, instruments Selenium and Playwright for web footprints, and reports results back to SeaLights.

### What it does
- **Test session lifecycle**: Opens a SeaLights Test Session on suite start and closes it on suite end.
- **Test selection**: Fetches recommendations and marks excluded tests as `SKIP` before execution.
- **Tracing**: Starts an OpenTelemetry span per test and sets baggage with test/session identifiers.
- **Selenium instrumentation**: Monkey-patches `WebDriver.get/close/quit` to communicate with the SeaLights Browser Agent when present.
- **Playwright instrumentation**: Monkey-patches `Page.goto/close` and `BrowserContext.close` to communicate with the SeaLights Browser Agent when present.
- **Browser Library instrumentation**: Detects `robotframework-browser` at runtime and injects/flushes via `evaluate_javascript`, since it drives Playwright from a separate Node.js process (no in-process objects to monkey-patch).
- **Results reporting**: Uploads aggregated test results (name, status, start/end) to SeaLights.

### Requirements
- Robot Framework (Listener API v3 compatible).
- Python 3.x environment with your regular test dependencies.
- A SeaLights token (`sltoken`) whose JWT payload contains the `x-sl-server` claim.
- One of the following to identify the build session:
  - **Build Session ID** (`bsid`), or
  - **Lab ID** (`labid`) that has an active build session for the specified stage.
- **Stage name** (`stagename`) such as `CI`, `Nightly`, etc.
- **Machine DNS** Robot require `machine_dns` environment variable to be set - this is the url to the application under test

### Listener arguments (positional) (space are supported in params)
1) `sltoken` (required)
2) `bsid` (optional if `labid` is provided)
3) `stagename` (required)
4) `labid` (optional if `bsid` is provided)
5) `testprojectid` (optional) — enables support for non-integration build labs

Notes:
- Provide at least one of `bsid` or `labid`.
- If both `bsid` and `labid` are provided, the listener resolves the active build session via `labid`.
- When skipping an optional argument to provide later ones, pass an empty string to preserve positions.
- When `testprojectid` is provided, it is sent as the `x-sl-testprojectid` HTTP header on all API calls, included in the session creation body, and added as a query parameter when resolving `bsid` from `labid`.

### Quick start
Use an absolute path to avoid module import collisions. Replace `/path/to/repo` with your local clone path.

With `Build Session Id` example:

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export BSID="<your-build-session-id>"
robot --listener "/path/to/repo/robot/SLListener.py:${SL_TOKEN}:${BSID}:CI Tests" /path/to/robot/tests.robot
```

With `labid` example:

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export LAB_ID="<your-lab-id>"
robot --listener "/path/to/repo/robot/SLListener.py:${SL_TOKEN}::CI Tests:${LAB_ID}" /path/to/robot/tests.robot
```

With `labid` and `testprojectid` (non-integration build lab):

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export LAB_ID="<your-lab-id>"
export TEST_PROJECT_ID="<your-test-project-id>"
robot --listener "/path/to/repo/robot/SLListener.py:${SL_TOKEN}::CI Tests:${LAB_ID}:${TEST_PROJECT_ID}" /path/to/robot/tests.robot
```

### How endpoints are determined
- The listener decodes the JWT (without signature verification) and reads `x-sl-server`, e.g. `https://your.sl.server/api`.
- Test Sessions (create/results/close) and the v2 exclude-tests lookup use the `sl-api` base, by converting `/api` → `/sl-api`.
- When resolving `bsid` from `labid`, it calls `GET /v1/lab-ids/{labId}/build-sessions/active` on the **API base** (not `sl-api`) with query params `agentId`, `testStage`, and `testProjectId` (when provided).

### Test selection behavior
- On the first suite of the run, the listener calls `GET /v2/test-sessions/{id}/exclude-tests` and applies the result once `metadata.testSelectionEnabled` is `true` and `metadata.status` is `"ready"`; every other status (or `testSelectionEnabled: false`) runs all tests for that attempt.
- If the first response is `status: "notReady"`, the listener polls the same endpoint until it turns terminal (`ready` or another definitive status) or a timeout budget is reached:
  - `SL_TIA_POLLING_INTERVAL_SEC` — seconds between retries (default `5`).
  - `SL_TIA_POLLING_TIMEOUT_SEC` — total polling budget in seconds (default `60`).
  - Setting either variable to `0` disables polling and performs a single fetch instead. Invalid values (non-numeric, negative, `inf`, `nan`) fall back to the default and log a warning.
- Once a terminal answer (`ready` or a definitive "run all" status) is received, it is cached for the rest of the run — later suites reuse it without re-querying the backend. A non-terminal outcome (e.g. a polling timeout, or a transient failure) is retried with a single fetch on the next suite.
- Test names returned from a `ready` response are marked as `SKIP` before execution.
- If a skipped test has a teardown, it is removed to avoid side effects.
- Console logs include the endpoint decision (`enabled`/`status`/count), retry attempts, and timeout warnings for transparency.

### Selenium instrumentation
- If `selenium` is installed, the listener applies:
  - After `WebDriver.get`: injects a `CustomEvent("set:context")` with baggage containing `x-sl-test-name` and `x-sl-test-session-id`.
  - On `close`/`quit`: attempts `await window.$SealightsAgent.sendAllFootprints()`.
  - Also dispatches `set:context` immediately to any already-open `WebDriver` at `start_test` (covers browsers opened in Suite Setup, before the patched `get` ever fires).
- Ensure your application pages include the SeaLights Browser Agent so `window.$SealightsAgent` is available to collect web footprints.

### Playwright instrumentation
- If the `playwright` Python package is installed, the listener applies:
  - After `Page.goto`: injects the same `CustomEvent("set:context")` with baggage containing `x-sl-test-name` and `x-sl-test-session-id`.
  - On `Page.close`: calls `window.$SealightsAgent.sendAllFootprints()` to flush browser footprints before closing.
  - On `BrowserContext.close`: flushes footprints from all open pages in the context before closing.
  - Also dispatches `set:context` immediately to any already-open Playwright page at `start_test` (covers pages opened in Suite Setup, before the patched `goto` ever fires).
- The same JavaScript events are dispatched as with Selenium — the SeaLights Browser Agent must be present on the application pages.
- This works with direct Playwright Python API usage (e.g. custom Robot keyword libraries that use `playwright.sync_api`).

### Browser Library instrumentation (`robotframework-browser`)
`robotframework-browser` runs Playwright in a separate Node.js process behind a gRPC bridge, so the listener's in-process Selenium/Playwright monkey-patches never fire for it. Instead the listener:
- **Detects** the library at runtime via `BuiltIn().get_library_instance("Browser")` — no `robotframework-browser` import or dependency is required; suites that don't use it are unaffected.
- **Injects on `start_test`**: snapshots the open-page catalog (`get_browser_catalog()`) and dispatches `set:context` on every page already open (covers browsers opened in Suite Setup).
- **Re-injects on navigation**: after each keyword owned by the `Browser` library, diffs the catalog's `(page id, URL)` snapshot and re-injects `set:context` on new pages and on URL changes — required because injection uses `persist: false` (no `sessionStorage` auto-restore on a fresh document). Non-Browser keywords are skipped without reading the catalog; if the owning library can't be determined at all, the keyword is inspected anyway rather than skipped.
- **Flushes before close**: when a keyword name matches a close/teardown pattern (`Close Page`, `Close Context`, `Close Browser`, `Close All Browsers`), flushes `sendAllFootprints()` on every open catalog page before the close executes — `end_keyword` fires too late to reach an already-closed page, and the specific target page isn't resolved from the keyword name, so all open pages are flushed instead (safe since flush is idempotent and close keywords are infrequent).
- **Flushes at `end_test`**: a name-independent catch-all that flushes every page still open, regardless of how it was closed.
- **Multi-page handling**: enumerates all pages in the catalog, uses `switch_page` to target non-active pages, and always restores the originally-active page afterward (even if a page's `switch_page`/`evaluate_javascript` call fails) — switching is invisible to the running test.
- Uses an arrow-wrapped script (`() => { ... }`) since `evaluate_javascript` rejects bare statement strings, unlike Selenium's `execute_script`/Playwright's `page.evaluate`.
- **Known limitation:** app-driven navigation (e.g. a meta-refresh or scripted redirect) that occurs with no intervening Browser keyword may not get `set:context` re-injected until the next Browser keyword fires; footprints in that narrow window may be untagged. Keyword-driven navigation (`Go To`, `New Page`, a `Click` that navigates) is unaffected.
- **Prerequisite:** the same as Selenium/Playwright — your application pages must load the SeaLights Browser Agent (`window.$SealightsAgent`).

### Logging and environment
- Console log lines are prefixed with `[SeaLights]` for easy filtering.
- The listener disables default OpenTelemetry exporters by setting:
  - `OTEL_METRICS_EXPORTER=none`
  - `OTEL_TRACES_EXPORTER=none`

### Failure and disable behavior
- Missing `stagename` or missing both `bsid` and `labid` → listener disables itself and logs the reason.
- `labid` resolution outcomes:
  - `200` → sets `bsid` and continues.
  - `404`, `500`, or other errors → listener is disabled with an explanatory message.
- Session create or results upload failures are logged with HTTP status codes.

### Troubleshooting
- "Listener disabled: Stage name is required" → Provide `stagename` (3rd argument).
- "Either 'bsid' or 'labId' must be provided" → Pass at least one; for `labid` only, leave `bsid` empty.
- "Failed to open Test Session" → Verify token validity, network access, and the `x-sl-server` claim.
- "No active build session for labId" → Ensure the Lab has an active build session for the given stage.
- Selenium JS errors → Ensure your app pages load the SeaLights Browser Agent (`window.$SealightsAgent`).
- Playwright JS errors → Same as Selenium: ensure your app pages load the SeaLights Browser Agent (`window.$SealightsAgent`).
- Browser Library not detected → Ensure the suite imports `Browser` before the listener's `start_test` runs; detection failures are logged at DEBUG and the listener falls back to no-op for that path.
- Browser Library JS errors / missing footprints → Same as Selenium/Playwright: ensure your app pages load `window.$SealightsAgent`; run with `SL_LOG_LEVEL=DEBUG` to trace per-page inject/flush.

### File location
- Listener source: `robot/SLListener.py`
- This guide: `robot/SLListener.md`


