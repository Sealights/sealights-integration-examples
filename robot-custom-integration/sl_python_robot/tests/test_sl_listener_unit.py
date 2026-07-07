"""
Unit tests for SLListener testProjectId and Playwright instrumentation support.

All HTTP calls and JWT decoding are mocked so these tests run fast
with no network or token dependencies.

The module is imported as ``_sl_listener`` (registered by conftest.py)
to avoid collision with the ``robot`` package from robotframework.
"""

import re
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import requests

import _sl_listener

SLListener = _sl_listener.SLListener

FAKE_TOKEN = "fake.jwt.token"
MOCK_JWT_PAYLOAD = {"x-sl-server": "https://test.sealights.io/api"}


def _make_listener(**overrides):
    """Construct an SLListener with jwt.decode mocked."""
    defaults = dict(sltoken=FAKE_TOKEN, bsid="bsid-1", stagename="CI")
    defaults.update(overrides)
    with patch.object(_sl_listener.jwt, "decode", return_value=MOCK_JWT_PAYLOAD):
        return SLListener(**defaults)


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------


class TestInit:
    def test_stores_test_project_id(self):
        listener = _make_listener(testprojectid="my-project")
        assert listener.test_project_id == "my-project"

    def test_test_project_id_defaults_to_none(self):
        listener = _make_listener()
        assert listener.test_project_id is None

    def test_warns_when_both_bsid_and_labid_supplied(self, capsys):
        _make_listener(bsid="bsid-1", labid="lab-1")
        out = capsys.readouterr().out
        assert "[WARNING]" in out
        assert "labId ignored" in out


# ---------------------------------------------------------------------------
# get_header()
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# create_test_session()
# ---------------------------------------------------------------------------


class TestCreateTestSession:
    @patch.object(_sl_listener, "requests")
    def test_body_includes_testprojectid(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener(testprojectid="proj-123")
        listener.create_test_session()

        body = mock_requests.post.call_args.kwargs["json"]
        assert body["testProjectId"] == "proj-123"

    @patch.object(_sl_listener, "requests")
    def test_body_excludes_testprojectid_when_not_set(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener()
        listener.create_test_session()

        body = mock_requests.post.call_args.kwargs["json"]
        assert "testProjectId" not in body

    @patch.object(_sl_listener, "requests")
    def test_body_excludes_testprojectid_when_empty_string(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener(testprojectid="")
        listener.create_test_session()

        body = mock_requests.post.call_args.kwargs["json"]
        assert "testProjectId" not in body

    @patch.object(_sl_listener, "requests")
    def test_sends_testprojectid_header(self, mock_requests):
        mock_requests.post.return_value = MagicMock(
            ok=True, json=lambda: {"data": {"testSessionId": "sess-1"}}
        )
        listener = _make_listener(testprojectid="proj-123")
        listener.create_test_session()

        headers = mock_requests.post.call_args.kwargs["headers"]
        assert headers["x-sl-testprojectid"] == "proj-123"


# ---------------------------------------------------------------------------
# resolve_bsid_from_labid()
# ---------------------------------------------------------------------------


class TestResolveBsidFromLabid:
    @patch.object(_sl_listener.jwt, "decode", return_value=MOCK_JWT_PAYLOAD)
    @patch.object(_sl_listener, "requests")
    def test_includes_testprojectid_query_param(self, mock_requests, _mock_jwt):
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=lambda: {"buildSessionId": "resolved-bsid"}
        )
        listener = _make_listener(labid="lab-1", testprojectid="proj-123")
        listener.resolve_bsid_from_labid()

        params = mock_requests.get.call_args.kwargs["params"]
        assert params["testProjectId"] == "proj-123"

    @patch.object(_sl_listener.jwt, "decode", return_value=MOCK_JWT_PAYLOAD)
    @patch.object(_sl_listener, "requests")
    def test_excludes_testprojectid_when_none(self, mock_requests, _mock_jwt):
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=lambda: {"buildSessionId": "resolved-bsid"}
        )
        listener = _make_listener(labid="lab-1")
        listener.resolve_bsid_from_labid()

        params = mock_requests.get.call_args.kwargs["params"]
        assert "testProjectId" not in params

    @patch.object(_sl_listener.jwt, "decode", return_value=MOCK_JWT_PAYLOAD)
    @patch.object(_sl_listener, "requests")
    def test_sends_testprojectid_header(self, mock_requests, _mock_jwt):
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=lambda: {"buildSessionId": "resolved-bsid"}
        )
        listener = _make_listener(labid="lab-1", testprojectid="proj-123")
        listener.resolve_bsid_from_labid()

        headers = mock_requests.get.call_args.kwargs["headers"]
        assert headers["x-sl-testprojectid"] == "proj-123"


# ---------------------------------------------------------------------------
# get_excluded_tests() / _fetch_exclusions_once() — v2 exclude-tests lookup
# ---------------------------------------------------------------------------

class _FakeClock:
    """Controllable monotonic clock: time.sleep() advances it, no real delay."""

    def __init__(self, start=0.0):
        self.now = start

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def _v2_body(enabled, status, excluded_tests=None):
    return {
        "data": {
            "metadata": {"testSelectionEnabled": enabled, "status": status},
            "excludedTests": excluded_tests or [],
        }
    }


def _ok_response(json_body):
    return MagicMock(status_code=200, json=lambda: json_body)


def _status_response(status_code):
    return MagicMock(status_code=status_code, json=lambda: {})


