import functools
import json
import math
import os
import socket
import sys
import time
import uuid

os.environ["OTEL_METRICS_EXPORTER"] = "none"
os.environ["OTEL_TRACES_EXPORTER"] = "none"
# DO NOT REMOVE THIS IMPORT
# It allows auto instrumentation for robot and pabot use cases
from urllib.parse import quote as quote
import datetime
import requests
import jwt
from opentelemetry import trace, context, baggage
from robot.libraries.BuiltIn import BuiltIn

try:
    from selenium.webdriver.remote.webdriver import WebDriver
except ImportError:
    WebDriver = None

try:
    from playwright.sync_api import Page as PlaywrightPage
    from playwright.sync_api import BrowserContext as PlaywrightBrowserContext
except ImportError:
    PlaywrightPage = None
    PlaywrightBrowserContext = None

# Bump this string on every change to the listener.
__version__ = "1.5.0"

SL_TEST_LISTENER_TRACER = "sl-test-listener"
tracer = trace.get_tracer(SL_TEST_LISTENER_TRACER)

SEALIGHTS_LOG_TAG = "[SeaLights]"
TEST_STATUS_MAP = {"FAIL": "failed", "SKIP": "skipped"}

# Shared set:context baggage keys (used by both the Selenium/Playwright and
# Browser Library script builders so the two paths cannot silently drift).
BAGGAGE_KEY_TEST_NAME = "x-sl-test-name"
BAGGAGE_KEY_TEST_SESSION_ID = "x-sl-test-session-id"

# Browser Library flush script — evaluate_javascript requires an arrow-wrapped function.
BROWSER_LIBRARY_FLUSH_SCRIPT = "() => { window.$SealightsAgent.sendAllFootprints(); }"

# start_keyword close/teardown detection (matched as a case-insensitive substring
# so a library prefix like "Browser.Close Page" still matches).
BROWSER_LIBRARY_CLOSE_KEYWORD_PATTERNS = (
    "close page",
    "close context",
    "close browser",
    "close all browsers",
)

# ── Log level control ─────────────────────────────────────────────────────────
# Control verbosity without changing the robot command line.
# Set SL_LOG_LEVEL=DEBUG for full API request/response output and span lifecycle.
# Set SL_LOG_LEVEL=WARNING to suppress normal progress messages.
# Default: INFO
_LOG_LEVELS = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40}
_EFFECTIVE_LOG_LEVEL = _LOG_LEVELS.get(
    os.environ.get("SL_LOG_LEVEL", "INFO").upper(), 20
)


def _sl_log(message, level="INFO"):
    """Print a SeaLights log line if the effective log level permits it."""
    if _LOG_LEVELS.get(level.upper(), 20) >= _EFFECTIVE_LOG_LEVEL:
        print(f"{SEALIGHTS_LOG_TAG} [{level}] {message}")


_active_webdrivers = set()

if WebDriver:
    _original_webdriver_get = WebDriver.get

    @functools.wraps(_original_webdriver_get)
    def _tracking_get(self, *args, **kwargs):
        _active_webdrivers.add(self)
        return _original_webdriver_get(self, *args, **kwargs)

    WebDriver.get = _tracking_get

_active_playwright_pages = set()

if PlaywrightPage:
    _original_playwright_goto = PlaywrightPage.goto

    @functools.wraps(_original_playwright_goto)
    def _tracking_goto(self, *args, **kwargs):
        _active_playwright_pages.add(self)
        return _original_playwright_goto(self, *args, **kwargs)

    PlaywrightPage.goto = _tracking_goto


