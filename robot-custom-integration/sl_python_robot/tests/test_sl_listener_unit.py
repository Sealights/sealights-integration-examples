"""
Unit tests for SLListener testProjectId and Playwright instrumentation support.

All HTTP calls and JWT decoding are mocked so these tests run fast
with no network or token dependencies.

The module is imported as ``_sl_listener`` (registered by conftest.py)
to avoid collision with the ``robot`` package from robotframework.
"""

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
