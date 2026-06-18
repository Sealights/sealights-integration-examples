import functools
import os
import socket
import sys
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
__version__ = "1.3.0"

SL_TEST_LISTENER_TRACER = "sl-test-listener"
tracer = trace.get_tracer(SL_TEST_LISTENER_TRACER)

SEALIGHTS_LOG_TAG = "[SeaLights]"
TEST_STATUS_MAP = {"FAIL": "failed", "SKIP": "skipped"}

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
        self.test_session_id = None
        self.labid = labid
        self.test_project_id = testprojectid
        self.spans = {}
        self.agent_id = str(uuid.uuid4())
        self.enabled = True
        self.disabled_reason = ""

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

        self.excluded_tests = set(self.get_excluded_tests())
        self.mark_tests_to_be_skipped(suite)

    def end_suite(self, data, result):
        if not self.test_session_id:
            return
        _sl_log(f"end_suite: '{result.longname}' | closing session {self.test_session_id}")
        test_results = self.build_test_results(result)
        self.send_test_results(test_results)
        self.end_test_session()

    def start_test(self, data, result):
        test_name = self.get_encoded_test_name(data.name)
        _sl_log(f"→ start_test: '{data.name}' | session: {self.test_session_id}", level="DEBUG")
        self.try_instrument_selenium(test_name, self.test_session_id)
        self.try_instrument_playwright(test_name, self.test_session_id)
        self.start_span(test_name)

    def end_test(self, data, result):
        test_name = self.get_encoded_test_name(data.name)
        _sl_log(f"← end_test:   '{data.name}' | {result.status}", level="DEBUG")
        test_span = self.spans.get(test_name)
        if test_span:
            context.detach(test_span["token"])
            test_span["span"].end()
            self.spans.pop(test_name)
        else:
            _sl_log(f"Test span not found for '{data.name}'", level="WARNING")

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

    def get_excluded_tests(self):
        excluded_tests = []
        recommendations = requests.get(
            f"{self.get_session_url()}/exclude-tests",
            headers=self.get_header(),
            timeout=30,
        )
        _sl_log(
            f"Retrieving Recommendations: {'OK' if recommendations.ok else f'Error {recommendations.status_code}'}"
        )
        if recommendations.status_code == 200:
            excluded_tests = recommendations.json()["data"]
        _sl_log(f"{len(excluded_tests)} Skipped tests: {excluded_tests}")
        return excluded_tests

    def resolve_bsid_from_labid(self):
        """
        Call /api/v1/lab-ids/{labId}/build-sessions/active to resolve active bsid.
        Required query params: agentId, testStage.
        Handling:
          - 200: set self.bsid from response.buildSessionId
          - 404: disable listener (no active bsid)
          - 500: exit with error
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


def _build_set_context_script(test_name, test_session_id):
    return (
        'window.dispatchEvent(new CustomEvent("set:context", '
        '{detail: {baggage: {"x-sl-test-name": "%s", "x-sl-test-session-id": "%s"}}}));'
        % (test_name, test_session_id)
    )


def _dispatch_context_to_active_drivers(test_name, test_session_id):
    """Dispatch set:context on any already-open browser.

    This handles the common case where the browser was opened in Suite Setup
    (before start_test patches WebDriver.get), so the patched get() never fires.
    Uses the _active_webdrivers set populated by the module-level tracking wrapper.
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
    """Dispatch set:context on any already-open Playwright page.

    Mirrors _dispatch_context_to_active_drivers for Playwright.
    """
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
