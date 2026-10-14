"""Tests run against a temporary copy of data/ and a temporary output dir."""

import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_TMP = Path(tempfile.mkdtemp(prefix="sb-test-"))
shutil.copytree(ROOT / "data", _TMP / "data", ignore=shutil.ignore_patterns("production-history.json", "questions.json"))
os.environ["SB_DATA_DIR"] = str(_TMP / "data")
os.environ["SB_OUTPUT_DIR"] = str(_TMP / "output")
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: renders real video (minutes)")


@pytest.fixture
def tmp_data():
    return _TMP / "data"
