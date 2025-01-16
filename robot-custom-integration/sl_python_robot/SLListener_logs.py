import functools
import os
import datetime
import requests
import jwt
import uuid
from urllib.parse import quote as quote
from opentelemetry import trace, context, baggage

os.environ["OTEL_METRICS_EXPORTER"] = "none"
os.environ["OTEL_TRACES_EXPORTER"] = "none"

# DO NOT REMOVE THIS IMPORT
# It allows auto instrumentation for robot and pabot use cases
import opentelemetry.instrumentation.auto_instrumentation.sitecustomize

try:
    from selenium.webdriver.remote.webdriver import WebDriver
except ImportError:
    WebDriver = None

SL_TEST_LISTENER_TRACER = "sl-test-listener"
tracer = trace.get_tracer(SL_TEST_LISTENER_TRACER)

SEALIGHTS_LOG_TAG = '[SeaLights]'
TEST_STATUS_MAP = {"FAIL": "failed", "SKIP": "skipped"}


class SLListener:
    ROBOT_LISTENER_API_VERSION = 3

    LOG_API_BASE_URL = "api/v2"  # For log submissions
    SL_API_BASE_URL_V1 = "sl-api/v1"  # For test session, exclusions, etc.

    def __init__(self, bsid, stagename, labid=""):
        print(f"Initializing SLListener with: sltoken={os.getenv('SL_TOKEN')}, bsid={bsid}, stagename={stagename}, labid={labid}")
        self.token = os.getenv("SL_TOKEN")
        self.base_url = self.extract_sl_endpoint()
        self.bsid = bsid
        self.stage_name = stagename
        self.excluded_tests = set()
        self.test_session_id = None
        self.labid = labid or bsid
        self.spans = {}
        self.app_name = None

    def generate_tx_id(self):
        return str(uuid.uuid4())

    def log(self, message, level="INFO"):
        tx_id = self.generate_tx_id()
        timestamp = int(datetime.datetime.now().timestamp() * 1000)
        print(f"{SEALIGHTS_LOG_TAG} [{level}] {message}")
        log_entry = {
            "txId": tx_id,
            "logs": [message],
            "level": level,
            "appName": self.app_name,
            "timestamp": timestamp,
            "environment": {
                "agentType": "robot",
                "stageName": self.stage_name,
                "bsid": self.bsid,
            },
        }

        try:
            response = requests.post(
                f"{self.base_url}/{self.LOG_API_BASE_URL}/logsubmission",
                json=log_entry,
                headers=self.get_header(),
            )
            if not response.ok:
                print(f"{SEALIGHTS_LOG_TAG} [ERROR] Failed to send log (Error {response.status_code}): {response.text}")
        except Exception as e:
            print(f"{SEALIGHTS_LOG_TAG} [ERROR] Error sending log: {str(e)}")

    def start_suite(self, suite, result):
        if not suite.tests:
            return
        if self.app_name is None:
            build = requests.get(
                        f"{self.base_url}/{self.SL_API_BASE_URL_V1}/builds/{self.bsid}",
                        headers=self.get_header()
                    ).json()
            self.app_name = build['data']['appName']
        self.log(f"{len(suite.tests)} tests in suite {suite.longname}")
        if not self.test_session_id:
            self.create_test_session()
        self.excluded_tests = set(self.get_excluded_tests())
        self.mark_tests_to_be_skipped(suite)

    def end_suite(self, suite, result):
        if not self.test_session_id:
            return
        test_results = self.build_test_results(result)
        self.send_test_results(test_results)
        self.end_test_session()

    def start_test(self, test, result):
        test_name = self.get_encoded_test_name(test.name)
        self.try_instrument_selenium(test_name, self.test_session_id)
        self.start_span(test_name)
        self.log(f"Starting test: {test.name}")

    def try_instrument_selenium(self, test_name, test_session_id):
        if WebDriver:
            WebDriver.get = selenium_get_url(test_name, test_session_id)(WebDriver.get)
            WebDriver.close = selenium_close_quit(WebDriver.close)
            WebDriver.quit = selenium_close_quit(WebDriver.quit)

    def end_test(self, test, result):
        test_name = self.get_encoded_test_name(test.name)
        test_span = self.spans.get(test_name)
        if test_span:
            context.detach(test_span["token"])
            test_span["span"].end()
            self.spans.pop(test_name)
        else:
            self.log(f"Test span {test_name} not found", level="ERROR")

        status = "PASS" if result.passed else "FAIL"
        self.log(f"Ending test: {test.name} with status {status}", level="INFO" if result.passed else "ERROR")

    # --- Sealights API helpers ---

    def create_test_session(self):
        initialize_session_request = {'labId': self.labid, 'testStage': self.stage_name, 'bsid': self.bsid}
        response = requests.post(f"{self.base_url}/{self.SL_API_BASE_URL_V1}/test-sessions", json=initialize_session_request, headers=self.get_header())
        if not response.ok:
            self.log(f"Failed to open Test Session (Error {response.status_code})", level="ERROR")
        else:
            res = response.json()
            self.test_session_id = res["data"]["testSessionId"]
            self.log(f"Test session opened, testSessionId: {self.test_session_id}")

    def get_excluded_tests(self):
        excluded_tests = []
        recommendations = requests.get(f"{self.get_session_url()}/exclude-tests", headers=self.get_header())
        if recommendations.status_code == 200:
            excluded_tests = recommendations.json().get("data", [])
        self.log(f"{len(excluded_tests)} Skipped tests: {excluded_tests}")
        return excluded_tests

    def mark_tests_to_be_skipped(self, suite):
        all_tests = set()
        for test in suite.tests:
            all_tests.add(test.name)
            if test.name not in self.excluded_tests:
                continue
            test.body.create_keyword(name="SKIP")
            skip_keyword = test.body.pop()
            test.body.insert(0, skip_keyword)

        tests_for_execution = list(all_tests - self.excluded_tests)
        self.log(f"{len(tests_for_execution)} Tests for execution: {tests_for_execution}")

    def build_test_results(self, result):
        tests = []
        for test in result.tests:
            test_status = TEST_STATUS_MAP.get(test.status, "passed")
            start_ms = self.get_epoch_timestamp(result.starttime)
            end_ms = self.get_epoch_timestamp(result.endtime)
            tests.append({"name": test.name, "status": test_status, "start": start_ms, "end": end_ms})
        return tests

    def send_test_results(self, test_results):
        if not test_results:
            return
        self.log(f"{len(test_results)} Results to send: {test_results}")
        response = requests.post(self.get_session_url(), json=test_results, headers=self.get_header())
        if not response.ok:
            self.log(f"Failed to upload results (Error {response.status_code})", level="ERROR")

    def end_test_session(self):
        self.log(f"Deleting test session {self.test_session_id}")
        requests.delete(self.get_session_url(), headers=self.get_header())
        self.test_session_id = None

    def start_span(self, test_name):
        span = tracer.start_span(test_name)
        ctx = trace.set_span_in_context(span, context.get_current())
        ctx = baggage.set_baggage("x-sl-test-name", test_name, ctx)
        ctx = baggage.set_baggage("x-sl-test-session-id", self.test_session_id, ctx)
        token = context.attach(ctx)
        self.spans[test_name] = {"span": span, "token": token}

    # --- Generic helpers ---

    def get_header(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def get_session_url(self):
        return f"{self.base_url}/{self.SL_API_BASE_URL_V1}/test-sessions/{self.test_session_id}"

    def get_epoch_timestamp(self, value):
        dt_value = datetime.datetime.strptime(value, "%Y%m%d %H:%M:%S.%f")
        return int(dt_value.timestamp() * 1000)

    def extract_sl_endpoint(self):
        payload = jwt.decode(self.token, algorithms=["RS512"], options={"verify_signature": False})
        return payload.get("x-sl-server")[:-3]

    def get_encoded_test_name(self, test_name):
        return quote(test_name, safe="")


def selenium_get_url(test_name, test_session_id):
    def inner(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            response = f(*args, **kwargs)
            try:
                self = args[0]
                script = (
                    f'const testStartEvent = new CustomEvent("set:baggage", '
                    f'{{detail: {{"x-sl-test-name": "{test_name}", "x-sl-test-session-id": "{test_session_id}"}}}});'
                    f'window.dispatchEvent(testStartEvent);'
                )
                self.execute_script(script)
            except Exception:
                pass
            return response
        return wrapper
    return inner


def selenium_close_quit(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        try:
            self = args[0]
            script = 'await window.$SealightsAgent.sendAllFootprints();'
            self.execute_script(script)
        except Exception:
            pass
        return f(*args, **kwargs)
    return wrapper
