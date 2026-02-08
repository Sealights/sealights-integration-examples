"""
Test suite for SLListener - Robot Framework SeaLights integration.

Tests cover:
- Initialization with various combinations of bsid/labid/stagename
- Tag-based test identification (_get_test_identifier)
- Excluded tests matching (by name vs by tag)
- Build results aggregation (with and without tags)
- API integration with mocked responses
"""

import sys
import os
import pytest
from unittest.mock import MagicMock, patch

# Add parent directory to path so we can import SLListener
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# --- Mock dependencies before importing SLListener ---


@pytest.fixture(autouse=True)
def mock_dependencies():
    """Mock external dependencies before importing SLListener."""
    # Create mock modules
    mock_jwt = MagicMock()
    mock_jwt.decode = MagicMock(
        return_value={"x-sl-server": "https://example.sealights.co/api"}
    )

    mock_requests = MagicMock()

    mock_trace = MagicMock()
    mock_context = MagicMock()
    mock_baggage = MagicMock()
    mock_otel = MagicMock()
    mock_otel.trace = mock_trace
    mock_otel.context = mock_context
    mock_otel.baggage = mock_baggage

    # Patch sys.modules before import
    with patch.dict(
        sys.modules,
        {
            "jwt": mock_jwt,
            "requests": mock_requests,
            "opentelemetry": mock_otel,
            "opentelemetry.trace": mock_trace,
            "opentelemetry.context": mock_context,
            "opentelemetry.baggage": mock_baggage,
        },
    ):
        # Force reimport
        if "SLListener" in sys.modules:
            del sys.modules["SLListener"]

        yield {
            "jwt": mock_jwt,
            "requests": mock_requests,
            "trace": mock_trace,
            "context": mock_context,
            "baggage": mock_baggage,
        }


# --- Mock Helpers ---


class MockBody:
    """Mock Robot Framework test body."""

    def __init__(self):
        self._keywords = []

    def create_keyword(self, name):
        self._keywords.append(name)

    def pop(self):
        return self._keywords.pop() if self._keywords else None

    def insert(self, index, item):
        self._keywords.insert(index, item)


class MockTest:
    """Mock Robot Framework test object."""

    def __init__(
        self,
        name,
        tags=None,
        status="PASS",
        starttime="20240101 10:00:00.000",
        endtime="20240101 10:00:01.000",
    ):
        self.name = name
        self.tags = tags or []
        self.status = status
        self.starttime = starttime
        self.endtime = endtime
        self.body = MockBody()
        self._has_teardown = False
        self.teardown = None

    def has_teardown(self):
        return self._has_teardown


class MockSuite:
    """Mock Robot Framework suite object."""

    def __init__(self, tests=None):
        self.tests = tests or []
        self.longname = "MockSuite"


class MockResult:
    """Mock Robot Framework result object."""

    def __init__(
        self,
        tests=None,
        starttime="20240101 10:00:00.000",
        endtime="20240101 10:00:05.000",
    ):
        self.tests = tests or []
        self.starttime = starttime
        self.endtime = endtime


# --- Fixtures ---


@pytest.fixture
def listener_with_bsid(mock_dependencies):
    """Create a listener with bsid only."""
    from SLListener import SLListener

    return SLListener(
        sltoken="mock.token", bsid="test-bsid-123", stagename="unit-tests"
    )


@pytest.fixture
def listener_with_labid(mock_dependencies):
    """Create a listener with labid only."""
    from SLListener import SLListener

    return SLListener(
        sltoken="mock.token", labid="test-labid-456", stagename="unit-tests"
    )


@pytest.fixture
def listener_with_tags(mock_dependencies):
    """Create a listener with use_tags=True."""
    from SLListener import SLListener

    return SLListener(
        sltoken="mock.token",
        bsid="test-bsid-123",
        stagename="unit-tests",
        use_tags=True,
    )


# --- Initialization Tests ---