class TestGetExcludedTests:
    def _listener(self, **overrides):
        defaults = dict(bsid="bsid-1", stagename="Robot Tests")
        defaults.update(overrides)
        listener = _make_listener(**defaults)
        listener.test_session_id = "sess-1"
        return listener

    # AC1
    @patch.object(_sl_listener, "requests")
    def test_url_is_v2_sl_api_no_query_params(self, mock_requests):
        mock_requests.get.return_value = _ok_response(_v2_body(True, "noHistory"))
        listener = self._listener()

        listener.get_excluded_tests(poll=False)

        args, kwargs = mock_requests.get.call_args
        url = args[0] if args else kwargs.get("url")
        assert url == f"{listener.base_url}/v2/test-sessions/sess-1/exclude-tests"
        assert "/sl-api" in listener.base_url
        assert "params" not in kwargs
        assert kwargs["headers"] == listener.get_header()
        assert kwargs["timeout"] == 30

    # AC2
    @patch.object(_sl_listener, "requests")
    def test_ready_names_feed_mark_tests_to_be_skipped(self, mock_requests):
        mock_requests.get.return_value = _ok_response(
            _v2_body(True, "ready", [{"testName": "Match Test"}])
        )
        listener = self._listener()

        names, terminal = listener.get_excluded_tests(poll=False)
        assert names == ["Match Test"]
        assert terminal is True

        listener.excluded_tests = set(names)
        match_test = SimpleNamespace(
            name="Match Test", body=MagicMock(), has_teardown=lambda: False
        )
        other_test = SimpleNamespace(
            name="Other Test", body=MagicMock(), has_teardown=lambda: False
        )
        suite = SimpleNamespace(tests=[match_test, other_test])

        listener.mark_tests_to_be_skipped(suite)

        match_test.body.create_keyword.assert_called_once_with(name="SKIP")
        other_test.body.create_keyword.assert_not_called()

    # AC3
    @patch.object(_sl_listener, "requests")
    def test_ready_with_empty_excluded_tests(self, mock_requests):
        mock_requests.get.return_value = _ok_response(_v2_body(True, "ready", []))
        listener = self._listener()

        names, terminal = listener.get_excluded_tests(poll=False)

        assert (names, terminal) == ([], True)

    # AC6
    @patch.object(_sl_listener, "requests")
    def test_terminal_statuses_ignore_excluded_tests_fetch_once(self, mock_requests):
        cases = [
            (True, "noHistory"),
            (True, "wontBeReady"),
            (True, "error"),
            (False, "ready"),
        ]
        for enabled, status in cases:
            mock_requests.get.reset_mock()
            mock_requests.get.return_value = _ok_response(
                _v2_body(enabled, status, [{"testName": "Should Not Apply"}])
            )
            listener = self._listener()

            names, terminal = listener.get_excluded_tests()

            assert (names, terminal) == ([], True), (enabled, status)
            assert mock_requests.get.call_count == 1, (enabled, status)

    # AC12
    @patch.object(_sl_listener, "requests")
    def test_no_envelope_body_still_parses(self, mock_requests):
        inner_payload = _v2_body(True, "ready", [{"testName": "Bare"}])["data"]
        mock_requests.get.return_value = _ok_response(inner_payload)
        listener = self._listener()

        names, terminal = listener.get_excluded_tests(poll=False)

        assert (names, terminal) == (["Bare"], True)

    # AC7 — break immediately on any non-retryable failure
    @patch.object(_sl_listener, "requests")
    def test_break_immediately_on_non_retryable_failures(self, mock_requests):
        mock_requests.RequestException = requests.RequestException

        for status_code in (404, 401, 500):
            mock_requests.get.reset_mock()
            mock_requests.get.side_effect = None
            mock_requests.get.return_value = _status_response(status_code)
            listener = self._listener()

            names, terminal = listener.get_excluded_tests()

            assert (names, terminal) == ([], False), status_code
            assert mock_requests.get.call_count == 1, status_code

        mock_requests.get.reset_mock()
        mock_requests.get.return_value = None
        mock_requests.get.side_effect = requests.RequestException("boom")
        listener = self._listener()

        names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == ([], False)
        assert mock_requests.get.call_count == 1
        mock_requests.get.side_effect = None

        for body in ([], "x", None):
            mock_requests.get.reset_mock()
            mock_requests.get.return_value = MagicMock(
                status_code=200, json=lambda body=body: body
            )
            listener = self._listener()

            names, terminal = listener.get_excluded_tests()

            assert (names, terminal) == ([], False), body
            assert mock_requests.get.call_count == 1, body

        mock_requests.get.reset_mock()
        mock_requests.get.return_value = MagicMock(
            status_code=200, json=MagicMock(side_effect=ValueError("bad json"))
        )
        listener = self._listener()

        names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == ([], False)
        assert mock_requests.get.call_count == 1

    # AC8
    @patch.object(_sl_listener, "requests")
    def test_missing_session_returns_no_call(self, mock_requests):
        listener = _make_listener(bsid="bsid-1", stagename="Robot Tests")
        listener.test_session_id = None

        names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == ([], False)
        mock_requests.get.assert_not_called()

    # AC4 — persistent notReady stops at the deadline (fake clock, no real sleep)
    @patch.object(_sl_listener, "requests")
    def test_persistent_not_ready_stops_at_deadline(self, mock_requests, monkeypatch):
        monkeypatch.setenv("SL_TIA_POLLING_TIMEOUT_SEC", "10")
        monkeypatch.setenv("SL_TIA_POLLING_INTERVAL_SEC", "3")
        mock_requests.get.return_value = _ok_response(_v2_body(True, "notReady"))
        clock = _FakeClock()
        listener = self._listener()

        with patch.object(
            _sl_listener.time, "monotonic", side_effect=clock.monotonic
        ), patch.object(_sl_listener.time, "sleep", side_effect=clock.sleep):
            names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == ([], False)
        # ceil(timeout/interval) loop iterations + the initial fetch
        assert mock_requests.get.call_count == 5

    # AC4b — a fetch that lands past the deadline never yields a negative sleep
    @patch.object(_sl_listener, "requests")
    def test_over_budget_fetch_clamps_sleep_to_zero(self, mock_requests, monkeypatch):
        monkeypatch.setenv("SL_TIA_POLLING_TIMEOUT_SEC", "10")
        monkeypatch.setenv("SL_TIA_POLLING_INTERVAL_SEC", "5")
        mock_requests.get.return_value = _ok_response(_v2_body(True, "notReady"))

        # 1) deadline calc -> 0 (deadline=10); 2) while-check -> 9 (< 10, enter);
        # 3) sleep_for calc -> 11 (already past deadline) -> clamps to 0 -> break.
        monotonic_values = iter([0, 9, 11])
        listener = self._listener()

        with patch.object(
            _sl_listener.time,
            "monotonic",
            side_effect=lambda: next(monotonic_values),
        ), patch.object(_sl_listener.time, "sleep") as mock_sleep:
            names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == ([], False)
        mock_sleep.assert_not_called()
        for call in mock_sleep.call_args_list:
            assert call.args[0] >= 0

    # AC5
    @patch.object(_sl_listener, "requests")
    def test_not_ready_then_ready_returns_exclusions(self, mock_requests, monkeypatch):
        monkeypatch.setenv("SL_TIA_POLLING_TIMEOUT_SEC", "10")
        monkeypatch.setenv("SL_TIA_POLLING_INTERVAL_SEC", "1")
        mock_requests.get.side_effect = [
            _ok_response(_v2_body(True, "notReady")),
            _ok_response(_v2_body(True, "ready", [{"testName": "T1"}])),
        ]
        clock = _FakeClock()
        listener = self._listener()

        with patch.object(
            _sl_listener.time, "monotonic", side_effect=clock.monotonic
        ), patch.object(_sl_listener.time, "sleep", side_effect=clock.sleep):
            names, terminal = listener.get_excluded_tests()

        assert (names, terminal) == (["T1"], True)
        assert mock_requests.get.call_count == 2

    # AC9b — 0 disables polling via OR, tested independently for each var
    @patch.object(_sl_listener, "requests")
    def test_timeout_zero_disables_polling(self, mock_requests, monkeypatch):
        monkeypatch.setenv("SL_TIA_POLLING_TIMEOUT_SEC", "0")
        monkeypatch.setenv("SL_TIA_POLLING_INTERVAL_SEC", "5")
        mock_requests.get.return_value = _ok_response(_v2_body(True, "notReady"))
        listener = self._listener()

        with patch.object(_sl_listener.time, "sleep") as mock_sleep:
            listener.get_excluded_tests()

        assert mock_requests.get.call_count == 1
        mock_sleep.assert_not_called()

    @patch.object(_sl_listener, "requests")
    def test_interval_zero_disables_polling(self, mock_requests, monkeypatch):
        monkeypatch.setenv("SL_TIA_POLLING_TIMEOUT_SEC", "5")
        monkeypatch.setenv("SL_TIA_POLLING_INTERVAL_SEC", "0")
        mock_requests.get.return_value = _ok_response(_v2_body(True, "notReady"))
        listener = self._listener()

        with patch.object(_sl_listener.time, "sleep") as mock_sleep:
            listener.get_excluded_tests()

        assert mock_requests.get.call_count == 1
        mock_sleep.assert_not_called()


