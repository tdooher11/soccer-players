"""Thin wrapper around scripts/render.mjs — the single render implementation."""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .config import settings

log = logging.getLogger(__name__)


@dataclass
class RenderJob:
    id: str
    props: dict
    output: Path
    thumbnail: Path | None = None
    thumbnail_frame: int = 0


@dataclass
class RenderResult:
    ok: dict[str, Path] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)


ProgressFn = Callable[[dict], None]


LOUDNESS_TARGET_LUFS = -14.0  # YouTube's playback reference


def finalize_audio(path: Path) -> None:
    """Two-pass loudness normalisation of the AAC track, in place (video stream is copied)."""
    base = f"loudnorm=I={LOUDNESS_TARGET_LUFS}:TP=-1.5:LRA=11"
    probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", base + ":print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    m = json.loads(probe.stderr[probe.stderr.rindex("{") : probe.stderr.rindex("}") + 1])
    af = (
        f"{base}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
        f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    tmp = path.with_suffix(".norm.mp4")
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(path),
        "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(tmp),
    ]
    subprocess.run(cmd, check=True)
    tmp.replace(path)


def render(jobs: list[RenderJob], on_event: ProgressFn | None = None) -> RenderResult:
    """Render jobs (one bundle, sequential renders). Never raises for per-job failures."""
    result = RenderResult()
    if not jobs:
        return result
    spec = {
        "browserExecutable": settings.browser_executable,
        "concurrency": settings.render_concurrency,
        "publicDir": str(settings.public_dir),
        "jobs": [
            {
                "id": j.id,
                "props": j.props,
                "output": str(j.output),
                "thumbnail": {"path": str(j.thumbnail), "frame": j.thumbnail_frame} if j.thumbnail else None,
            }
            for j in jobs
        ],
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(spec, f)
        spec_path = f.name
    log.info("render start jobs=%d", len(jobs))
    proc = subprocess.Popen(
        ["node", str(settings.root / "scripts" / "render.mjs"), spec_path],
        cwd=settings.root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("event") == "done":
            try:
                finalize_audio(Path(ev["output"]))
            except subprocess.CalledProcessError as e:
                log.warning("loudness normalisation failed for %s: %s", ev["job"], e)
            result.ok[ev["job"]] = Path(ev["output"])
            log.info("render done job=%s secs=%.1f", ev["job"], ev.get("seconds", 0))
        elif ev.get("event") == "error":
            result.errors[ev["job"]] = ev.get("message", "unknown error")
            log.error("render failed job=%s: %s", ev["job"], ev.get("message", "")[:500])
        elif ev.get("event") == "fatal":
            for j in jobs:
                result.errors.setdefault(j.id, ev.get("message", "fatal render error"))
        if on_event:
            on_event(ev)
    stderr = proc.stderr.read() if proc.stderr else ""
    proc.wait()
    Path(spec_path).unlink(missing_ok=True)
    for j in jobs:
        if j.id not in result.ok and j.id not in result.errors:
            result.errors[j.id] = f"renderer exited with code {proc.returncode}: {stderr[-800:]}"
    return result
