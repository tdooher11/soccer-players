"""End-to-end render: real Remotion + FFmpeg. Slow (~2 min). Run with: pytest -m slow"""

import json

import pytest

from backend import production, qa
from backend.models import VideoSettings


@pytest.mark.slow
def test_render_real_video_specs():
    q = production.generate_question("guess_player", ["kaka"], seed=2, duration=14)
    proj, res = production.make_video(q, VideoSettings(narration=True))
    assert res.rendered and not res.failed, res.failed
    report = qa.check_video(proj.out_dir, with_transcript=False)
    failed = [c for c in report["checks"] if not c["ok"]]
    assert not failed, failed
    meta = json.loads((proj.out_dir / "metadata.json").read_text())
    assert meta["outputFilename"].endswith("video.mp4")
    assert (proj.out_dir / "thumbnail.png").exists()