# ---------------------------------------------------------------------------
# _read_positive_env() — env-var validation (AC9)
# ---------------------------------------------------------------------------

class TestReadPositiveEnv:
    def test_defaults_when_unset(self, monkeypatch):
        monkeypatch.delenv("SL_TEST_VAR", raising=False)
        listener = _make_listener()

        assert listener._read_positive_env("SL_TEST_VAR", 42) == 42

    def test_invalid_values_fall_back_to_default(self, monkeypatch, capsys):
        listener = _make_listener()
        for raw in ("abc", "-1", "inf", "nan"):
            monkeypatch.setenv("SL_TEST_VAR", raw)
            assert listener._read_positive_env("SL_TEST_VAR", 7) == 7, raw
        assert "[WARNING]" in capsys.readouterr().out

    def test_accepts_valid_positive_float_string(self, monkeypatch):
        listener = _make_listener()
        monkeypatch.setenv("SL_TEST_VAR", "12.5")

        assert listener._read_positive_env("SL_TEST_VAR", 1) == 12.5

    def test_accepts_zero(self, monkeypatch):
        listener = _make_listener()
        monkeypatch.setenv("SL_TEST_VAR", "0")

        assert listener._read_positive_env("SL_TEST_VAR", 1) == 0


# ---------------------------------------------------------------------------
# Playwright instrumentation — playwright_goto()
# ---------------------------------------------------------------------------


class TestPlaywrightGoto:
    def test_calls_original_and_injects_baggage(self):
        """After page.goto(), the baggage JS event should be dispatched."""
        mock_page = MagicMock()
        original_goto = MagicMock(return_value="nav-response")

        wrapped = _sl_listener.playwright_goto("test%20A", "sess-1")(original_goto)
        result = wrapped(mock_page, "https://example.com")

        original_goto.assert_called_once_with(mock_page, "https://example.com")
        mock_page.evaluate.assert_called_once()
        js_arg = mock_page.evaluate.call_args[0][0]
        assert "set:context" in js_arg
        assert "test%20A" in js_arg
        assert "sess-1" in js_arg
        assert result == "nav-response"

    def test_returns_response_on_evaluate_error(self):
        """If evaluate() raises, the original goto response is still returned."""
        mock_page = MagicMock()
        mock_page.evaluate.side_effect = RuntimeError("JS error")
        original_goto = MagicMock(return_value="nav-response")

        wrapped = _sl_listener.playwright_goto("t1", "s1")(original_goto)
        result = wrapped(mock_page, "https://example.com")

        assert result == "nav-response"


# ---------------------------------------------------------------------------
# Playwright instrumentation — playwright_close()
# ---------------------------------------------------------------------------


class TestPlaywrightClose:
    def test_flushes_footprints_before_close(self):
        """sendAllFootprints() should be called before the page is closed."""
        mock_page = MagicMock()
        original_close = MagicMock()
        call_order = []
        mock_page.evaluate.side_effect = lambda _: call_order.append("evaluate")
        original_close.side_effect = lambda *a, **kw: call_order.append("close")

        wrapped = _sl_listener.playwright_close(original_close)
        wrapped(mock_page)

        mock_page.evaluate.assert_called_once_with(
            "window.$SealightsAgent.sendAllFootprints()"
        )
        original_close.assert_called_once_with(mock_page)
        assert call_order == ["evaluate", "close"]

    def test_still_closes_on_evaluate_error(self):
        """If evaluate() raises, the page should still be closed."""
        mock_page = MagicMock()
        mock_page.evaluate.side_effect = RuntimeError("JS error")
        original_close = MagicMock()

        wrapped = _sl_listener.playwright_close(original_close)
        wrapped(mock_page)

        original_close.assert_called_once_with(mock_page)


# ---------------------------------------------------------------------------
# Playwright instrumentation — playwright_context_close()
# ---------------------------------------------------------------------------


class TestPlaywrightContextClose:
    def test_flushes_all_pages_before_close(self):
        """sendAllFootprints() should be called on every open page in the context."""
        page1 = MagicMock()
        page2 = MagicMock()
        mock_context = MagicMock()
        mock_context.pages = [page1, page2]
        original_close = MagicMock()

        wrapped = _sl_listener.playwright_context_close(original_close)
        wrapped(mock_context)

        page1.evaluate.assert_called_once_with(
            "window.$SealightsAgent.sendAllFootprints()"
        )
        page2.evaluate.assert_called_once_with(
            "window.$SealightsAgent.sendAllFootprints()"
        )
        original_close.assert_called_once_with(mock_context)

    def test_closes_context_even_if_page_flush_fails(self):
        """If flushing a page raises, the context should still be closed."""
        page1 = MagicMock()
        page1.evaluate.side_effect = RuntimeError("JS error")
        mock_context = MagicMock()
        mock_context.pages = [page1]
        original_close = MagicMock()

        wrapped = _sl_listener.playwright_context_close(original_close)
        wrapped(mock_context)

        original_close.assert_called_once_with(mock_context)

    def test_handles_empty_pages_list(self):
        """Context with no pages should still close cleanly."""
        mock_context = MagicMock()
        mock_context.pages = []
        original_close = MagicMock()

        wrapped = _sl_listener.playwright_context_close(original_close)
        wrapped(mock_context)

        original_close.assert_called_once_with(mock_context)


# ---------------------------------------------------------------------------
# Version constant
# ---------------------------------------------------------------------------


def test_version_defined():
    assert hasattr(_sl_listener, "__version__")
    assert re.match(r"^\d+\.\d+\.\d+$", _sl_listener.__version__)


def test_version_bumped_for_browser_library_support():
    """__version__ was bumped alongside Browser Library support (SLDEV-28058)."""
    assert _sl_listener.__version__ == "1.5.0"


