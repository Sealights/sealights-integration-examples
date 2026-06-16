"""Robot Framework keyword library for the calculator demo app.

Drives the UI through Playwright's **native Python sync API**
(``playwright.sync_api``) -- NOT the Robot ``Browser`` library (which is a
Node.js/gRPC bridge) and not Selenium. Each keyword operates on a real
``playwright.sync_api.Page`` object that this library owns.

This is the integration shape that works with the SeaLights Robot listener:
SeaLights instruments ``playwright.sync_api.Page`` directly, so as long as the
UI is driven through a real sync ``Page`` (as it is here), coverage coloring
can be layered on later without changing these keywords.
"""

from __future__ import annotations

from playwright.sync_api import sync_playwright, expect


class CalculatorLibrary:
    ROBOT_LIBRARY_SCOPE = "GLOBAL"

    def __init__(self, base_url: str = "http://localhost:3333", headless: str = "true"):
        self.base_url = base_url
        self.headless = str(headless).lower() != "false"
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    # --- lifecycle keywords ---

    def open_calculator(self):
        """Launch a fresh browser context/page and navigate to the app."""
        if self._playwright is None:
            self._playwright = sync_playwright().start()
        if self._browser is None:
            self._browser = self._playwright.chromium.launch(headless=self.headless)
        self._context = self._browser.new_context()
        self._page = self._context.new_page()
        self._page.goto(self.base_url)
        self._page.wait_for_selector("#calc-form")

    def close_calculator(self):
        """Close the current context/page (called per test)."""
        if self._context is not None:
            self._context.close()
        self._context = None
        self._page = None

    def shutdown(self):
        """Close the browser and stop Playwright (called once per suite)."""
        if self._browser is not None:
            self._browser.close()
            self._browser = None
        if self._playwright is not None:
            self._playwright.stop()
            self._playwright = None

    # --- interaction keywords ---

    def enter_number(self, field: str, value):
        """Fill ``#<field>`` (e.g. ``number1``) with ``value``."""
        self._require_page().locator(f"#{field}").fill(str(value))

    def click_operation(self, button: str):
        """Click ``#<button>`` (e.g. ``addBtn`` / ``subtractBtn`` / ``resetBtn``)."""
        self._require_page().locator(f"#{button}").click()

    # --- assertion keywords ---

    def result_should_be(self, expected):
        expect(self._require_page().locator("#result")).to_have_text(str(expected))

    def result_should_be_empty(self):
        expect(self._require_page().locator("#result")).to_have_text("")

    def error_should_be(self, message: str):
        expect(self._require_page().locator("#error")).to_have_text(message)

    def field_should_be_empty(self, field: str):
        expect(self._require_page().locator(f"#{field}")).to_have_value("")

    # --- internal ---

    def _require_page(self):
        if self._page is None:
            raise RuntimeError("No active page. Call 'Open Calculator' first.")
        return self._page
