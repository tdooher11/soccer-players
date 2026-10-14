"""Paths and settings. Everything is overridable with environment variables or a .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines). Real env vars win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(ROOT / ".env")


def _path(env: str, default: Path) -> Path:
    v = os.environ.get(env)
    return Path(v).expanduser().resolve() if v else default


@dataclass(frozen=True)
class Settings:
    root: Path = ROOT
    data_dir: Path = field(default_factory=lambda: _path("SB_DATA_DIR", ROOT / "data"))
    public_dir: Path = field(default_factory=lambda: _path("SB_PUBLIC_DIR", ROOT / "public"))
    output_dir: Path = field(default_factory=lambda: _path("SB_OUTPUT_DIR", ROOT / "output"))
    models_dir: Path = field(default_factory=lambda: _path("SB_MODELS_DIR", ROOT / "models"))
    # The curated master list (the soccer-players site's players.json one level up).
    master_list: Path = field(default_factory=lambda: _path("SB_MASTER_LIST", ROOT.parent / "players.json"))
    master_js: Path = field(default_factory=lambda: _path("SB_MASTER_JS", ROOT.parent / "players.js"))
    master_assets: Path = field(default_factory=lambda: _path("SB_MASTER_ASSETS", ROOT.parent / "assets"))
    channel_name: str = field(default_factory=lambda: os.environ.get("SB_CHANNEL_NAME", "Soccer Brain"))
    channel_handle: str | None = field(default_factory=lambda: os.environ.get("SB_CHANNEL_HANDLE") or None)
    tts_provider: str = field(default_factory=lambda: os.environ.get("SB_TTS_PROVIDER", "kokoro"))
    tts_voice: str | None = field(default_factory=lambda: os.environ.get("SB_TTS_VOICE") or None)
    browser_executable: str | None = field(
        default_factory=lambda: os.environ.get("REMOTION_BROWSER_EXECUTABLE")
        or next(
            (
                str(p)
                for p in [
                    Path("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"),
                    Path("/opt/pw-browsers/chromium-1194/chrome-linux/chrome"),
                ]
                if p.exists()
            ),
            None,
        )
    )
    render_concurrency: int | None = field(
        default_factory=lambda: int(os.environ["SB_RENDER_CONCURRENCY"]) if os.environ.get("SB_RENDER_CONCURRENCY") else None
    )
    current_club_max_age_days: int = field(default_factory=lambda: int(os.environ.get("SB_CURRENT_CLUB_MAX_AGE_DAYS", "120")))


settings = Settings()
