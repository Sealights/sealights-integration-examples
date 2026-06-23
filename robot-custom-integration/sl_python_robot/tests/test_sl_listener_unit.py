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

        with patch.object(listener, "resolve_bsid_from_labid") as mock_resolve, \
             patch.object(listener, "create_test_session"), \
             patch.object(listener, "get_excluded_tests", return_value=[]), \
             patch.object(listener, "mark_tests_to_be_skipped"):
            listener.start_suite(suite, MagicMock())

        mock_resolve.assert_not_called()

    def test_calls_resolve_when_bsid_unset(self):
        """resolve_bsid_from_labid must be called exactly once when bsid is None."""
        listener = _make_listener(labid="lab-1", bsid=None)

        suite = MagicMock()
        suite.tests = [MagicMock()]
        suite.longname = "Suite"
        suite.source = "/path/to/suite.robot"

        with patch.object(listener, "resolve_bsid_from_labid") as mock_resolve, \
             patch.object(listener, "create_test_session"), \
             patch.object(listener, "get_excluded_tests", return_value=[]), \
             patch.object(listener, "mark_tests_to_be_skipped"):
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

    def test_tia_filtering_runs_on_every_suite(self):
        """mark_tests_to_be_skipped must be called for every suite, not just the first."""
        listener = _make_listener(bsid="bsid-1")

        with patch.object(listener, "create_test_session") as mock_create, \
             patch.object(listener, "get_excluded_tests", return_value=[]) as mock_get, \
             patch.object(listener, "mark_tests_to_be_skipped") as mock_mark:

            # First suite — creates the session
            listener.start_suite(self._make_suite(), MagicMock())
            # Simulate session being set (create_test_session is mocked)
            listener.test_session_id = "sess-1"
            # Second suite — reuses the session
            listener.start_suite(self._make_suite(), MagicMock())

        assert mock_create.call_count == 1
        assert mock_get.call_count == 2
        assert mock_mark.call_count == 2


# ---------------------------------------------------------------------------
# Playwright instrumentation — try_instrument_playwright()
# ---------------------------------------------------------------------------

class TestTryInstrumentPlaywright:
    def test_patches_playwright_page_when_available(self):
        """When PlaywrightPage is not None, goto and close should be patched."""
        original_goto = MagicMock()
        original_close = MagicMock()

        mock_page_cls = type("MockPage", (), {"goto": original_goto, "close": original_close})
        mock_ctx_cls = type("MockCtx", (), {"close": MagicMock()})

        with patch.object(_sl_listener, "PlaywrightPage", mock_page_cls), \
             patch.object(_sl_listener, "PlaywrightBrowserContext", mock_ctx_cls):
            listener = _make_listener()
            listener.try_instrument_playwright("test1", "sess-1")

        assert mock_page_cls.goto is not original_goto
        assert mock_page_cls.close is not original_close

    def test_noop_when_playwright_not_installed(self):
        """When PlaywrightPage is None, no patching should occur."""
        with patch.object(_sl_listener, "PlaywrightPage", None), \
             patch.object(_sl_listener, "PlaywrightBrowserContext", None):
            listener = _make_listener()
            listener.try_instrument_playwright("test1", "sess-1")


# ---------------------------------------------------------------------------
# build_test_results() — per-test timestamps (SLDEV-28046)
# ---------------------------------------------------------------------------

class TestBuildTestResults:
    def _make_test(self, name, status, starttime, endtime):
        return SimpleNamespace(name=name, status=status, starttime=starttime, endtime=endtime)

    def _make_suite_result(self, tests, suite_starttime, suite_endtime):
        return SimpleNamespace(tests=tests, starttime=suite_starttime, endtime=suite_endtime)

    def test_uses_per_test_timestamps_not_suite(self):
        """Each result entry must carry the individual test's start/end, not the suite's."""
        listener = _make_listener()
        t1 = self._make_test("Test A", "PASS", "20240101 00:00:01.000", "20240101 00:00:02.000")
        t2 = self._make_test("Test B", "PASS", "20240101 00:00:03.000", "20240101 00:00:05.000")
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
        t1 = self._make_test("Slow Test", "PASS", "20240101 00:00:00.000", "20240101 00:00:30.000")
        t2 = self._make_test("Fast Test", "PASS", "20240101 00:00:31.000", "20240101 00:00:32.000")
        suite_result = self._make_suite_result([t1, t2], "20240101 00:00:00.000", "20240101 00:00:32.000")

        results = listener.build_test_results(suite_result)

        assert results[0]["start"] != results[1]["start"]
        assert results[0]["end"] != results[1]["end"]

    def test_none_timestamps_for_skipped_test(self):
        """Tests with None starttime/endtime (e.g. skipped before execution) must not crash."""
        listener = _make_listener()
        t = self._make_test("Skipped Test", "SKIP", None, None)
        suite_result = self._make_suite_result([t], "20240101 00:00:00.000", "20240101 00:00:01.000")

        results = listener.build_test_results(suite_result)

        assert results[0] == {
            "name": "Skipped Test",
            "status": "skipped",
            "start": 0,
            "end": 0,
        }