class TestSLListenerInit:
    """Tests for SLListener initialization."""

    def test_init_with_bsid_only(self, mock_dependencies):
        """Test initialization with bsid provided, no labId - should enable."""
        from SLListener import SLListener

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        assert listener.enabled is True
        assert listener.bsid == "test-bsid"
        assert listener.labid is None

    def test_init_with_labid_only(self, mock_dependencies):
        """Test initialization with labId provided, no bsid - should enable."""
        from SLListener import SLListener

        listener = SLListener(
            sltoken="mock.token", labid="test-labid", stagename="test-stage"
        )
        assert listener.enabled is True
        assert listener.labid == "test-labid"
        assert listener.bsid is None

    def test_init_with_both_bsid_and_labid(self, mock_dependencies, capsys):
        """Test initialization with both bsid and labId - should log message about using labId."""
        from SLListener import SLListener

        listener = SLListener(
            sltoken="mock.token",
            bsid="test-bsid",
            labid="test-labid",
            stagename="test-stage",
        )
        assert listener.enabled is True
        captured = capsys.readouterr()
        assert "labId" in captured.out

    def test_init_without_bsid_or_labid(self, mock_dependencies):
        """Test initialization without bsid or labId - should disable."""
        from SLListener import SLListener

        listener = SLListener(sltoken="mock.token", stagename="test-stage")
        assert listener.enabled is False
        assert "Either 'bsid' or 'labId' must be provided" in listener.disabled_reason

    def test_init_without_stagename(self, mock_dependencies):
        """Test initialization without stagename - should disable."""
        from SLListener import SLListener

        listener = SLListener(sltoken="mock.token", bsid="test-bsid")
        assert listener.enabled is False
        assert "Stage name is required" in listener.disabled_reason

    def test_init_use_tags_default_false(self, mock_dependencies):
        """Test that use_tags defaults to False."""
        from SLListener import SLListener

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        assert listener.use_tags is False

    def test_init_use_tags_true(self, mock_dependencies):
        """Test initialization with use_tags=True."""
        from SLListener import SLListener

        listener = SLListener(
            sltoken="mock.token",
            bsid="test-bsid",
            stagename="test-stage",
            use_tags=True,
        )
        assert listener.use_tags is True


# --- Test Identifier Tests ---


class TestGetTestIdentifier:
    """Tests for _get_test_identifier method."""

    def test_get_test_identifier_without_tags_mode(self, listener_with_bsid):
        """Test that use_tags=False returns test.name."""
        test = MockTest(name="TestLogin", tags=["Login", "Smoke"])
        result = listener_with_bsid._get_test_identifier(test)
        assert result == "TestLogin"

    def test_get_test_identifier_with_tags_mode_has_tags(self, listener_with_tags):
        """Test that use_tags=True with tags returns first tag."""
        test = MockTest(name="TestLogin_Chrome", tags=["Login", "Smoke"])
        result = listener_with_tags._get_test_identifier(test)
        assert result == "Login"

    def test_get_test_identifier_with_tags_mode_no_tags(self, listener_with_tags):
        """Test that use_tags=True without tags falls back to test.name."""
        test = MockTest(name="TestLogin", tags=[])
        result = listener_with_tags._get_test_identifier(test)
        assert result == "TestLogin"

    def test_get_test_identifier_with_tags_mode_empty_tags_list(
        self, listener_with_tags
    ):
        """Test fallback when tags list is empty."""
        test = MockTest(name="MyTest", tags=[])
        result = listener_with_tags._get_test_identifier(test)
        assert result == "MyTest"


# --- Excluded Tests Tests ---