# ---------------------------------------------------------------------------
# _sl_log() — log level filtering
# ---------------------------------------------------------------------------


class TestSlLog:
    def test_prints_at_threshold(self, capsys):
        with patch.object(_sl_listener, "_EFFECTIVE_LOG_LEVEL", 20):
            _sl_listener._sl_log("hello", level="INFO")
        assert "[INFO] hello" in capsys.readouterr().out

    def test_suppresses_below_threshold(self, capsys):
        with patch.object(_sl_listener, "_EFFECTIVE_LOG_LEVEL", 30):
            _sl_listener._sl_log("debug msg", level="DEBUG")
        assert capsys.readouterr().out == ""

    def test_passes_above_threshold(self, capsys):
        with patch.object(_sl_listener, "_EFFECTIVE_LOG_LEVEL", 20):
            _sl_listener._sl_log("warn msg", level="WARNING")
        assert "[WARNING] warn msg" in capsys.readouterr().out

    def test_includes_sealights_tag(self, capsys):
        with patch.object(_sl_listener, "_EFFECTIVE_LOG_LEVEL", 20):
            _sl_listener._sl_log("check tag")
        assert _sl_listener.SEALIGHTS_LOG_TAG in capsys.readouterr().out


# ---------------------------------------------------------------------------
# start_suite — resolve_bsid_from_labid guard
# ---------------------------------------------------------------------------


class TestStartSuiteResolveBsidGuard:
    def test_skips_resolve_when_bsid_already_set(self):
        """resolve_bsid_from_labid must not be called if bsid is already known."""
        listener = _make_listener(bsid="existing-bsid", labid="lab-1")

        suite = MagicMock()
        suite.tests = [MagicMock()]
        suite.longname = "Suite"
        suite.source = "/path/to/suite.robot"

        with (
            patch.object(listener, "resolve_bsid_from_labid") as mock_resolve,
            patch.object(listener, "create_test_session"),
            patch.object(listener, "get_excluded_tests", return_value=([], False)),
            patch.object(listener, "mark_tests_to_be_skipped"),
        ):
            listener.start_suite(suite, MagicMock())

        mock_resolve.assert_not_called()

    def test_calls_resolve_when_bsid_unset(self):
        """resolve_bsid_from_labid must be called exactly once when bsid is None."""
        listener = _make_listener(labid="lab-1", bsid=None)

        suite = MagicMock()
        suite.tests = [MagicMock()]
        suite.longname = "Suite"
        suite.source = "/path/to/suite.robot"

        with (
            patch.object(listener, "resolve_bsid_from_labid") as mock_resolve,
            patch.object(listener, "create_test_session"),
            patch.object(listener, "get_excluded_tests", return_value=([], False)),
            patch.object(listener, "mark_tests_to_be_skipped"),
        ):
            listener.start_suite(suite, MagicMock())

        mock_resolve.assert_called_once()


# ---------------------------------------------------------------------------
# start_suite — TIA filtering runs on every suite, not just the first
# ---------------------------------------------------------------------------


class TestStartSuiteMultiSuiteTia:
    def _make_suite(self):
        suite = MagicMock()
        suite.tests = [MagicMock()]
        suite.longname = "Suite"
        suite.source = "/path/to/suite.robot"
        return suite

    def test_mark_tests_to_be_skipped_runs_on_every_suite(self):
        """mark_tests_to_be_skipped must be called for every suite, not just the first."""
        listener = _make_listener(bsid="bsid-1")

        with (
            patch.object(listener, "create_test_session") as mock_create,
            patch.object(listener, "get_excluded_tests", return_value=([], True)) as mock_get,
            patch.object(listener, "mark_tests_to_be_skipped") as mock_mark,
        ):
            # First suite — creates the session
            listener.start_suite(self._make_suite(), MagicMock())
            # Simulate session being set (create_test_session is mocked)
            listener.test_session_id = "sess-1"
            # Second suite — reuses the session
            listener.start_suite(self._make_suite(), MagicMock())

        assert mock_create.call_count == 1
        assert mock_mark.call_count == 2

    def test_terminal_ready_memoized_across_suites(self):
        """AC10: a terminal outcome on suite 1 is memoized; later suites reuse
        it without re-querying, but mark_tests_to_be_skipped still runs every
        suite (asserted numerically, not "per suite")."""
        listener = _make_listener(bsid="bsid-1")

        with patch.object(listener, "create_test_session") as mock_create, \
             patch.object(
                 listener, "get_excluded_tests", return_value=(["T1"], True)
             ) as mock_get, \
             patch.object(listener, "mark_tests_to_be_skipped") as mock_mark:

            listener.start_suite(self._make_suite(), MagicMock())
            listener.test_session_id = "sess-1"
            listener.start_suite(self._make_suite(), MagicMock())
            listener.start_suite(self._make_suite(), MagicMock())

        assert mock_create.call_count == 1
        assert mock_get.call_count == 1
        assert mock_mark.call_count == 3
        assert listener.tia_resolved is True
        assert listener.excluded_tests == {"T1"}

    def test_non_terminal_suite_recovers_on_later_suite(self):
        """AC11: a non-terminal outcome on suite 1 is not memoized; a later
        suite that resolves ready applies exclusions; later retries are
        single-shot (poll=False), not another full poll budget."""
        listener = _make_listener(bsid="bsid-1")

        with patch.object(listener, "create_test_session"), \
             patch.object(
                 listener,
                 "get_excluded_tests",
                 side_effect=[([], False), ([], False), (["T2"], True)],
             ) as mock_get, \
             patch.object(listener, "mark_tests_to_be_skipped") as mock_mark:

            listener.start_suite(self._make_suite(), MagicMock())
            assert listener.tia_resolved is False
            listener.test_session_id = "sess-1"

            listener.start_suite(self._make_suite(), MagicMock())
            assert listener.tia_resolved is False

            listener.start_suite(self._make_suite(), MagicMock())

        assert mock_get.call_count == 3
        assert mock_get.call_args_list[0].kwargs["poll"] is True
        assert mock_get.call_args_list[1].kwargs["poll"] is False
        assert mock_get.call_args_list[2].kwargs["poll"] is False
        assert listener.tia_resolved is True
        assert listener.excluded_tests == {"T2"}
        assert mock_mark.call_count == 3


# ---------------------------------------------------------------------------
# Playwright instrumentation — try_instrument_playwright()
# ---------------------------------------------------------------------------