class SLListener:
    ROBOT_LISTENER_API_VERSION = 3

    def __init__(
        self, sltoken, bsid=None, stagename=None, labid=None, testprojectid=None
    ):
        self.token = sltoken
        self.base_url = self.extract_sl_endpoint()
        self.bsid = bsid
        self.stage_name = stagename
        self.excluded_tests = set()
        self.tia_resolved = False
        self.tia_attempted = False
        self.test_session_id = None
        self.labid = labid
        self.test_project_id = testprojectid
        self.spans = {}
        self.agent_id = str(uuid.uuid4())
        self.enabled = True
        self.disabled_reason = ""

        # Browser Library (robotframework-browser) state — seeded here (never
        # first-assigned in start_test) so start_keyword/end_keyword are safe
        # no-ops even when fired during Suite Setup, before the first start_test.
        self.browser_lib = None
        self.bl_page_snapshot = {}
        self.bl_test_baggage = None
        # Library imports are suite-scoped in Robot Framework, so detection is
        # cached per suite (reset in start_suite) rather than re-attempted —
        # and re-raising/swallowing an exception — on every single test.
        self._bl_checked = False

        # Validate that at least one of bsid or labId is provided
        if not self.bsid and not self.labid:
            self.enabled = False
            self.disabled_reason = "Either 'bsid' or 'labId' must be provided. SeaLights listener is disabled."
        elif self.bsid and self.labid:
            _sl_log(
                f"Both 'bsId' and 'labId' provided; using the supplied bsId ('{self.bsid}') — labId ignored.",
                level="WARNING",
            )

        if self.test_project_id:
            _sl_log(f"Using testProjectId: {self.test_project_id}")

        if not self.stage_name:
            self.enabled = False
            self.disabled_reason = (
                "Stage name is required. SeaLights listener is disabled."
            )

        _sl_log(f"── SLListener v{__version__} ──────────────────────────────────")
        _sl_log(f"  Host      : {socket.gethostname()}")
        _sl_log(f"  PID       : {os.getpid()}")
        _sl_log(f"  Python    : {sys.version.split()[0]}")
        _sl_log(f"  Endpoint  : {self.base_url}")
        _sl_log(f"  Stage     : {self.stage_name or '(missing — listener disabled)'}")
        _sl_log(f"  labId     : {self.labid or '(none)'}")
        _sl_log(f"  bsId      : {self.bsid or '(resolving from labId)'}")
        _sl_log(f"  agentId   : {self.agent_id}")
        _sl_log(f"  projId    : {self.test_project_id or '(none)'}")
        _sl_log(f"  LogLevel  : {os.environ.get('SL_LOG_LEVEL', 'INFO (default)')}")
        _sl_log("─────────────────────────────────────────────────────────────────")
        if not self.enabled:
            _sl_log(f"DISABLED: {self.disabled_reason}", level="WARNING")

    def start_suite(self, suite, result):
        self._bl_checked = False
        if not suite.tests:
            _sl_log(
                f"start_suite: '{suite.longname}' — no direct tests, skipping",
                level="DEBUG",
            )
            return

        _sl_log(
            f"start_suite: '{suite.longname}' | {len(suite.tests)} test(s) | source: {suite.source}"
        )

        if self.labid and not self.bsid:
            self.resolve_bsid_from_labid()

        if not self.enabled:
            _sl_log(f"Listener disabled: {self.disabled_reason}", level="WARNING")
            return

        if not self.test_session_id:
            _sl_log("No active session — opening new one")
            self.create_test_session()
        else:
            _sl_log(f"Reusing existing session: {self.test_session_id}", level="DEBUG")

        if not self.tia_resolved:
            names, terminal = self.get_excluded_tests(poll=not self.tia_attempted)
            self.tia_attempted = True
            if terminal:
                self.excluded_tests = set(names)
                self.tia_resolved = True
        self.mark_tests_to_be_skipped(suite)

    def end_suite(self, data, result):
        if not self.test_session_id:
            return
        _sl_log(
            f"end_suite: '{result.longname}' | closing session {self.test_session_id}"
        )
        test_results = self.build_test_results(result)
        self.send_test_results(test_results)
        self.end_test_session()

    def start_test(self, data, result):
        test_name = self.get_encoded_test_name(data.name)
        _sl_log(
            f"→ start_test: '{data.name}' | session: {self.test_session_id}",
            level="DEBUG",
        )
        self.try_instrument_selenium(test_name, self.test_session_id)
        self.try_instrument_playwright(test_name, self.test_session_id)
        self.try_instrument_browser_library(test_name, self.test_session_id)
        self.start_span(test_name)

    def start_keyword(self, data, result):
        """Flush before close — end_keyword fires too late for an
        already-closed page. See SLListener.md § Browser Library instrumentation.
        """
        if self.browser_lib is None:
            return
        keyword_name = (getattr(data, "name", "") or "").lower()
        if not any(
            pattern in keyword_name
            for pattern in BROWSER_LIBRARY_CLOSE_KEYWORD_PATTERNS
        ):
            return
        _sl_log(
            f"Browser Library: close-pattern flush before '{data.name}'", level="DEBUG"
        )
        catalog = self._get_browser_catalog()
        page_ids = list(_flatten_browser_catalog(catalog).keys())
        self._run_on_browser_library_pages(
            page_ids,
            BROWSER_LIBRARY_FLUSH_SCRIPT,
            _find_active_browser_page_id(catalog),
        )

    def end_test(self, data, result):
        test_name = self.get_encoded_test_name(data.name)
        _sl_log(f"← end_test:   '{data.name}' | {result.status}", level="DEBUG")
        self._flush_browser_library()
        test_span = self.spans.get(test_name)
        if test_span:
            context.detach(test_span["token"])
            test_span["span"].end()
            self.spans.pop(test_name)
        else:
            _sl_log(f"Test span not found for '{data.name}'", level="WARNING")

    def _flush_browser_library(self):
        """end_test catch-all: flush every page still open, then clear per-test state."""
        if self.browser_lib is None:
            return
        catalog = self._get_browser_catalog()
        page_ids = list(_flatten_browser_catalog(catalog).keys())
        _sl_log(f"Browser Library: end_test flush count={len(page_ids)}", level="DEBUG")
        self._run_on_browser_library_pages(
            page_ids,
            BROWSER_LIBRARY_FLUSH_SCRIPT,
            _find_active_browser_page_id(catalog),
        )
        self.bl_page_snapshot = {}
        self.bl_test_baggage = None

    def end_keyword(self, data, result):
        """Re-injects context on new/navigated Browser pages; gated on the
        owning library (RF 7.4.2: lives on `result`, not `data`). See
        SLListener.md § Browser Library instrumentation.
        """
        if self.browser_lib is None:
            return
        if self.bl_test_baggage is None:
            # No live test (e.g. a Browser keyword in Suite Teardown, after
            # end_test already cleared state) — nothing to attribute footprints to.
            return
        owner = getattr(result, "owner", None) or getattr(result, "libname", None)
        if owner is not None and owner != "Browser":
            return

        catalog = self._get_browser_catalog()
        current_snapshot = _flatten_browser_catalog(catalog)
        changed_page_ids = _diff_browser_catalog_pages(
            self.bl_page_snapshot, current_snapshot
        )
        if changed_page_ids:
            test_name, test_session_id = self.bl_test_baggage or (None, None)
            script = _build_browser_library_context_script(test_name, test_session_id)
            _sl_log(
                f"Browser Library: navigation re-inject for {changed_page_ids}",
                level="DEBUG",
            )
            self._run_on_browser_library_pages(
                changed_page_ids, script, _find_active_browser_page_id(catalog)
            )
        self.bl_page_snapshot = current_snapshot

    # --- Sealights API helpers ---

    def create_test_session(self):
        initialize_session_request = {
            "labId": self.labid or "",
            "testStage": self.stage_name,
            "bsid": self.bsid,
        }
        if self.test_project_id:
            initialize_session_request["testProjectId"] = self.test_project_id
        _sl_log(f"Creating session with: {initialize_session_request}", level="DEBUG")
        response = requests.post(
            f"{self.base_url}/v1/test-sessions/test-stage",
            json=initialize_session_request,
            headers=self.get_header(),
            timeout=30,
        )
        if not response.ok:
            _sl_log(
                f"Failed to open Test Session (Error {response.status_code}), disabling Sealights Listener",
                level="ERROR",
            )
        else:
            res = response.json()
            self.test_session_id = res["data"]["testSessionId"]
            _sl_log(f"Test session opened, testSessionId: {self.test_session_id}")

    def get_exclude_tests_url(self):
        return f"{self.base_url}/v2/test-sessions/{self.test_session_id}/exclude-tests"

    def _fetch_exclusions_once(self):
        """Single GET against the v2 exclude-tests endpoint.

        Returns (names, terminal, retryable). `retryable` is True only for a
        200 response with status "notReady" — every other failure (transport
        error, non-200, unparsable/non-dict body) is terminal-with-no-names
        and non-retryable so the poll loop can break immediately (fail-open).
        """
        try:
            response = requests.get(
                self.get_exclude_tests_url(),
                headers=self.get_header(),
                timeout=30,
            )
        except requests.RequestException as e:
            _sl_log(f"TIA: request failed — {e}", level="WARNING")
            return [], False, False

        if response.status_code != 200:
            _sl_log(f"TIA: unexpected status {response.status_code}", level="WARNING")
            return [], False, False

        try:
            body = response.json()
        except ValueError as e:
            _sl_log(f"TIA: failed to parse response — {e}", level="WARNING")
            return [], False, False

        if not isinstance(body, dict):
            _sl_log("TIA: response body is not an object", level="WARNING")
            return [], False, False

        payload = body["data"] if "data" in body else body
        metadata = payload.get("metadata") or {}
        enabled = metadata.get("testSelectionEnabled")
        status = metadata.get("status")

        if enabled is True and status == "ready":
            names = [
                t["testName"]
                for t in (payload.get("excludedTests") or [])
                if isinstance(t, dict) and t.get("testName")
            ]
            _sl_log(f"TIA: enabled={enabled} status={status} → {len(names)} excluded")
            return names, True, False

        if enabled is True and status == "notReady":
            _sl_log(f"TIA: enabled={enabled} status={status} → 0 excluded")
            return [], False, True

        _sl_log(f"TIA: enabled={enabled} status={status} → 0 excluded")
        return [], True, False

    def get_excluded_tests(self, poll=True):
        if not self.test_session_id:
            return [], False

        timeout = self._read_positive_env("SL_TIA_POLLING_TIMEOUT_SEC", 60)
        interval = self._read_positive_env("SL_TIA_POLLING_INTERVAL_SEC", 5)

        if not poll or timeout == 0 or interval == 0:
            names, terminal, _retryable = self._fetch_exclusions_once()
            return names, terminal

        deadline = time.monotonic() + timeout
        names, terminal, retryable = self._fetch_exclusions_once()
        retry_count = 0
        while retryable and not terminal and time.monotonic() < deadline:
            sleep_for = max(0, min(interval, deadline - time.monotonic()))
            if sleep_for == 0:
                break
            retry_count += 1
            _sl_log(
                f"TIA notReady — retry {retry_count} in {sleep_for}s", level="DEBUG"
            )
            time.sleep(sleep_for)
            names, terminal, retryable = self._fetch_exclusions_once()

        if retryable and not terminal:
            _sl_log(
                "TIA: polling deadline reached while still notReady", level="WARNING"
            )

        return names, terminal

    def _read_positive_env(self, name, default):
        raw = os.environ.get(name)
        if raw is None:
            return default
        try:
            value = float(raw)
        except (TypeError, ValueError):
            _sl_log(
                f"Invalid value for {name}={raw!r}; using default {default}",
                level="WARNING",
            )
            return default
        if not math.isfinite(value) or value < 0:
            _sl_log(
                f"Invalid value for {name}={raw!r}; using default {default}",
                level="WARNING",
            )
            return default
        return value

    def resolve_bsid_from_labid(self):
        """Resolves bsid via GET /v1/lab-ids/{labId}/build-sessions/active.
        See SLListener.md § How endpoints are determined / Failure and
        disable behavior.
        """
        api_endpoint = self.extract_sl_endpoint(replace_api_with_sl_api=False)
        url = f"{api_endpoint}/v1/lab-ids/{self.labid}/build-sessions/active"
        _sl_log(f"Resolving build session id from labId: {self.labid}")
        params = {"agentId": self.agent_id, "testStage": self.stage_name}
        if self.test_project_id:
            params["testProjectId"] = self.test_project_id
        try:
            response = requests.get(
                url, headers=self.get_header(), params=params, timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                self.bsid = data.get("buildSessionId")
                if not self.bsid:
                    self.disabled_reason = "Lab ID resolved successfully but no buildSessionId in response."
                    self.enabled = False
                    return
                _sl_log(f"Resolved active build session id from labId: {self.bsid}")
                return
        except requests.RequestException as e:
            self.disabled_reason = (
                f"Network error while resolving labId {self.labid}: {str(e)}"
            )
            self.enabled = False
            return
        if response.status_code == 404:
            self.disabled_reason = f"No active build session found for labId '{self.labid}'. Sealights Listener is disabled."
        elif response.status_code == 500:
            self.disabled_reason = "Server error while resolving bsid (HTTP 500). Sealights Listener is disabled."
        else:
            self.disabled_reason = f"Failed to resolve active build session (Error {response.status_code}). Sealights Listener is disabled."
        self.enabled = False
        return

    def mark_tests_to_be_skipped(self, suite):
        # Narrow the test suite to only the recommended tests by Sealights
        all_tests = set()
        for test in suite.tests:
            try:
                _sl_log(f"Processing Test Case: {test}", level="DEBUG")
                all_tests.add(test.name)
                if test.name not in self.excluded_tests:
                    _sl_log(f"Test {test.name} is not excluded", level="DEBUG")
                    continue
                _sl_log(f"Marking test {test.name} as skipped")
                if not hasattr(test, "body"):
                    _sl_log(
                        f"Test {test.name} has no body, adding Skip keyword manually",
                        level="WARNING",
                    )
                    test.body = Body()  # noqa
                test.body.create_keyword(name="SKIP")
                skip_keyword = test.body.pop()
                test.body.insert(0, skip_keyword)
                if test.has_teardown():
                    _sl_log(
                        f"Test {test.name} has teardown, removing it by setting it to None",
                        level="DEBUG",
                    )
                    test.teardown = None
            except Exception as e:
                _sl_log(
                    f"Failed to mark test {test.name} as skipped: {e}",
                    level="ERROR",
                )

        _sl_log(
            f"Total tests: {len(all_tests)}, Total excluded tests: {len(self.excluded_tests)}"
        )

    def build_test_results(self, result):
        # Collect and report test results to SeaLights including start and end time
        tests = []
        for test in result.tests:
            test_status = TEST_STATUS_MAP.get(test.status, "passed")
            start_ms = self.get_epoch_timestamp(test.starttime) if test.starttime else 0
            end_ms = self.get_epoch_timestamp(test.endtime) if test.endtime else 0
            _sl_log(
                f"build_test_results: '{test.name}' | {test_status} | duration: {end_ms - start_ms}ms",
                level="DEBUG",
            )
            tests.append(
                {
                    "name": test.name,
                    "status": test_status,
                    "start": start_ms,
                    "end": end_ms,
                }
            )
        return tests

    def send_test_results(self, test_results):
        if not test_results:
            return
        _sl_log(f"{len(test_results)} Results to send: {test_results}", level="DEBUG")
        response = requests.post(
            self.get_session_url(),
            json=test_results,
            headers=self.get_header(),
            timeout=30,
        )
        if not response.ok:
            _sl_log(
                f"Failed to upload results (Error {response.status_code})",
                level="ERROR",
            )

    def end_test_session(self):
        _sl_log(f"Deleting test session {self.test_session_id}")
        requests.delete(self.get_session_url(), headers=self.get_header(), timeout=30)
        self.test_session_id = ""

    def start_span(self, test_name):
        test_span = self.spans.get(test_name)
        if test_span:
            return test_span
        span = tracer.start_span(test_name)
        ctx = trace.set_span_in_context(span, context.get_current())
        ctx = baggage.set_baggage("x-sl-test-name", test_name, ctx)
        ctx = baggage.set_baggage("x-sl-test-session-id", self.test_session_id, ctx)
        token = context.attach(ctx)
        self.spans[test_name] = {"span": span, "token": token}
        return span

    def try_instrument_selenium(self, test_name, test_session_id):
        if WebDriver:
            WebDriver.get = selenium_get_url(test_name, test_session_id)(WebDriver.get)
            WebDriver.close = selenium_close_quit(WebDriver.close)
            WebDriver.quit = selenium_close_quit(WebDriver.quit)
        _dispatch_context_to_active_drivers(test_name, test_session_id)

    def try_detect_browser_library(self):
        """Never raises to Robot — get_library_instance() raises when the
        library isn't imported, the common case for Selenium/Playwright-only
        suites. Cached per suite; see the _bl_checked reset in start_suite.
        """
        if self._bl_checked:
            return self.browser_lib
        self._bl_checked = True
        try:
            instance = BuiltIn().get_library_instance("Browser")
        except Exception:
            instance = None
        self.browser_lib = instance or None
        return self.browser_lib

    def try_instrument_playwright(self, test_name, test_session_id):
        if PlaywrightPage:
            PlaywrightPage.goto = playwright_goto(test_name, test_session_id)(
                PlaywrightPage.goto
            )
            PlaywrightPage.close = playwright_close(PlaywrightPage.close)
        if PlaywrightBrowserContext:
            PlaywrightBrowserContext.close = playwright_context_close(
                PlaywrightBrowserContext.close
            )
        _dispatch_context_to_active_pages(test_name, test_session_id)

    def try_instrument_browser_library(self, test_name, test_session_id):
        """Injects set:context on pre-existing pages (Suite Setup case).
        See SLListener.md § Browser Library instrumentation.
        """
        self.try_detect_browser_library()
        if self.browser_lib is None:
            return
        self.bl_test_baggage = (test_name, test_session_id)
        catalog = self._get_browser_catalog()
        self.bl_page_snapshot = _flatten_browser_catalog(catalog)
        script = _build_browser_library_context_script(test_name, test_session_id)
        self._run_on_browser_library_pages(
            list(self.bl_page_snapshot.keys()),
            script,
            _find_active_browser_page_id(catalog),
        )

    def _get_browser_catalog(self):
        """Read the Browser Library catalog, swallowing errors (never disables the listener)."""
        try:
            return self.browser_lib.get_browser_catalog()
        except Exception as e:
            _sl_log(f"Browser Library: get_browser_catalog failed: {e}", level="DEBUG")
            return []

    def _run_on_browser_library_pages(self, page_ids, script, active_page_id):
        """Runs `script` on each page, restoring the originally-active page
        (only if we actually switched away from it) even if a per-page call
        fails mid-loop. See SLListener.md § Browser Library instrumentation
        ("Multi-page handling").
        """
        if not page_ids:
            return
        switched = False
        try:
            for page_id in page_ids:
                try:
                    if page_id != active_page_id:
                        self.browser_lib.switch_page(page_id)
                        switched = True
                    self.browser_lib.evaluate_javascript(None, script)
                    _sl_log(
                        f"Browser Library: ran script on page {page_id}", level="DEBUG"
                    )
                except Exception as e:
                    _sl_log(
                        f"Browser Library: script failed for page {page_id}: {e}",
                        level="DEBUG",
                    )
        finally:
            if active_page_id is not None and switched:
                try:
                    self.browser_lib.switch_page(active_page_id)
                except Exception as e:
                    _sl_log(
                        f"Browser Library: failed to restore active page {active_page_id}: {e}",
                        level="WARNING",
                    )

    # --- Generic helpers ---

    def get_header(self):
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        if self.test_project_id:
            headers["x-sl-testprojectid"] = self.test_project_id
        return headers

    def get_session_url(self):
        return f"{self.base_url}/v1/test-sessions/{self.test_session_id}"

    def get_epoch_timestamp(self, value):
        dt_value = datetime.datetime.strptime(value, "%Y%m%d %H:%M:%S.%f")
        return int(dt_value.timestamp() * 1000)

    def extract_sl_endpoint(self, replace_api_with_sl_api=True):
        payload = jwt.decode(
            self.token, algorithms=["RS512"], options={"verify_signature": False}
        )
        api_base_url = payload.get("x-sl-server")
        if replace_api_with_sl_api:
            return f"{api_base_url.replace('/api', '/sl-api')}"
        return api_base_url

    def get_encoded_test_name(self, test_name):
        return quote(test_name, safe="")


def _json_str(value):
    """json.dumps a value as a string, stringifying non-str input first so the
    output matches the legacy %s-formatting behavior (e.g. None -> "None")
    while still escaping JS-unsafe characters like embedded quotes.
    """
    return json.dumps(str(value))


def _build_set_context_script(test_name, test_session_id):
    return (
        'window.dispatchEvent(new CustomEvent("set:context", '
        "{detail: {baggage: {%s: %s, %s: %s}}}));"
        % (
            json.dumps(BAGGAGE_KEY_TEST_NAME),
            _json_str(test_name),
            json.dumps(BAGGAGE_KEY_TEST_SESSION_ID),
            _json_str(test_session_id),
        )
    )


def _build_browser_library_context_script(test_name, test_session_id):
    """Arrow-wrapped: evaluate_javascript rejects bare statement strings.
    See SLListener.md § Browser Library instrumentation.
    """
    return (
        '() => { window.dispatchEvent(new CustomEvent("set:context", '
        "{detail: {persist: false, baggage: {%s: %s, %s: %s}}})); }"
        % (
            json.dumps(BAGGAGE_KEY_TEST_NAME),
            _json_str(test_name),
            json.dumps(BAGGAGE_KEY_TEST_SESSION_ID),
            _json_str(test_session_id),
        )
    )


def _flatten_browser_catalog(catalog):
    """Flatten a Browser Library get_browser_catalog() structure into {page_id: url}.

    Expected shape: [{"contexts": [{"pages": [{"id": ..., "url": ...}, ...]}, ...]}, ...]
    """
    pages = {}
    for browser in catalog or []:
        for ctx in browser.get("contexts") or []:
            for page in ctx.get("pages") or []:
                page_id = page.get("id")
                if page_id is not None:
                    pages[page_id] = page.get("url")
    return pages


def _find_active_browser_page_id(catalog):
    """Return the globally active page id from a Browser Library catalog, or None.

    Every browser/context in the catalog carries its own last-active
    "activePage" (per get_browser_catalog()), even ones that aren't
    currently focused — so the true active page is only the one under the
    browser flagged "activeBrowser" and that browser's "activeContext",
    mirroring Browser Library's own _get_active_triplet() lookup.
    """
    for browser in catalog or []:
        if not browser.get("activeBrowser"):
            continue
        active_context_id = browser.get("activeContext")
        for ctx in browser.get("contexts") or []:
            if ctx.get("id") == active_context_id:
                return ctx.get("activePage")
    return None


def _diff_browser_catalog_pages(previous_snapshot, current_snapshot):
    """Return page ids in current_snapshot that are new or whose URL changed.

    Handles nullable URLs: None->url and url->None are changes; None->None is not.
    Pages removed from current_snapshot (already closed) are not reported.
    """
    return [
        page_id
        for page_id, url in current_snapshot.items()
        if page_id not in previous_snapshot or previous_snapshot[page_id] != url
    ]


def _dispatch_context_to_active_drivers(test_name, test_session_id):
    """Covers browsers opened in Suite Setup, before start_test patches
    WebDriver.get. See SLListener.md § Selenium instrumentation.
    """
    if not _active_webdrivers:
        return
    script = _build_set_context_script(test_name, test_session_id)
    for driver in list(_active_webdrivers):
        try:
            driver.execute_script(script)
        except Exception:
            _active_webdrivers.discard(driver)


def _dispatch_context_to_active_pages(test_name, test_session_id):
    """Playwright counterpart to _dispatch_context_to_active_drivers."""
    if not _active_playwright_pages:
        return
    script = _build_set_context_script(test_name, test_session_id)
    for page in list(_active_playwright_pages):
        try:
            page.evaluate(script)
        except Exception:
            _active_playwright_pages.discard(page)


def selenium_get_url(test_name, test_session_id):
    def inner(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            response = f(*args, **kwargs)
            try:
                self = args[0]
                self.execute_script(
                    _build_set_context_script(test_name, test_session_id)
                )
                return response
            except Exception:
                return response

        return wrapper

    return inner


def selenium_close_quit(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        try:
            self = args[0]
            script = "await window.$SealightsAgent.sendAllFootprints();"
            self.execute_script(script)
            _active_webdrivers.discard(self)
            return f(*args, **kwargs)
        except Exception:
            _active_webdrivers.discard(args[0] if args else None)
            return f(*args, **kwargs)

    return wrapper


def playwright_goto(test_name, test_session_id):
    def inner(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            response = f(*args, **kwargs)
            try:
                page = args[0]
                page.evaluate(_build_set_context_script(test_name, test_session_id))
                return response
            except Exception:
                return response

        return wrapper

    return inner


def _flush_playwright_page(page):
    """Flush SeaLights footprints from a single Playwright page."""
    try:
        page.evaluate("window.$SealightsAgent.sendAllFootprints()")
    except Exception:
        pass


def playwright_close(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        try:
            page = args[0]
            _flush_playwright_page(page)
            _active_playwright_pages.discard(page)
            return f(*args, **kwargs)
        except Exception:
            _active_playwright_pages.discard(args[0] if args else None)
            return f(*args, **kwargs)

    return wrapper


def playwright_context_close(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        try:
            context = args[0]
            for page in context.pages:
                _flush_playwright_page(page)
                _active_playwright_pages.discard(page)
            return f(*args, **kwargs)
        except Exception:
            return f(*args, **kwargs)

    return wrapper
