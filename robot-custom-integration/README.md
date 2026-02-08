### SLListener (Robot Framework wrapper) — Usage Guide

The `SLListener.py` provides a Robot Framework listener that integrates your Robot test runs with SeaLights. It creates a test session, optionally narrows execution to recommended tests, instruments Selenium for web footprints, and reports results back to SeaLights.

### What it does
- **Test session lifecycle**: Opens a SeaLights Test Session on suite start and closes it on suite end.
- **Test selection**: Fetches recommendations and marks excluded tests as `SKIP` before execution.
- **Tag-based grouping** (optional): When `use_tags=True`, uses the first tag as the test identifier, allowing multiple Robot tests to be grouped under a single SeaLights test.
- **Tracing**: Starts an OpenTelemetry span per test and sets baggage with test/session identifiers.
- **Selenium instrumentation**: Monkey-patches `WebDriver.get/close/quit` to communicate with the SeaLights Browser Agent when present.
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
5) `use_tags` (optional, default: `False`) - Enable tag-based test identification

Notes:
- Provide at least one of `bsid` or `labid`.
- If both `bsid` and `labid` are provided, the listener resolves the active build session via `labid`.
- When skipping an optional argument to provide later ones, pass an empty string to preserve positions.

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

With `use_tags` enabled:

```bash
export machine_dns="<application-under-test-url>"
export SL_TOKEN="<your-sealights-token>"
export BSID="<your-build-session-id>"
robot --listener "/path/to/repo/robot/SLListener.py:${SL_TOKEN}:${BSID}:CI Tests::True" /path/to/robot/tests.robot
```

### Tag-based Test Grouping (`use_tags=True`)

When `use_tags` is enabled, the listener uses the **first tag** of each test as its identifier instead of the test name. This enables:

1. **Grouping multiple Robot tests under one SeaLights test**: Tests with the same first tag are reported as a single test to SeaLights.

2. **Aggregated status reporting**:
   - All tests with the same tag skipped → `skipped`
   - Any test with the same tag failed → `failed`
   - Otherwise → `passed`

3. **Aggregated timing**: Uses the earliest start time and latest end time across all tests with the same tag.

4. **Exclusion by tag**: When SeaLights recommends excluding a test name, all Robot tests with that tag are skipped.

**Example**: If you have three Robot tests:
- `Login_Chrome` with tag `Login`
- `Login_Firefox` with tag `Login`
- `Checkout` with tag `Checkout`

SeaLights will see two tests: `Login` and `Checkout`. If `Login_Chrome` passes but `Login_Firefox` fails, `Login` is reported as `failed`.

**Fallback**: Tests without tags use their test name as the identifier.

### How endpoints are determined
- The listener decodes the JWT (without signature verification) and reads `x-sl-server`, e.g. `https://your.sl.server/api`.
- For Test Session APIs it uses the `sl-api` base by converting `/api` → `/sl-api`.
- When resolving `bsid` from `labid`, it calls `GET /v1/lab-ids/{labId}/build-sessions/active` on the API base with query params `agentId` and `testStage`.

### Test selection behavior
- On suite start, the listener calls `GET /v1/test-sessions/{id}/exclude-tests`.
- Test names (or tags when `use_tags=True`) returned from this endpoint are marked as `SKIP` before execution.
- If a skipped test has a teardown, it is removed to avoid side effects.
- Console logs include counts and decisions for transparency.

### Selenium instrumentation
- If `selenium` is installed, the listener applies:
  - After `WebDriver.get`: injects a `CustomEvent("set:baggage")` with `x-sl-test-name` and `x-sl-test-session-id`.
  - On `close`/`quit`: attempts `await window.$SealightsAgent.sendAllFootprints()`.
- Ensure your application pages include the SeaLights Browser Agent so `window.$SealightsAgent` is available to collect web footprints.

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

### File locations
- Listener source: `robot/SLListener.py`
- Test suite: `robot/tests/test_sl_listener.py`
- This guide: `robot/SLListener.md`

### Running tests

```bash
cd robot
python3 -m pytest tests/test_sl_listener.py -v
```

The test suite covers:
- Initialization with various combinations of bsid/labid/stagename
- Tag-based test identification (`_get_test_identifier`)
- Excluded tests matching (by name vs by tag)
- Build results aggregation (with and without tags)
- API integration with mocked responses