class TestTryInstrumentPlaywright:
    def test_patches_playwright_page_when_available(self):
        """When PlaywrightPage is not None, goto and close should be patched."""
        original_goto = MagicMock()
        original_close = MagicMock()

        mock_page_cls = type(
            "MockPage", (), {"goto": original_goto, "close": original_close}
        )
        mock_ctx_cls = type("MockCtx", (), {"close": MagicMock()})

        with (
            patch.object(_sl_listener, "PlaywrightPage", mock_page_cls),
            patch.object(_sl_listener, "PlaywrightBrowserContext", mock_ctx_cls),
        ):
            listener = _make_listener()
            listener.try_instrument_playwright("test1", "sess-1")

        assert mock_page_cls.goto is not original_goto
        assert mock_page_cls.close is not original_close

    def test_noop_when_playwright_not_installed(self):
        """When PlaywrightPage is None, no patching should occur."""
        with (
            patch.object(_sl_listener, "PlaywrightPage", None),
            patch.object(_sl_listener, "PlaywrightBrowserContext", None),
        ):
            listener = _make_listener()
            listener.try_instrument_playwright("test1", "sess-1")


# ---------------------------------------------------------------------------
# build_test_results() — per-test timestamps (SLDEV-28046)
# ---------------------------------------------------------------------------


class TestBuildTestResults:
    def _make_test(self, name, status, starttime, endtime):
        return SimpleNamespace(
            name=name, status=status, starttime=starttime, endtime=endtime
        )

    def _make_suite_result(self, tests, suite_starttime, suite_endtime):
        return SimpleNamespace(
            tests=tests, starttime=suite_starttime, endtime=suite_endtime
        )

    def test_uses_per_test_timestamps_not_suite(self):
        """Each result entry must carry the individual test's start/end, not the suite's."""
        listener = _make_listener()
        t1 = self._make_test(
            "Test A", "PASS", "20240101 00:00:01.000", "20240101 00:00:02.000"
        )
        t2 = self._make_test(
            "Test B", "PASS", "20240101 00:00:03.000", "20240101 00:00:05.000"
        )
        suite_result = self._make_suite_result(
            [t1, t2],
            suite_starttime="20240101 00:00:00.000",
            suite_endtime="20240101 00:01:00.000",
        )

        results = listener.build_test_results(suite_result)

        assert results[0] == {
            "name": "Test A",
            "status": "passed",
            "start": listener.get_epoch_timestamp(t1.starttime),
            "end": listener.get_epoch_timestamp(t1.endtime),
        }
        assert results[1] == {
            "name": "Test B",
            "status": "passed",
            "start": listener.get_epoch_timestamp(t2.starttime),
            "end": listener.get_epoch_timestamp(t2.endtime),
        }

    def test_different_tests_get_different_timestamps(self):
        """Two tests with different run times must produce different start/end values."""
        listener = _make_listener()
        t1 = self._make_test(
            "Slow Test", "PASS", "20240101 00:00:00.000", "20240101 00:00:30.000"
        )
        t2 = self._make_test(
            "Fast Test", "PASS", "20240101 00:00:31.000", "20240101 00:00:32.000"
        )
        suite_result = self._make_suite_result(
            [t1, t2], "20240101 00:00:00.000", "20240101 00:00:32.000"
        )

        results = listener.build_test_results(suite_result)

        assert results[0]["start"] != results[1]["start"]
        assert results[0]["end"] != results[1]["end"]

    def test_none_timestamps_for_skipped_test(self):
        """Tests with None starttime/endtime (e.g. skipped before execution) must not crash."""
        listener = _make_listener()
        t = self._make_test("Skipped Test", "SKIP", None, None)
        suite_result = self._make_suite_result(
            [t], "20240101 00:00:00.000", "20240101 00:00:01.000"
        )

        results = listener.build_test_results(suite_result)

        assert results[0] == {
            "name": "Skipped Test",
            "status": "skipped",
            "start": 0,
            "end": 0,
        }


# ---------------------------------------------------------------------------
# Browser Library — __init__ state seeding (SLDEV-28058)
# ---------------------------------------------------------------------------


class TestBrowserLibraryInitState:
    def test_seeds_browser_lib_state(self):
        listener = _make_listener()
        assert listener.browser_lib is None
        assert listener.bl_page_snapshot == {}
        assert listener.bl_test_baggage is None
        assert listener._bl_checked is False


# ---------------------------------------------------------------------------
# Browser Library — try_detect_browser_library()
# ---------------------------------------------------------------------------


