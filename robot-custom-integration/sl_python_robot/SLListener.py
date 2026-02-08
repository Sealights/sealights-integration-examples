import functools
import os
import uuid
from collections import Counter
from itertools import groupby

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

SL_TEST_LISTENER_TRACER = "sl-test-listener"
tracer = trace.get_tracer(SL_TEST_LISTENER_TRACER)

SEALIGHTS_LOG_TAG = "[SeaLights]"
TEST_STATUS_MAP = {"FAIL": "failed", "SKIP": "skipped"}


class SLListener:
    ROBOT_LISTENER_API_VERSION = 3

    def __init__(self, sltoken, bsid=None, stagename=None, labid=None, use_tags=False):
        self.token = sltoken
        self.base_url = self.extract_sl_endpoint()
        self.bsid = bsid
        self.stage_name = stagename
        self.excluded_tests = set()
        self.test_session_id = None
        self.labid = labid
        self.spans = {}
        self.agent_id = str(uuid.uuid4())
        self.enabled = True
        self.disabled_reason = ""
        self.use_tags = use_tags

        # Validate that at least one of bsid or labId is provided
        if not self.bsid and not self.labid:
            self.enabled = False
            self.disabled_reason = (
                "Either 'bsid' or 'labId' must be provided. SeaLights listener is disabled."
            )
        elif self.bsid and self.labid:
            # When both provided, labId will be used to resolve the active bsid
            print(
                f"{SEALIGHTS_LOG_TAG} Both 'bsId' and 'labId' provided; using 'labId' ({self.labid})."
            )

        if not self.stage_name:
            self.enabled = False
            self.disabled_reason = "Stage name is required. SeaLights listener is disabled."
            return

    def start_suite(self, suite, result):
        if not suite.tests:
            return
        if self.labid:
            self.resolve_bsid_from_labid()
        print(f"{SEALIGHTS_LOG_TAG} {len(suite.tests)} tests in suite {suite.longname}")
        if not self.enabled:
            print(f"{SEALIGHTS_LOG_TAG} Listener disabled: {self.disabled_reason}")
            return

        if not self.test_session_id:
            # initialize the test session so that all the tests can be identified by SeaLights
            self.create_test_session()
        # request the list of tests to be executed from SeaLights
        self.excluded_tests = set(self.get_excluded_tests())
        self.mark_tests_to_be_skipped(suite)

    def end_suite(self, date, result):
        if not self.test_session_id:
            return
        test_results = self.build_test_results(result)
        self.send_test_results(test_results)
        self.end_test_session()

    def start_test(self, data, result):
        test_name = self.get_encoded_test_name(self._get_test_identifier(data))
        self.try_instrument_selenium(test_name, self.test_session_id)
        self.start_span(test_name)

    def end_test(self, data, result):
        test_name = self.get_encoded_test_name(self._get_test_identifier(data))
        test_span = self.spans.get(test_name)
        if test_span:
            context.detach(test_span["token"])
            test_span["span"].end()
            self.spans.pop(test_name)
        else:
            print(f"{SEALIGHTS_LOG_TAG} Test span {test_name} not found")

    # --- Sealights API helpers ---

    def create_test_session(self):
        initialize_session_request = {
            "labId": self.labid or "",
            "testStage": self.stage_name,
            "bsid": self.bsid,
        }
        response = requests.post(
            f"{self.base_url}/v1/test-sessions",
            json=initialize_session_request,
            headers=self.get_header(),
            timeout=30,
        )
        print(f"{SEALIGHTS_LOG_TAG} Creating session with: {initialize_session_request}")
        if not response.ok:
            print(
                f"{SEALIGHTS_LOG_TAG} Failed to open Test Session (Error {response.status_code}), disabling Sealights Listener"
            )
        else:
            res = response.json()
            self.test_session_id = res["data"]["testSessionId"]
            print(
                f"{SEALIGHTS_LOG_TAG} Test session opened, testSessionId: {self.test_session_id}"
            )

    def get_excluded_tests(self):
        excluded_tests = []
        recommendations = requests.get(
            f"{self.get_session_url()}/exclude-tests", headers=self.get_header(), timeout=30
        )
        print(
            f"{SEALIGHTS_LOG_TAG} Retrieving Recommendations: {'OK' if recommendations.ok else f'Error {recommendations.status_code}'}"
        )
        if recommendations.status_code == 200:
            excluded_tests = recommendations.json()["data"]
        print(
            f"{SEALIGHTS_LOG_TAG} {len(self.excluded_tests)} Skipped tests: {excluded_tests}"
        )
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
        print(f"Resolving build session id from labId: {self.labid}")
        params = {"agentId": self.agent_id, "testStage": self.stage_name}
        try:
            response = requests.get(url, headers=self.get_header(), params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.bsid = data.get("buildSessionId")
                if not self.bsid:
                    self.disabled_reason = "Lab ID resolved successfully but no buildSessionId in response."
                    self.enabled = False
                    return
                print(
                    f"{SEALIGHTS_LOG_TAG} Resolved active build session id from labId: {self.bsid}"
                )
                return
        except requests.RequestException as e:
            self.disabled_reason = f"Network error while resolving labId {self.labid}: {str(e)}"
        if response.status_code == 404:
            self.disabled_reason = (
                f"No active build session found for labId '{self.labid}'. Sealights Listener is disabled."
            )
        elif response.status_code == 500:
            self.disabled_reason = (
                f"{SEALIGHTS_LOG_TAG} Server error while resolving bsid (HTTP 500). Sealights Listener is disabled."
            )
        else:
            self.disabled_reason = (
                f"{SEALIGHTS_LOG_TAG} Failed to resolve active build session (Error {response.status_code}). Sealights Listener is disabled."
            )
        self.enabled = False
        return

    def mark_tests_to_be_skipped(self, suite):
        # Narrow the test suite to only the recommended tests by Sealights
        all_tests = set()
        for test in suite.tests:
            try:
                test_identifier = self._get_test_identifier(test)
                print(f"{SEALIGHTS_LOG_TAG} Processing Test Case: {test}")
                all_tests.add(test_identifier)
                if test_identifier not in self.excluded_tests:
                    print(f"{SEALIGHTS_LOG_TAG} Test {test_identifier} is not excluded")
                    continue
                print(f"{SEALIGHTS_LOG_TAG} Marking test {test_identifier} as skipped")
                if not hasattr(test, "body"):
                    print(
                        f"{SEALIGHTS_LOG_TAG} Test {test.name} has no body, adding Skip keyword manually"
                    )
                    test.body = Body()  # noqa
                test.body.create_keyword(name="SKIP")
                skip_keyword = test.body.pop()
                test.body.insert(0, skip_keyword)
                if test.has_teardown():
                    print(
                        f"{SEALIGHTS_LOG_TAG} Test {test.name} has teardown, removing it by setting it to None"
                    )
                    test.teardown = None
            except Exception as e:
                print(
                    f"{SEALIGHTS_LOG_TAG} Failed to mark test {test.name} as skipped: {e}"
                )

        print(
            f"{SEALIGHTS_LOG_TAG} Total tests: {len(all_tests)}, Total excluded tests: {len(self.excluded_tests)}"
        )

    def build_test_results(self, result):
        # Collect and report test results to SeaLights including start and end time
        if self.use_tags:
            return self._build_test_results_with_tags(result)
        return self._build_test_results_default(result)

    def _build_test_results_default(self, result):
        """Build test results without tag grouping (original behavior)."""
        tests = []
        for test in result.tests:
            test_status = TEST_STATUS_MAP.get(test.status, "passed")
            start_ms = self.get_epoch_timestamp(result.starttime)
            end_ms = self.get_epoch_timestamp(result.endtime)
            tests.append(
                {
                    "name": test.name,
                    "status": test_status,
                    "start": start_ms,
                    "end": end_ms,
                }
            )
        return tests

    def _build_test_results_with_tags(self, result):
        """Build test results with tag-based grouping and aggregation."""
        test_results = []
        sorted_tests = sorted(
            result.tests, key=lambda test: self._get_test_identifier(test)
        )
        results = groupby(sorted_tests, key=lambda test: self._get_test_identifier(test))

        for test_name, tests in results:
            tests = list(tests)
            start_times_ms, end_times_ms, test_statuses = self._extract_times_and_statuses(
                tests
            )
            # Aggregate timing: earliest start, latest end
            start_ms = min(start_times_ms)
            end_ms = max(end_times_ms)
            # Aggregate status: all skipped → skipped, any failed → failed, otherwise → passed
            status_count = Counter(test_statuses)
            if status_count.get("skipped", 0) == len(tests):
                test_status = "skipped"
            elif status_count.get("failed", 0) > 0:
                test_status = "failed"
            else:
                test_status = "passed"
            test_results.append(
                {"name": test_name, "status": test_status, "start": start_ms, "end": end_ms}
            )
        return test_results

    def send_test_results(self, test_results):
        if not test_results:
            return
        print(
            f"{SEALIGHTS_LOG_TAG} {len(test_results)} Results to send: {test_results}"
        )
        response = requests.post(
            self.get_session_url(), json=test_results, headers=self.get_header(), timeout=30
        )
        if not response.ok:
            print(
                f"{SEALIGHTS_LOG_TAG} Failed to upload results (Error {response.status_code})"
            )

    def end_test_session(self):
        print(f"{SEALIGHTS_LOG_TAG} Deleting test session {self.test_session_id}")
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

    # --- Generic helpers ---

    def get_header(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

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

    def _get_test_identifier(self, test):
        """Returns the first tag if use_tags is enabled and tags exist, otherwise returns test.name."""
        if self.use_tags and hasattr(test, 'tags') and len(test.tags) > 0:
            return test.tags[0]
        return test.name

    def _extract_times_and_statuses(self, tests):
        """Extracts timing and status data from a list of tests for aggregation."""
        data = map(
            lambda test: (
                self.get_epoch_timestamp(test.starttime),
                self.get_epoch_timestamp(test.endtime),
                TEST_STATUS_MAP.get(test.status, "passed"),
            ),
            tests,
        )
        start_times_ms, end_times_ms, test_statuses = zip(*data)
        return start_times_ms, end_times_ms, test_statuses


def selenium_get_url(test_name, test_session_id):
    def inner(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            response = f(*args, **kwargs)
            try:
                self = args[0]
                script = (
                        'const testStartEvent = new CustomEvent("set:baggage", {detail: { "x-sl-test-name": "%s", "x-sl-test-session-id": "%s" }});window.dispatchEvent(testStartEvent);'
                        % (test_name, test_session_id)
                )
                self.execute_script(script)
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
            return f(*args, **kwargs)
        except Exception:
            return f(*args, **kwargs)

    return wrapper