class TestExcludedTests:
    """Tests for excluded tests matching."""

    def test_mark_tests_skipped_by_name(self, listener_with_bsid):
        """Test that use_tags=False matches excluded tests by test.name."""
        test1 = MockTest(name="TestLogin")
        test2 = MockTest(name="TestLogout")
        test3 = MockTest(name="TestDashboard")
        suite = MockSuite(tests=[test1, test2, test3])

        listener_with_bsid.excluded_tests = {"TestLogin", "TestDashboard"}
        listener_with_bsid.mark_tests_to_be_skipped(suite)

        # TestLogin and TestDashboard should have SKIP keyword added
        assert "SKIP" in test1.body._keywords
        assert "SKIP" not in test2.body._keywords
        assert "SKIP" in test3.body._keywords

    def test_mark_tests_skipped_by_tag(self, listener_with_tags):
        """Test that use_tags=True matches excluded tests by first tag."""
        test1 = MockTest(name="TestLogin_Chrome", tags=["Login"])
        test2 = MockTest(name="TestLogin_Firefox", tags=["Login"])
        test3 = MockTest(name="TestCheckout", tags=["Checkout"])
        suite = MockSuite(tests=[test1, test2, test3])

        listener_with_tags.excluded_tests = {"Login"}
        listener_with_tags.mark_tests_to_be_skipped(suite)

        # Both Login tests should be skipped, Checkout should not
        assert "SKIP" in test1.body._keywords
        assert "SKIP" in test2.body._keywords
        assert "SKIP" not in test3.body._keywords

    def test_no_tests_excluded(self, listener_with_bsid):
        """Test that empty excluded list doesn't skip any tests."""
        test1 = MockTest(name="TestLogin")
        test2 = MockTest(name="TestLogout")
        suite = MockSuite(tests=[test1, test2])

        listener_with_bsid.excluded_tests = set()
        listener_with_bsid.mark_tests_to_be_skipped(suite)

        assert "SKIP" not in test1.body._keywords
        assert "SKIP" not in test2.body._keywords

    def test_mark_tests_skipped_mixed_tags_no_tags(self, listener_with_tags):
        """Test mixed scenario: some tests have tags, some don't."""
        test1 = MockTest(name="TestLogin_Chrome", tags=["Login"])
        test2 = MockTest(name="TestWithoutTag", tags=[])  # Falls back to name
        suite = MockSuite(tests=[test1, test2])

        listener_with_tags.excluded_tests = {"Login", "TestWithoutTag"}
        listener_with_tags.mark_tests_to_be_skipped(suite)

        assert "SKIP" in test1.body._keywords
        assert "SKIP" in test2.body._keywords


# --- Build Results Tests ---