class TestTryDetectBrowserLibrary:
    def test_stores_instance_on_success(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.return_value = (
                mock_browser
            )
            result = listener.try_detect_browser_library()

        assert result is mock_browser
        assert listener.browser_lib is mock_browser

    def test_returns_none_when_get_library_instance_raises(self):
        listener = _make_listener()
        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.side_effect = (
                RuntimeError("No library 'Browser' found")
            )
            result = listener.try_detect_browser_library()

        assert result is None
        assert listener.browser_lib is None

    def test_returns_none_when_get_library_instance_returns_falsy(self):
        listener = _make_listener()
        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.return_value = None
            result = listener.try_detect_browser_library()

        assert result is None
        assert listener.browser_lib is None

    def test_second_call_within_same_suite_is_cached(self):
        """Detection is cached per suite — a second call must not re-invoke
        get_library_instance, so absent-library suites don't raise once per
        test."""
        listener = _make_listener()
        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.side_effect = (
                RuntimeError("No library 'Browser' found")
            )
            first = listener.try_detect_browser_library()
            second = listener.try_detect_browser_library()

        assert first is None
        assert second is None
        mock_builtin_cls.return_value.get_library_instance.assert_called_once()

    def test_cache_resets_on_new_suite(self):
        """start_suite resets the cache so a later suite can detect the
        library even if an earlier suite in the same run did not import it."""
        listener = _make_listener(bsid="bsid-1")
        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.side_effect = (
                RuntimeError("No library 'Browser' found")
            )
            listener.try_detect_browser_library()

        suite = MagicMock()
        suite.tests = []
        listener.start_suite(suite, MagicMock())

        mock_browser = MagicMock()
        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.return_value = (
                mock_browser
            )
            result = listener.try_detect_browser_library()

        assert result is mock_browser


# ---------------------------------------------------------------------------
# Browser Library — _build_browser_library_context_script()
# ---------------------------------------------------------------------------


class TestBuildBrowserLibraryContextScript:
    def test_is_arrow_wrapped(self):
        script = _sl_listener._build_browser_library_context_script(
            "test%20A", "sess-1"
        )
        assert script.startswith("() => {")
        assert script.rstrip().endswith("}")

    def test_contains_encoded_name_and_session(self):
        script = _sl_listener._build_browser_library_context_script(
            "test%20A", "sess-1"
        )
        assert "test%20A" in script
        assert "sess-1" in script

    def test_uses_persist_false(self):
        script = _sl_listener._build_browser_library_context_script("t1", "s1")
        assert "persist: false" in script

    def test_uses_shared_baggage_key_constants(self):
        script = _sl_listener._build_browser_library_context_script("t1", "s1")
        assert _sl_listener.BAGGAGE_KEY_TEST_NAME in script
        assert _sl_listener.BAGGAGE_KEY_TEST_SESSION_ID in script

    def test_separate_from_selenium_playwright_builder(self):
        bl_script = _sl_listener._build_browser_library_context_script("t1", "s1")
        legacy_script = _sl_listener._build_set_context_script("t1", "s1")
        assert bl_script != legacy_script


# ---------------------------------------------------------------------------
# Browser Library — _build_set_context_script() byte-identical after refactor
# ---------------------------------------------------------------------------


class TestBuildSetContextScriptUnchanged:
    def test_output_byte_identical_to_pre_refactor_shape(self):
        script = _sl_listener._build_set_context_script("test%20A", "sess-1")
        assert script == (
            'window.dispatchEvent(new CustomEvent("set:context", '
            '{detail: {baggage: {"x-sl-test-name": "test%20A", '
            '"x-sl-test-session-id": "sess-1"}}}));'
        )

    def test_none_session_id_byte_identical_to_pre_refactor_shape(self):
        """Regression: json.dumps(None) alone would emit a bare `null`
        instead of the legacy %s-formatted string "None"."""
        script = _sl_listener._build_set_context_script("test%20A", None)
        assert script == (
            'window.dispatchEvent(new CustomEvent("set:context", '
            '{detail: {baggage: {"x-sl-test-name": "test%20A", '
            '"x-sl-test-session-id": "None"}}}));'
        )


# ---------------------------------------------------------------------------
# Browser Library — context script builders escape untrusted values
# ---------------------------------------------------------------------------


class TestContextScriptEscaping:
    def test_set_context_script_escapes_quotes_in_session_id(self):
        """A session id containing a double quote must not break out of the
        JS string literal — json.dumps escapes it instead of interpolating raw."""
        script = _sl_listener._build_set_context_script("t1", 'sess"1')
        assert '\\"' in script
        assert 'sess"1' not in script

    def test_browser_library_script_escapes_quotes_in_session_id(self):
        script = _sl_listener._build_browser_library_context_script("t1", 'sess"1')
        assert '\\"' in script
        assert 'sess"1' not in script

    def test_browser_library_script_stringifies_none_session_id(self):
        """None must not surface as a bare JS `null` — kept consistent with
        the Selenium/Playwright builder's "None" string for the same input."""
        script = _sl_listener._build_browser_library_context_script("t1", None)
        assert '"x-sl-test-session-id": "None"' in script
        assert "null" not in script


# ---------------------------------------------------------------------------
# Browser Library — _flatten_browser_catalog()
# ---------------------------------------------------------------------------


class TestFlattenBrowserCatalog:
    def test_flattens_nested_browsers_contexts_pages(self):
        catalog = [
            {
                "contexts": [
                    {
                        "pages": [
                            {"id": "page1", "url": "https://a.com"},
                            {"id": "page2", "url": "https://b.com"},
                        ]
                    }
                ]
            },
            {"contexts": [{"pages": [{"id": "page3", "url": "https://c.com"}]}]},
        ]

        result = _sl_listener._flatten_browser_catalog(catalog)

        assert result == {
            "page1": "https://a.com",
            "page2": "https://b.com",
            "page3": "https://c.com",
        }

    def test_empty_catalog(self):
        assert _sl_listener._flatten_browser_catalog([]) == {}

    def test_none_catalog(self):
        assert _sl_listener._flatten_browser_catalog(None) == {}

    def test_context_with_no_pages(self):
        catalog = [{"contexts": [{"pages": []}]}]
        assert _sl_listener._flatten_browser_catalog(catalog) == {}


# ---------------------------------------------------------------------------
# Browser Library — _find_active_browser_page_id()
# ---------------------------------------------------------------------------


class TestFindActiveBrowserPageId:
    def test_returns_active_page_id(self):
        catalog = [
            {
                "activeBrowser": True,
                "activeContext": "ctx1",
                "contexts": [{"id": "ctx1", "activePage": "page2", "pages": []}],
            }
        ]
        assert _sl_listener._find_active_browser_page_id(catalog) == "page2"

    def test_returns_none_when_no_active_page(self):
        catalog = [
            {
                "activeBrowser": True,
                "activeContext": "ctx1",
                "contexts": [{"id": "ctx1", "pages": []}],
            }
        ]
        assert _sl_listener._find_active_browser_page_id(catalog) is None

    def test_returns_none_for_empty_catalog(self):
        assert _sl_listener._find_active_browser_page_id([]) is None

    def test_ignores_activepage_of_non_active_browser(self):
        """Regression: every browser/context tracks its own last-active page
        (per get_browser_catalog()'s docstring sample), even ones that are
        not the globally focused browser — only the browser flagged
        activeBrowser (and its activeContext) is authoritative."""
        catalog = [
            {
                "activeBrowser": False,
                "activeContext": "ctx1",
                "contexts": [{"id": "ctx1", "activePage": "page1", "pages": []}],
            },
            {
                "activeBrowser": True,
                "activeContext": "ctx2",
                "contexts": [{"id": "ctx2", "activePage": "page2", "pages": []}],
            },
        ]
        assert _sl_listener._find_active_browser_page_id(catalog) == "page2"

    def test_ignores_activepage_of_non_active_context(self):
        """Regression: a non-active context's activePage must not be picked
        up even when it belongs to the globally active browser."""
        catalog = [
            {
                "activeBrowser": True,
                "activeContext": "ctx2",
                "contexts": [
                    {"id": "ctx1", "activePage": "page1", "pages": []},
                    {"id": "ctx2", "activePage": "page2", "pages": []},
                ],
            }
        ]
        assert _sl_listener._find_active_browser_page_id(catalog) == "page2"


# ---------------------------------------------------------------------------
# Browser Library — _diff_browser_catalog_pages() (incl. I4 nullable URLs)
# ---------------------------------------------------------------------------


class TestDiffBrowserCatalogPages:
    def test_new_page_is_reported(self):
        previous = {}
        current = {"page1": "https://a.com"}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == ["page1"]

    def test_url_change_is_reported(self):
        previous = {"page1": "https://a.com"}
        current = {"page1": "https://b.com"}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == ["page1"]

    def test_unchanged_page_not_reported(self):
        previous = {"page1": "https://a.com"}
        current = {"page1": "https://a.com"}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == []

    def test_removed_page_tolerated(self):
        previous = {"page1": "https://a.com", "page2": "https://b.com"}
        current = {"page1": "https://a.com"}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == []

    def test_none_to_url_is_a_change(self):
        previous = {"page1": None}
        current = {"page1": "https://a.com"}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == ["page1"]

    def test_url_to_none_is_a_change(self):
        previous = {"page1": "https://a.com"}
        current = {"page1": None}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == ["page1"]

    def test_none_to_none_is_not_a_change(self):
        previous = {"page1": None}
        current = {"page1": None}
        assert _sl_listener._diff_browser_catalog_pages(previous, current) == []


# ---------------------------------------------------------------------------
# Browser Library — _run_on_browser_library_pages() (S2 multi-page routine)
# ---------------------------------------------------------------------------


class TestRunOnBrowserLibraryPages:
    def test_switches_non_active_pages_and_restores_active_page(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser

        listener._run_on_browser_library_pages(["page1", "page2"], "() => {}", "page1")

        # page1 is already active: no switch needed for it, only page2
        mock_browser.switch_page.assert_any_call("page2")
        assert mock_browser.evaluate_javascript.call_count == 2
        # restore call at the end targets the originally-active page
        assert mock_browser.switch_page.call_args_list[-1].args == ("page1",)
        # exactly one switch to page2 + one restore to page1, no redundant calls
        assert mock_browser.switch_page.call_count == 2

    def test_no_restore_when_only_active_page_processed(self):
        """If every target page was already active (no switch happened), the
        finally block must not issue a redundant restore switch_page call."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser

        listener._run_on_browser_library_pages(["page1"], "() => {}", "page1")

        mock_browser.evaluate_javascript.assert_called_once()
        mock_browser.switch_page.assert_not_called()

    def test_empty_page_ids_no_crash(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser

        listener._run_on_browser_library_pages([], "() => {}", None)

        mock_browser.evaluate_javascript.assert_not_called()
        mock_browser.switch_page.assert_not_called()

    def test_switches_every_page_when_active_page_id_unknown(self):
        """When the catalog has no activePage, every page must still be
        switched to individually — otherwise evaluate_javascript would run
        repeatedly against whatever page happens to already be current."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser

        listener._run_on_browser_library_pages(
            ["page1", "page2"], "() => {}", None
        )

        mock_browser.switch_page.assert_any_call("page1")
        mock_browser.switch_page.assert_any_call("page2")
        assert mock_browser.evaluate_javascript.call_count == 2
        # no active page to restore
        assert mock_browser.switch_page.call_count == 2

    def test_restores_active_page_and_processes_remaining_after_mid_loop_error(self):
        """AC4b: a middle page's switch_page raises; remaining pages still
        processed AND the active page is still restored (asserted together)."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser

        def switch_side_effect(page_id):
            if page_id == "page2":
                raise RuntimeError("stale page, upstream issue #1867")

        mock_browser.switch_page.side_effect = switch_side_effect

        listener._run_on_browser_library_pages(
            ["page1", "page2", "page3"], "() => {}", "page1"
        )

        # page1 (active, no switch) and page3 (switch succeeded) were evaluated;
        # page2 was skipped because its switch_page raised.
        assert mock_browser.evaluate_javascript.call_count == 2
        # the captured active page (page1) is still restored in the finally.
        assert mock_browser.switch_page.call_args_list[-1].args == ("page1",)


# ---------------------------------------------------------------------------
# Browser Library — try_instrument_browser_library() (S2 start_test injection)
# ---------------------------------------------------------------------------


class TestTryInstrumentBrowserLibrary:
    def _make_catalog(self, pages, active_page_id=None):
        return [
            {
                "activeBrowser": True,
                "activeContext": "ctx1",
                "contexts": [
                    {"id": "ctx1", "activePage": active_page_id, "pages": pages}
                ],
            }
        ]

    def test_injects_on_all_pre_existing_catalog_pages(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        catalog = self._make_catalog(
            [
                {"id": "page1", "url": "https://a.com"},
                {"id": "page2", "url": "https://b.com"},
            ],
            active_page_id="page1",
        )
        mock_browser.get_browser_catalog.return_value = catalog

        with patch.object(listener, "try_detect_browser_library") as mock_detect:
            mock_detect.side_effect = lambda: setattr(
                listener, "browser_lib", mock_browser
            )
            listener.try_instrument_browser_library("test1", "sess-1")

        assert mock_browser.evaluate_javascript.call_count == 2
        mock_browser.switch_page.assert_any_call("page2")
        assert listener.bl_page_snapshot == {
            "page1": "https://a.com",
            "page2": "https://b.com",
        }

    def test_script_is_arrow_wrapped_with_correct_baggage(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        catalog = self._make_catalog(
            [{"id": "page1", "url": "https://a.com"}], active_page_id="page1"
        )
        mock_browser.get_browser_catalog.return_value = catalog

        with patch.object(listener, "try_detect_browser_library") as mock_detect:
            mock_detect.side_effect = lambda: setattr(
                listener, "browser_lib", mock_browser
            )
            listener.try_instrument_browser_library("test%20A", "sess-1")

        script = mock_browser.evaluate_javascript.call_args[0][1]
        assert script.startswith("() => {")
        assert "test%20A" in script
        assert "sess-1" in script

    def test_empty_catalog_no_crash(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        mock_browser.get_browser_catalog.return_value = []

        with patch.object(listener, "try_detect_browser_library") as mock_detect:
            mock_detect.side_effect = lambda: setattr(
                listener, "browser_lib", mock_browser
            )
            listener.try_instrument_browser_library("test1", "sess-1")

        mock_browser.evaluate_javascript.assert_not_called()

    def test_noop_when_browser_library_absent(self):
        listener = _make_listener()
        with patch.object(listener, "try_detect_browser_library"):
            listener.try_instrument_browser_library("test1", "sess-1")

        assert listener.bl_page_snapshot == {}
        assert listener.bl_test_baggage is None


# ---------------------------------------------------------------------------
# Browser Library — end_keyword() (S3 gated catalog diff)
# ---------------------------------------------------------------------------


class TestEndKeyword:
    def _make_catalog(self, pages, active_page_id=None):
        return [
            {
                "activeBrowser": True,
                "activeContext": "ctx1",
                "contexts": [
                    {"id": "ctx1", "activePage": active_page_id, "pages": pages}
                ],
            }
        ]

    def test_noop_when_browser_library_absent(self):
        listener = _make_listener()
        listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))
        # no crash; nothing to assert on browser_lib since it stays None

    def test_non_browser_keyword_does_not_read_catalog(self):
        """AC6b: owner != 'Browser' must never trigger get_browser_catalog()."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_test_baggage = ("test1", "sess-1")

        listener.end_keyword(MagicMock(), MagicMock(owner="BuiltIn", libname="BuiltIn"))

        mock_browser.get_browser_catalog.assert_not_called()

    def test_noop_when_test_baggage_is_none(self):
        """Suite Teardown gap: browser_lib stays cached after the last test's
        end_test clears bl_test_baggage, so a Browser keyword firing in Suite
        Teardown must not inject context with no real test identity."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_test_baggage = None

        listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))

        mock_browser.get_browser_catalog.assert_not_called()

    def test_browser_keyword_new_page_injects(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_page_snapshot = {}
        listener.bl_test_baggage = ("test1", "sess-1")
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [{"id": "page1", "url": "https://a.com"}], active_page_id="page1"
        )

        listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))

        mock_browser.evaluate_javascript.assert_called_once()
        assert listener.bl_page_snapshot == {"page1": "https://a.com"}

    def test_same_page_new_url_reinjects(self):
        """AC1b: navigation on the same page id must re-inject, not be suppressed."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_page_snapshot = {"page1": "https://a.com"}
        listener.bl_test_baggage = ("test1", "sess-1")
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [{"id": "page1", "url": "https://b.com"}], active_page_id="page1"
        )

        listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))

        mock_browser.evaluate_javascript.assert_called_once()
        assert listener.bl_page_snapshot == {"page1": "https://b.com"}

    def test_unchanged_page_does_not_inject(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_page_snapshot = {"page1": "https://a.com"}
        listener.bl_test_baggage = ("test1", "sess-1")
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [{"id": "page1", "url": "https://a.com"}], active_page_id="page1"
        )

        listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))

        mock_browser.evaluate_javascript.assert_not_called()
        assert listener.bl_page_snapshot == {"page1": "https://a.com"}

    def test_both_owner_and_libname_none_still_inspects(self):
        """Defensive fallback: if owner/libname are both missing, inspect anyway."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_test_baggage = ("test1", "sess-1")
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [{"id": "page1", "url": "https://a.com"}], active_page_id="page1"
        )

        listener.end_keyword(MagicMock(), MagicMock(owner=None, libname=None))

        mock_browser.get_browser_catalog.assert_called_once()


# ---------------------------------------------------------------------------
# Browser Library — start_keyword() close-pattern flush (S4)
# ---------------------------------------------------------------------------


class TestStartKeywordClosePatternFlush:
    def _make_catalog(self, pages, active_page_id=None):
        return [
            {
                "activeBrowser": True,
                "activeContext": "ctx1",
                "contexts": [
                    {"id": "ctx1", "activePage": active_page_id, "pages": pages}
                ],
            }
        ]

    def test_noop_when_browser_library_absent(self):
        listener = _make_listener()
        data = SimpleNamespace(name="Close Page")
        listener.start_keyword(data, MagicMock())
        # no crash; browser_lib stays None so nothing else to assert

    def test_close_pattern_keyword_flushes_before_close(self):
        """AC2b: sendAllFootprints must be invoked in start_keyword before the close runs."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [{"id": "page1", "url": "https://a.com"}], active_page_id="page1"
        )
        data = SimpleNamespace(name="Browser.Close Page")

        listener.start_keyword(data, MagicMock())

        mock_browser.evaluate_javascript.assert_called_once_with(
            None, _sl_listener.BROWSER_LIBRARY_FLUSH_SCRIPT
        )

    def test_non_close_keyword_does_not_flush(self):
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        data = SimpleNamespace(name="Click")

        listener.start_keyword(data, MagicMock())

        mock_browser.get_browser_catalog.assert_not_called()
        mock_browser.evaluate_javascript.assert_not_called()


