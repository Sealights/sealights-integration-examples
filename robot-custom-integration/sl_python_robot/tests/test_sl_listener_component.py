"""
Component tests for SLListener testProjectId support.

Spins up a lightweight mock HTTP server that records every request,
then exercises the SLListener through its public lifecycle methods
and asserts on the actual HTTP traffic.
"""

import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from types import SimpleNamespace
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import jwt as pyjwt
import pytest
import requests


# ---------------------------------------------------------------------------
# Mock HTTP server
# ---------------------------------------------------------------------------

class _RecordingHandler(BaseHTTPRequestHandler):
    """Records all incoming requests and returns canned SeaLights responses."""

    requests_log: list = []
    # exclude-tests v2 lookup: respond notReady this many times before ready.
    exclude_tests_not_ready_remaining: int = 0
    exclude_tests_names: list = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        self._record("POST", body=body)

        if "/v1/test-sessions" in self.path and "exclude" not in self.path:
            # create-session or send-results
            if self.path.rstrip("/").endswith("/test-stage"):
                self._respond(200, {"data": {"testSessionId": "ts-component-001"}})
            else:
                self._respond(200, {})
        else:
            self._respond(200, {})

    def do_GET(self):
        self._record("GET")

        if "build-sessions/active" in self.path:
            self._respond(200, {"buildSessionId": "bsid-resolved-component"})
        elif "exclude-tests" in self.path:
            if self.__class__.exclude_tests_not_ready_remaining > 0:
                self.__class__.exclude_tests_not_ready_remaining -= 1
                self._respond(
                    200,
                    {
                        "data": {
                            "metadata": {
                                "testSelectionEnabled": True,
                                "status": "notReady",
                            },
                            "excludedTests": [],
                        }
                    },
                )
            else:
                self._respond(
                    200,
                    {
                        "data": {
                            "metadata": {
                                "testSelectionEnabled": True,
                                "status": "ready",
                            },
                            "excludedTests": self.__class__.exclude_tests_names,
                        }
                    },
                )
        else:
            # Loud failure — an unrouted GET must never masquerade as "no
            # exclusions" (200 {}), which would mask a future routing typo.
            self._respond(404, {"error": f"unrouted path: {self.path}"})

    def do_DELETE(self):
        self._record("DELETE")
        self._respond(200, {})

    # -- helpers --

    def _record(self, method, body=None):
        parsed = urlparse(self.path)
        entry = {
            "method": method,
            "path": parsed.path,
            "headers": dict(self.headers),
            "query": parse_qs(parsed.query),
        }
        if body is not None:
            entry["body"] = body
        self.__class__.requests_log.append(entry)

    def _respond(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def log_message(self, format, *args):
        pass  # silence noisy access logs during tests


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_server():
    """Start a mock HTTP server on a random port; tear down after test."""
    _RecordingHandler.requests_log = []
    _RecordingHandler.exclude_tests_not_ready_remaining = 0
    _RecordingHandler.exclude_tests_names = []
    server = HTTPServer(("127.0.0.1", 0), _RecordingHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server, port
    server.shutdown()


def _make_token(port, *, use_sl_api=True):
    """Create a real JWT whose x-sl-server points at the mock server."""
    server_url = f"http://127.0.0.1:{port}/api"
    payload = {"x-sl-server": server_url}
    return pyjwt.encode(payload, "secret", algorithm="HS256")


def _make_listener(port, *, bsid=None, labid=None, testprojectid=None):
    from _sl_listener import SLListener
    token = _make_token(port)
    return SLListener(
        token,
        bsid=bsid,
        stagename="ComponentTest",
        labid=labid,
        testprojectid=testprojectid,
    )


def _get_logged_requests(mock_server_fixture):
    """Return the recorded requests list from the handler."""
    return _RecordingHandler.requests_log


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTestProjectIdHeader:
    def test_all_requests_include_header_when_set(self, mock_server):
        """Every HTTP call should carry x-sl-testprojectid when provided."""
        server, port = mock_server
        listener = _make_listener(port, bsid="bsid-1", testprojectid="proj-x")

        listener.create_test_session()
        listener.get_excluded_tests()
        listener.send_test_results([{"name": "t1", "status": "passed", "start": 0, "end": 1}])
        listener.end_test_session()

        logs = _get_logged_requests(mock_server)
        assert len(logs) >= 4, f"Expected at least 4 requests, got {len(logs)}"
        for req in logs:
            assert req["headers"].get("x-sl-testprojectid") == "proj-x", (
                f"Missing x-sl-testprojectid on {req['method']} {req['path']}"
            )

    def test_no_header_when_not_set(self, mock_server):
        """No request should carry x-sl-testprojectid when omitted."""
        server, port = mock_server
        listener = _make_listener(port, bsid="bsid-1")

        listener.create_test_session()
        listener.get_excluded_tests()
        listener.end_test_session()

        logs = _get_logged_requests(mock_server)
        assert len(logs) >= 3
        for req in logs:
            assert "x-sl-testprojectid" not in req["headers"], (
                f"Unexpected x-sl-testprojectid on {req['method']} {req['path']}"
            )


class TestCreateSessionBody:
    def test_body_contains_testprojectid(self, mock_server):
        """POST /v1/test-sessions/test-stage body should include testProjectId."""
        server, port = mock_server
        listener = _make_listener(port, bsid="bsid-1", testprojectid="proj-x")
        listener.create_test_session()

        logs = _get_logged_requests(mock_server)
        create_calls = [r for r in logs if r["method"] == "POST" and r["path"].endswith("/test-stage")]
        assert len(create_calls) == 1
        assert create_calls[0]["body"]["testProjectId"] == "proj-x"

    def test_body_excludes_testprojectid_when_not_set(self, mock_server):
        """POST /v1/test-sessions/test-stage body should NOT include testProjectId when omitted."""
        server, port = mock_server
        listener = _make_listener(port, bsid="bsid-1")
        listener.create_test_session()

        logs = _get_logged_requests(mock_server)
        create_calls = [r for r in logs if r["method"] == "POST" and r["path"].endswith("/test-stage")]
        assert len(create_calls) == 1
        assert "testProjectId" not in create_calls[0]["body"]

    def test_body_excludes_testprojectid_when_empty_string(self, mock_server):
        """POST /v1/test-sessions/test-stage body should NOT include testProjectId when empty string."""
        server, port = mock_server
        listener = _make_listener(port, bsid="bsid-1", testprojectid="")
        listener.create_test_session()

        logs = _get_logged_requests(mock_server)
        create_calls = [r for r in logs if r["method"] == "POST" and r["path"].endswith("/test-stage")]
        assert len(create_calls) == 1
        assert "testProjectId" not in create_calls[0]["body"]


class TestResolveBsidQueryParam:
    def test_query_param_present_when_set(self, mock_server):
        """GET .../build-sessions/active should have testProjectId query param."""
        server, port = mock_server
        listener = _make_listener(port, labid="lab-comp", testprojectid="proj-x")
        listener.resolve_bsid_from_labid()

        logs = _get_logged_requests(mock_server)
        resolve_calls = [r for r in logs if "build-sessions/active" in r["path"]]
        assert len(resolve_calls) == 1
        assert resolve_calls[0]["query"].get("testProjectId") == ["proj-x"]

    def test_query_param_absent_when_not_set(self, mock_server):
        """GET .../build-sessions/active should NOT have testProjectId query param."""
        server, port = mock_server
        listener = _make_listener(port, labid="lab-comp")
        listener.resolve_bsid_from_labid()

        logs = _get_logged_requests(mock_server)
        resolve_calls = [r for r in logs if "build-sessions/active" in r["path"]]
        assert len(resolve_calls) == 1
        assert "testProjectId" not in resolve_calls[0]["query"]


# ---------------------------------------------------------------------------
# get_excluded_tests() over real HTTP — v2 exclude-tests endpoint
# ---------------------------------------------------------------------------

def _fake_robot_test(name):
    return SimpleNamespace(name=name, body=MagicMock(), has_teardown=lambda: False)


class TestExcludeTestsV2:
    def test_ready_marks_matching_test_skip_and_leaves_others(self, mock_server):
        """AC13: a ready v2 response SKIP-marks the matching test only, and
        the recorded request path hits the v2 exclude-tests endpoint."""
        server, port = mock_server
        _RecordingHandler.exclude_tests_names = [{"testName": "Match Test"}]
        listener = _make_listener(port, bsid="bsid-1")
        listener.create_test_session()

        names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == (["Match Test"], True)

        listener.excluded_tests = set(names)
        match_test = _fake_robot_test("Match Test")
        other_test = _fake_robot_test("Other Test")
        suite = SimpleNamespace(tests=[match_test, other_test])
        listener.mark_tests_to_be_skipped(suite)

        match_test.body.create_keyword.assert_called_once_with(name="SKIP")
        other_test.body.create_keyword.assert_not_called()

        logs = _get_logged_requests(mock_server)
        exclude_calls = [
            r for r in logs if r["method"] == "GET" and "exclude-tests" in r["path"]
        ]
        assert len(exclude_calls) == 1
        assert "/v2/test-sessions/" in exclude_calls[0]["path"]
        assert exclude_calls[0]["path"].endswith("/exclude-tests")

    def test_not_ready_then_ready_over_real_http(self, mock_server, monkeypatch):
        """The poll loop retries a real notReady response and recovers to ready."""
        server, port = mock_server
        monkeypatch.setenv("SL_TIA_POLLING_TIMEOUT_SEC", "5")
        monkeypatch.setenv("SL_TIA_POLLING_INTERVAL_SEC", "0.05")
        _RecordingHandler.exclude_tests_not_ready_remaining = 2
        _RecordingHandler.exclude_tests_names = [{"testName": "Recovered Test"}]
        listener = _make_listener(port, bsid="bsid-1")
        listener.create_test_session()

        names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == (["Recovered Test"], True)
        logs = _get_logged_requests(mock_server)
        exclude_calls = [
            r for r in logs if r["method"] == "GET" and "exclude-tests" in r["path"]
        ]
        assert len(exclude_calls) == 3

    def test_unrouted_get_path_fails_loudly(self, mock_server):
        """AC13b: an unrouted GET must not silently look like 'no exclusions'."""
        server, port = mock_server

        response = requests.get(
            f"http://127.0.0.1:{port}/totally/unrouted/path", timeout=5
        )

        assert response.status_code == 404