class TestBuildTestResults:
    """Tests for build_test_results method."""

    def test_build_results_without_tags(self, listener_with_bsid):
        """Test default mode returns individual results."""
        test1 = MockTest(name="Test1", status="PASS")
        test2 = MockTest(name="Test2", status="FAIL")
        result = MockResult(tests=[test1, test2])

        results = listener_with_bsid.build_test_results(result)

        assert len(results) == 2
        assert results[0]["name"] == "Test1"
        assert results[1]["name"] == "Test2"

    def test_build_results_with_tags_grouping(self, listener_with_tags):
        """Test tags mode groups results by tag."""
        test1 = MockTest(
            name="TestLogin_Chrome",
            tags=["Login"],
            status="PASS",
            starttime="20240101 10:00:00.000",
            endtime="20240101 10:00:01.000",
        )
        test2 = MockTest(
            name="TestLogin_Firefox",
            tags=["Login"],
            status="PASS",
            starttime="20240101 10:00:02.000",
            endtime="20240101 10:00:03.000",
        )
        test3 = MockTest(
            name="TestCheckout",
            tags=["Checkout"],
            status="PASS",
            starttime="20240101 10:00:04.000",
            endtime="20240101 10:00:05.000",
        )
        result = MockResult(tests=[test1, test2, test3])

        results = listener_with_tags.build_test_results(result)

        assert len(results) == 2
        names = [r["name"] for r in results]
        assert "Login" in names
        assert "Checkout" in names

    def test_build_results_aggregation_all_passed(self, listener_with_tags):
        """Test aggregation: all same tag passed → passed."""
        test1 = MockTest(name="Test1", tags=["Login"], status="PASS")
        test2 = MockTest(name="Test2", tags=["Login"], status="PASS")
        result = MockResult(tests=[test1, test2])

        results = listener_with_tags.build_test_results(result)

        assert len(results) == 1
        assert results[0]["name"] == "Login"
        assert results[0]["status"] == "passed"

    def test_build_results_aggregation_any_failed(self, listener_with_tags):
        """Test aggregation: any failed → failed."""
        test1 = MockTest(name="Test1", tags=["Login"], status="PASS")
        test2 = MockTest(name="Test2", tags=["Login"], status="FAIL")
        test3 = MockTest(name="Test3", tags=["Login"], status="PASS")
        result = MockResult(tests=[test1, test2, test3])

        results = listener_with_tags.build_test_results(result)

        assert len(results) == 1
        assert results[0]["name"] == "Login"
        assert results[0]["status"] == "failed"

    def test_build_results_aggregation_all_skipped(self, listener_with_tags):
        """Test aggregation: all skipped → skipped."""
        test1 = MockTest(name="Test1", tags=["Login"], status="SKIP")
        test2 = MockTest(name="Test2", tags=["Login"], status="SKIP")
        result = MockResult(tests=[test1, test2])

        results = listener_with_tags.build_test_results(result)

        assert len(results) == 1
        assert results[0]["name"] == "Login"
        assert results[0]["status"] == "skipped"

    def test_build_results_aggregation_timing(self, listener_with_tags):
        """Test aggregation uses min(start), max(end)."""
        test1 = MockTest(
            name="Test1",
            tags=["Login"],
            status="PASS",
            starttime="20240101 10:00:05.000",  # Later start
            endtime="20240101 10:00:06.000",
        )
        test2 = MockTest(
            name="Test2",
            tags=["Login"],
            status="PASS",
            starttime="20240101 10:00:00.000",  # Earlier start
            endtime="20240101 10:00:10.000",  # Later end
        )
        result = MockResult(tests=[test1, test2])

        results = listener_with_tags.build_test_results(result)

        assert len(results) == 1
        # Should use the earlier start time (10:00:00)
        expected_start = listener_with_tags.get_epoch_timestamp("20240101 10:00:00.000")
        # Should use the later end time (10:00:10)
        expected_end = listener_with_tags.get_epoch_timestamp("20240101 10:00:10.000")
        assert results[0]["start"] == expected_start
        assert results[0]["end"] == expected_end

    def test_build_results_mixed_passed_skipped(self, listener_with_tags):
        """Test aggregation: mixed passed and skipped → passed (not all skipped)."""
        test1 = MockTest(name="Test1", tags=["Login"], status="PASS")
        test2 = MockTest(name="Test2", tags=["Login"], status="SKIP")
        result = MockResult(tests=[test1, test2])

        results = listener_with_tags.build_test_results(result)

        assert len(results) == 1
        assert results[0]["status"] == "passed"


# --- API Integration Tests ---


