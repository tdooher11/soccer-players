import io
import json
import zipfile

import pytest

from backend import store, transfer
from backend.config import settings


def _render(rid="r-abc123def0"):
    out = settings.output_dir / "2026-11-07" / "jude-bellingham"
    out.mkdir(parents=True, exist_ok=True)
    (out / "video.mp4").write_bytes(b"mp4")
    (out / "project.json").write_text(json.dumps({"settings": {"ending": "short"}, "props": {}}))
    (out / "metadata.json").write_text(json.dumps({"title": "T"}))
    (out / "qa").mkdir(exist_ok=True)
    (out / "qa" / "frame.jpg").write_bytes(b"x")  # not exported
    store.add_history(
        {"id": rid, "createdAt": "2026-11-07T10:00:00", "status": "rendered", "format": "guess_player", "playerIds": ["jude-bellingham"],
         "answer": "JUDE BELLINGHAM", "questionId": "jude-bellingham-1", "outputDir": "2026-11-07/jude-bellingham", "video": "2026-11-07/jude-bellingham/video.mp4", "youtubeId": "abc"}
    )
    return rid


def test_export_then_import_into_another_studio(tmp_path):
    rid = _render()
    z = transfer.export_render(rid, tmp_path / "v.zip")
    assert sorted(zipfile.ZipFile(z).namelist()) == ["metadata.json", "project.json", "soccer-brain-render.json", "video.mp4"]
    # pretend this is a different studio: forget the record (the folder name is taken, so it gets -2)
    (settings.data_dir / "production-history.json").write_text(json.dumps({"items": []}))
    r = transfer.import_render(z.read_bytes())
    assert r["id"] == rid and r["outputDir"] == "2026-11-07/jude-bellingham-2" and "youtubeId" not in r
    assert (settings.output_dir / "2026-11-07/jude-bellingham-2/video.mp4").read_bytes() == b"mp4"
    assert transfer.import_render(z.read_bytes())["alreadyImported"]  # twice = no-op
    assert sum(h["id"] == rid for h in store.list_history()) == 1


def test_import_rejects_strange_zips():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("soccer-brain-render.json", json.dumps({"history": {"id": "r-abc123def0", "createdAt": "2026-11-07T10:00:00"}}))
        z.writestr("video.mp4", b"x")
        z.writestr("../../evil.sh", b"x")
    with pytest.raises(transfer.TransferError, match="Unexpected"):
        transfer.import_render(buf.getvalue())
    with pytest.raises(transfer.TransferError):
        transfer.import_render(b"not a zip")
