"""
Conftest for robot/tests.

1. Stubs out heavy third-party dependencies (opentelemetry, selenium,
   playwright) so tests can import SLListener without those packages installed.
2. Loads SLListener.py via importlib and registers it as ``_sl_listener``
   in sys.modules to avoid a naming collision with the ``robotframework``
   package (which also installs as ``robot``).
"""

import importlib.util
import os
import sys
from unittest.mock import MagicMock


def _stub_module(name):
    """Insert a MagicMock as a fake module if not already importable."""
    if name not in sys.modules:
        sys.modules[name] = MagicMock()


# opentelemetry tree
for _mod in [
    "opentelemetry",
    "opentelemetry.trace",
    "opentelemetry.context",
    "opentelemetry.baggage",
]:
    _stub_module(_mod)

# selenium (optional at runtime, but guard the import)
for _mod in [
    "selenium",
    "selenium.webdriver",
    "selenium.webdriver.remote",
    "selenium.webdriver.remote.webdriver",
]:
    _stub_module(_mod)

# playwright (optional at runtime, but guard the import)
for _mod in [
    "playwright",
    "playwright.sync_api",
]:
    _stub_module(_mod)

# ---------------------------------------------------------------------------
# Load robot/SLListener.py under the alias ``_sl_listener`` so that both
# unit and component tests can ``import _sl_listener`` without conflicting
# with the ``robot`` package installed by robotframework.
# ---------------------------------------------------------------------------
_listener_path = os.path.normpath(
    os.path.join(os.path.dirname(__file__), os.pardir, "SLListener.py")
)
_spec = importlib.util.spec_from_file_location("_sl_listener", _listener_path)
_sl_listener = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sl_listener)
sys.modules["_sl_listener"] = _sl_listener