class TestAPIIntegration:
    """Tests for API integration with mocked responses."""

    def test_resolve_bsid_from_labid_success(self, mock_dependencies):
        """Test successful labId resolution returns bsid."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"buildSessionId": "resolved-bsid-789"}
        mock_dependencies["requests"].get.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", labid="test-labid", stagename="test-stage"
        )
        listener.resolve_bsid_from_labid()

        assert listener.bsid == "resolved-bsid-789"
        assert listener.enabled is True

    def test_resolve_bsid_from_labid_404(self, mock_dependencies):
        """Test 404 response disables listener."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_dependencies["requests"].get.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", labid="test-labid", stagename="test-stage"
        )
        listener.resolve_bsid_from_labid()

        assert listener.enabled is False
        assert "No active build session found" in listener.disabled_reason

    def test_resolve_bsid_from_labid_500(self, mock_dependencies):
        """Test 500 response disables listener."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_dependencies["requests"].get.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", labid="test-labid", stagename="test-stage"
        )
        listener.resolve_bsid_from_labid()

        assert listener.enabled is False
        assert "Server error" in listener.disabled_reason

    def test_create_test_session_success(self, mock_dependencies):
        """Test successful session creation sets test_session_id."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {"data": {"testSessionId": "session-123"}}
        mock_dependencies["requests"].post.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        listener.create_test_session()

        assert listener.test_session_id == "session-123"
        # Verify correct payload was sent
        call_args = mock_dependencies["requests"].post.call_args
        payload = call_args[1]["json"]
        assert payload["bsid"] == "test-bsid"
        assert payload["testStage"] == "test-stage"

    def test_create_test_session_failure(self, mock_dependencies, capsys):
        """Test failed session creation logs error."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.ok = False
        mock_response.status_code = 500
        mock_dependencies["requests"].post.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        listener.create_test_session()

        assert listener.test_session_id is None
        captured = capsys.readouterr()
        assert "Failed to open Test Session" in captured.out

    def test_get_excluded_tests_success(self, mock_dependencies):
        """Test successful retrieval of excluded tests."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": ["Test1", "Test2", "Test3"]}
        mock_dependencies["requests"].get.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        listener.test_session_id = "session-123"
        excluded = listener.get_excluded_tests()

        assert excluded == ["Test1", "Test2", "Test3"]
        # Verify correct endpoint was called
        call_args = mock_dependencies["requests"].get.call_args
        assert "session-123" in call_args[0][0]
        assert "exclude-tests" in call_args[0][0]

    def test_get_excluded_tests_empty(self, mock_dependencies):
        """Test empty excluded tests list."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": []}
        mock_dependencies["requests"].get.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        listener.test_session_id = "session-123"
        excluded = listener.get_excluded_tests()

        assert excluded == []

    def test_send_test_results_success(self, mock_dependencies):
        """Test successful sending of test results."""
        from SLListener import SLListener

        mock_response = MagicMock()
        mock_response.ok = True
        mock_dependencies["requests"].post.return_value = mock_response

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        listener.test_session_id = "session-123"
        test_results = [{"name": "Test1", "status": "passed", "start": 0, "end": 1000}]

        listener.send_test_results(test_results)

        # Verify post was called with correct URL and data
        mock_dependencies["requests"].post.assert_called_once()
        call_args = mock_dependencies["requests"].post.call_args
        assert "session-123" in call_args[0][0]  # URL contains session ID
        assert call_args[1]["json"] == test_results  # Correct payload sent

    def test_end_test_session(self, mock_dependencies):
        """Test ending test session."""
        from SLListener import SLListener

        mock_dependencies["requests"].delete.return_value = MagicMock()

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        listener.test_session_id = "session-123"
        listener.end_test_session()

        assert listener.test_session_id == ""
        mock_dependencies["requests"].delete.assert_called_once()
        call_args = mock_dependencies["requests"].delete.call_args
        assert "session-123" in call_args[0][0]  # URL contains session ID


# --- Helper Method Tests ---


class TestHelperMethods:
    """Tests for helper methods."""

    def test_get_epoch_timestamp(self, listener_with_bsid):
        """Test timestamp conversion."""
        timestamp = listener_with_bsid.get_epoch_timestamp("20240101 10:00:00.000")
        # 2024-01-01 10:00:00 UTC = 1704103200000 ms (assuming local time interpretation)
        # Verify it's a reasonable timestamp (after year 2000, before year 2100)
        assert isinstance(timestamp, int)
        assert 946684800000 < timestamp < 4102444800000  # Between 2000 and 2100
        # Verify two different timestamps produce different results
        timestamp2 = listener_with_bsid.get_epoch_timestamp("20240101 10:00:01.000")
        assert timestamp2 == timestamp + 1000  # 1 second = 1000ms difference

    def test_get_encoded_test_name(self, listener_with_bsid):
        """Test URL encoding of test names."""
        result = listener_with_bsid.get_encoded_test_name("Test With Spaces")
        assert " " not in result
        assert result == "Test%20With%20Spaces"

    def test_get_encoded_test_name_special_chars(self, listener_with_bsid):
        """Test URL encoding of special characters."""
        result = listener_with_bsid.get_encoded_test_name("Test/With/Slashes")
        assert result == "Test%2FWith%2FSlashes"

    def test_extract_sl_endpoint(self, mock_dependencies):
        """Test endpoint extraction from token."""
        from SLListener import SLListener

        listener = SLListener(
            sltoken="mock.token", bsid="test-bsid", stagename="test-stage"
        )
        # Mock returns "https://example.sealights.co/api", should become "https://example.sealights.co/sl-api"
        assert listener.base_url == "https://example.sealights.co/sl-api"

    def test_get_header(self, listener_with_bsid):
        """Test header generation."""
        headers = listener_with_bsid.get_header()
        assert "Authorization" in headers
        assert headers["Authorization"].startswith("Bearer ")
        assert headers["Content-Type"] == "application/json"
