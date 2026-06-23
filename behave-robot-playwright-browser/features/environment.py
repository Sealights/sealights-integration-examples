"""Behave lifecycle hooks for the SeaLights Behave + Playwright demo.

The SeaLights Python agent (slpython behave runner) auto-detects a
Playwright-like page on the Behave ``context``. By default it looks for
``context.page`` -- this is what we attach below in ``before_scenario``.

The agent wraps Behave's ``run_hook`` to inject its own logic in this order:

* before_scenario: SL backend (TIA / test start)
  -> user before_scenario (this file: create page + navigate)
  -> SL ``run_browser_set_test`` (dispatches set:context with baggage)
* after_scenario: SL ``run_browser_flush`` (calls window.$SealightsAgent.sendAllFootprints)
  -> user after_scenario (this file: close page)
  -> SL test end

We do NOT need to import or call any SeaLights API here. The agent attaches
itself when ``slpython behave ...`` is the runner.

Browser console logging
-----------------------
Behave captures stdout/stderr per scenario and only displays it when the
scenario fails. To get a reliable record of browser-agent activity (which is
silent when everything works), we forward filtered ``page.on("console")``
events to ``logs/browser-console.log`` instead of stdout. The file is
truncated at the start of each Behave run. Tail it with::

    tail -f logs/browser-console.log

Disable logging entirely with ``LOG_BROWSER_CONSOLE=false``.
Override the directory with ``LOG_DIR=/some/path``.
Set ``LOG_BROWSER_CONSOLE_VERBOSE=true`` to capture every console line
(including app debug noise) -- useful when you suspect the filter is hiding
something.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

APP_URL = os.environ.get("APP_URL", "http://localhost:3333")
HEADLESS = os.environ.get("HEADLESS", "true").lower() != "false"
WAIT_FOR_AGENT_MS = int(os.environ.get("WAIT_FOR_AGENT_MS", "5000"))
LOG_BROWSER_CONSOLE = os.environ.get("LOG_BROWSER_CONSOLE", "true").lower() != "false"
# When VERBOSE, every browser console line is forwarded (useful for "is the
# agent actually doing anything?" investigations).
LOG_BROWSER_CONSOLE_VERBOSE = (
    os.environ.get("LOG_BROWSER_CONSOLE_VERBOSE", "false").lower() == "true"
)

# Browser console logs go to a file (not stdout) because Behave captures
# stdout/stderr per scenario and only surfaces it on failure. Writing to a
# dedicated file keeps the test terminal clean and gives a persistent record
# of browser-agent activity (setBaggage / setContext / sendFootprints / errors).
LOG_DIR = Path(os.environ.get("LOG_DIR", "logs"))
BROWSER_LOG_FILE = LOG_DIR / "browser-console.log"

# Module-level handle so all scenarios append to the same file.
_browser_log_fh = None


def _open_browser_log():
    """Open (and truncate) the browser console log file for this Behave run."""
    global _browser_log_fh
    if not LOG_BROWSER_CONSOLE:
        return
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    _browser_log_fh = BROWSER_LOG_FILE.open("w", encoding="utf-8", buffering=1)
    _browser_log_fh.write(
        f"# Browser console log -- run started {datetime.now(timezone.utc).isoformat()}\n"
    )
    # Surface the log location so the user knows where to tail it. Use the
    # real stderr fd to bypass Behave stdout/stderr capture.
    try:
        os.write(sys.__stderr__.fileno(), f"==> Browser console logs -> {BROWSER_LOG_FILE}\n".encode())
    except Exception:
        pass


def _close_browser_log():
    """Close the browser console log file (called from after_all)."""
    global _browser_log_fh
    if _browser_log_fh is not None:
        try:
            _browser_log_fh.close()
        finally:
            _browser_log_fh = None


def _attach_console_logger(page, scenario_name: str):
    """Forward browser console messages to the run-scoped log file.

    Default filter is wide on purpose so the file shows the whole browser-agent
    lifecycle (startup, active-execution polling, submission attempts/errors).
    Lines that match are:

    - Any error or warning (network failures, CORS, exceptions, ...).
    - Any structured agent log -- the browser-agent emits JSON of the form
      ``{"level":"INFO","ts":"...","msg":"..."}`` for everything from
      "Agent is starting." to "[ACTIVE EXECUTION] ...".
      We detect this with the ``"level":"`` substring.
    - Any line mentioning ``sealight`` / ``sl-`` / ``baggage`` (catches custom
      events and miscellaneous SL output that isn't in JSON format).

    Set ``LOG_BROWSER_CONSOLE_VERBOSE=true`` to forward every console line,
    including app debug noise -- useful when you suspect the filter is hiding
    something but expect the file to be much larger.
    """
    if _browser_log_fh is None:
        return

    def on_console(msg):
        try:
            text = msg.text
            mtype = msg.type
        except Exception:
            return
        if LOG_BROWSER_CONSOLE_VERBOSE:
            should_log = True
        else:
            lowered = text.lower()
            should_log = (
                mtype in ("error", "warning")
                or '"level":"' in text
                or "sealight" in lowered
                or "sl-" in lowered
                or "baggage" in lowered
            )
        if should_log:
            ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
            _browser_log_fh.write(f"[{ts}] [{scenario_name}] [{mtype}] {text}\n")

    page.on("console", on_console)


def before_all(context):
    _open_browser_log()
    context.playwright = sync_playwright().start()
    context.browser = context.playwright.chromium.launch(headless=HEADLESS)


def before_scenario(context, scenario):
    context.browser_context = context.browser.new_context()
    context.page = context.browser_context.new_page()
    _attach_console_logger(context.page, scenario.name)
    context.page.goto(APP_URL)

    try:
        context.page.wait_for_function(
            "window.$SealightsAgent !== undefined",
            timeout=WAIT_FOR_AGENT_MS,
        )
    except Exception:
        # Browser agent not present (e.g. running against un-instrumented build).
        # The SeaLights helper is a no-op when window.$SealightsAgent is absent,
        # so tests still run -- just without browser coverage coloring.
        pass


def after_scenario(context, scenario):
    if getattr(context, "browser_context", None) is not None:
        context.browser_context.close()
        context.browser_context = None
        context.page = None


def after_all(context):
    if getattr(context, "browser", None) is not None:
        context.browser.close()
    if getattr(context, "playwright", None) is not None:
        context.playwright.stop()
    _close_browser_log()