# ---------------------------------------------------------------------------
# Browser Library — end_test() catch-all flush (S4)
# ---------------------------------------------------------------------------


class TestEndTestBrowserLibraryFlush:
    def _make_catalog(self, pages, active_page_id=None):
        return [
            {
                "activeBrowser": True,
                "activeContext": "ctx1",
                "contexts": [
                    {"id": "ctx1", "activePage": active_page_id, "pages": pages}
                ],
            }
        ]

    def test_flushes_each_open_page_and_clears_state(self):
        """AC4 flush side: genuinely multi-page — sendAllFootprints on each page."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        listener.bl_page_snapshot = {
            "page1": "https://a.com",
            "page2": "https://b.com",
        }
        listener.bl_test_baggage = ("test1", "sess-1")
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [
                {"id": "page1", "url": "https://a.com"},
                {"id": "page2", "url": "https://b.com"},
            ],
            active_page_id="page1",
        )

        listener.end_test(
            SimpleNamespace(name="Test 1"), SimpleNamespace(status="PASS")
        )

        assert mock_browser.evaluate_javascript.call_count == 2
        for call in mock_browser.evaluate_javascript.call_args_list:
            assert call.args == (None, _sl_listener.BROWSER_LIBRARY_FLUSH_SCRIPT)
        assert listener.bl_page_snapshot == {}
        assert listener.bl_test_baggage is None

    def test_evaluate_javascript_raising_is_swallowed_and_end_test_completes(self):
        """AC6 dedicated: a missing $SealightsAgent at flush must not crash end_test."""
        listener = _make_listener()
        mock_browser = MagicMock()
        listener.browser_lib = mock_browser
        mock_browser.evaluate_javascript.side_effect = RuntimeError(
            "$SealightsAgent missing"
        )
        mock_browser.get_browser_catalog.return_value = self._make_catalog(
            [{"id": "page1", "url": "https://a.com"}], active_page_id="page1"
        )

        listener.end_test(
            SimpleNamespace(name="Test 1"), SimpleNamespace(status="PASS")
        )

        assert listener.bl_page_snapshot == {}

    def test_span_teardown_still_runs(self):
        """Existing span-ending logic must be preserved alongside the new flush."""
        listener = _make_listener()
        test_name = listener.get_encoded_test_name("Test 1")
        listener.start_span(test_name)
        assert test_name in listener.spans

        listener.end_test(
            SimpleNamespace(name="Test 1"), SimpleNamespace(status="PASS")
        )

        assert test_name not in listener.spans

    def test_noop_when_browser_library_absent(self):
        listener = _make_listener()
        listener.end_test(
            SimpleNamespace(name="Test 1"), SimpleNamespace(status="PASS")
        )
        # no crash


# ---------------------------------------------------------------------------
# Browser Library — coexistence guards + non-regression (S5)
# ---------------------------------------------------------------------------


class TestBrowserLibraryCoexistenceGuards:
    def test_start_keyword_and_end_keyword_noop_when_browser_absent(self):
        """AC5: with Browser Library absent, the new hooks make no catalog calls."""
        listener = _make_listener()
        assert listener.browser_lib is None

        with patch.object(_sl_listener, "BuiltIn") as mock_builtin_cls:
            mock_builtin_cls.return_value.get_library_instance.side_effect = (
                RuntimeError("not imported")
            )
            listener.start_keyword(
                SimpleNamespace(name="Close Page"), MagicMock(owner="Browser")
            )
            listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))

        assert listener.browser_lib is None

    def test_hooks_before_first_start_test_do_not_raise(self):
        """AC5b: Suite Setup keywords fire before the first start_test — must not
        raise AttributeError against __init__-seeded state."""
        listener = _make_listener()

        listener.start_keyword(SimpleNamespace(name="Open Browser"), MagicMock())
        listener.end_keyword(MagicMock(), MagicMock(owner="Browser"))
        # no exception raised — hooks early-return against __init__-seeded state
