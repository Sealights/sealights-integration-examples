"""
Tests for the example SLListener aligned with the Python agent listener.

All HTTP calls and JWT decoding are mocked so these tests run with no
network or token dependencies.
"""

import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from SLListener import SLListener

FAKE_TOKEN = "fake.jwt.token"
MOCK_JWT_PAYLOAD = {"x-sl-server": "https://test.sealights.io/api"}


def _make_listener(**overrides):
    defaults = dict(sltoken=FAKE_TOKEN, bsid="bsid-1", stagename="CI")
    defaults.update(overrides)
    with patch("SLListener.jwt.decode", return_value=MOCK_JWT_PAYLOAD):
        return SLListener(**defaults)


class MockBody:
    def __init__(self):
        self._keywords = []

    def create_keyword(self, name):
        self._keywords.append(name)

    def pop(self):
        return self._keywords.pop() if self._keywords else None

    def insert(self, index, item):
        self._keywords.insert(index, item)


class MockTest:
    def __init__(
        self,
        name,
        status="PASS",
        starttime="20240101 10:00:00.000",
        endtime="20240101 10:00:01.000",
    ):
        self.name = name
        self.status = status
        self.starttime = starttime
        self.endtime = endtime
        self.body = MockBody()
        self._has_teardown = False
        self.teardown = None

    def has_teardown(self):
        return self._has_teardown


class MockSuite:
    def __init__(self, tests=None):
        self.tests = tests or []
        self.longname = "MockSuite"


class MockResult:
    def __init__(
        self,
        tests=None,
        starttime="20240101 10:00:00.000",
        endtime="20240101 10:00:05.000",
    ):
        self.tests = tests or []
        self.starttime = starttime
        self.endtime = endtime


class TestInit:
    def test_stores_test_project_id(self):
        listener = _make_listener(testprojectid="my-project")
        assert listener.test_project_id == "my-project"

    def test_test_project_id_defaults_to_none(self):
        listener = _make_listener()
        assert listener.test_project_id is None


class TestGetHeader:
    def test_includes_testprojectid_when_set(self):
        listener = _make_listener(testprojectid="proj-123")
        headers = listener.get_header()
        assert headers["x-sl-testprojectid"] == "proj-123"
        assert "Authorization" in headers
        assert "Content-Type" in headers

    def test_excludes_testprojectid_when_none(self):
        listener = _make_listener()
        headers = listener.get_header()
        assert "x-sl-testprojectid" not in headers

    def test_excludes_testprojectid_when_empty_string(self):
        listener = _make_listener(testprojectid="")
        headers = listener.get_header()
        assert "x-sl-testprojectid" not in headers


class TestCreateTestSession:
    @patch("SLListener.requests")
    def test_body_includes_testprojectid(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener(testprojectid="proj-123")
        listener.create_test_session()

        body = mock_requests.post.call_args.kwargs["json"]
        assert body["testProjectId"] == "proj-123"

    @patch("SLListener.requests")
    def test_body_excludes_testprojectid_when_not_set(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener()
        listener.create_test_session()

        body = mock_requests.post.call_args.kwargs["json"]
        assert "testProjectId" not in body

    @patch("SLListener.requests")
    def test_body_excludes_testprojectid_when_empty_string(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener(testprojectid="")
        listener.create_test_session()

        body = mock_requests.post.call_args.kwargs["json"]
        assert "testProjectId" not in body

    @patch("SLListener.requests")
    def test_sends_testprojectid_header(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener(testprojectid="proj-123")
        listener.create_test_session()

        headers = mock_requests.post.call_args.kwargs["headers"]
        assert headers["x-sl-testprojectid"] == "proj-123"


class TestResolveBsidFromLabid:
    @patch("SLListener.jwt.decode", return_value=MOCK_JWT_PAYLOAD)
    @patch("SLListener.requests")
    def test_includes_testprojectid_query_param(self, mock_requests, _mock_jwt):
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=lambda: {"buildSessionId": "resolved-bsid"}
        )
        listener = _make_listener(labid="lab-1", testprojectid="proj-123")
        listener.resolve_bsid_from_labid()

        params = mock_requests.get.call_args.kwargs["params"]
        assert params["testProjectId"] == "proj-123"

    @patch("SLListener.jwt.decode", return_value=MOCK_JWT_PAYLOAD)
    @patch("SLListener.requests")
    def test_excludes_testprojectid_when_none(self, mock_requests, _mock_jwt):
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=lambda: {"buildSessionId": "resolved-bsid"}
        )
        listener = _make_listener(labid="lab-1")
        listener.resolve_bsid_from_labid()

        params = mock_requests.get.call_args.kwargs["params"]
        assert "testProjectId" not in params

    @patch("SLListener.jwt.decode", return_value=MOCK_JWT_PAYLOAD)
    @patch("SLListener.requests")
    def test_sends_testprojectid_header(self, mock_requests, _mock_jwt):
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=lambda: {"buildSessionId": "resolved-bsid"}
        )
        listener = _make_listener(labid="lab-1", testprojectid="proj-123")
        listener.resolve_bsid_from_labid()

        headers = mock_requests.get.call_args.kwargs["headers"]
        assert headers["x-sl-testprojectid"] == "proj-123"


class TestNameBasedBehavior:
    def test_marks_excluded_tests_by_test_name(self):
        listener = _make_listener()
        test_login = MockTest(name="TestLogin")
        test_logout = MockTest(name="TestLogout")
        suite = MockSuite(tests=[test_login, test_logout])

        listener.excluded_tests = {"TestLogin"}
        listener.mark_tests_to_be_skipped(suite)

        assert "SKIP" in test_login.body._keywords
        assert "SKIP" not in test_logout.body._keywords

    def test_build_test_results_reports_individual_test_names(self):
        listener = _make_listener()
        test_one = MockTest(name="Login_Chrome", status="PASS")
        test_two = MockTest(name="Login_Firefox", status="FAIL")
        result = MockResult(tests=[test_one, test_two])

        test_results = listener.build_test_results(result)

        assert len(test_results) == 2
        assert test_results[0]["name"] == "Login_Chrome"
        assert test_results[0]["status"] == "passed"
        assert test_results[1]["name"] == "Login_Firefox"
        assert test_results[1]["status"] == "failed"

    @patch.object(SLListener, "try_instrument_selenium")
    @patch.object(SLListener, "start_span")
    def test_start_test_uses_encoded_test_name(self, mock_start_span, mock_instrument):
        listener = _make_listener()
        listener.test_session_id = "session-123"
        test = MockTest(name="Test With Spaces")

        listener.start_test(test, result=None)

        mock_instrument.assert_called_once_with("Test%20With%20Spaces", "session-123")
        mock_start_span.assert_called_once_with("Test%20With%20Spaces")
