"""Move a rendered video between studios as one .zip (e.g. a video Claude rendered elsewhere).

The zip holds the render's folder (video, project, question, metadata, thumbnail) plus its
history record, so the importing studio treats it exactly like one it rendered itself:
it shows up under Videos and is matched and compared in Analytics.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from pathlib import Path

from . import store
from .config import settings
from .models import Question

MANIFEST = "soccer-brain-render.json"
FILES = ("video.mp4", "project.json", "question.json", "metadata.json", "thumbnail.png")
MAX_BYTES = 200 * 1024 * 1024


class TransferError(ValueError):
    pass


def export_render(history_id: str, dest: Path | None = None) -> Path:
    h = next((x for x in store.list_history() if x["id"] == history_id), None)
    if not h or h.get("status") != "rendered" or not h.get("video"):
        raise TransferError(f"No rendered video with id {history_id}.")
    folder = settings.output_dir / h["outputDir"]
    if not (folder / "video.mp4").is_file():
        raise TransferError(f"The video file is missing from {folder}.")
    dest = dest or folder.parent / f"{folder.name}-{history_id}.zip"
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr(MANIFEST, json.dumps({"version": 1, "history": h}, indent=1, ensure_ascii=False))
        for name in FILES:
            if (folder / name).is_file():
                # MP4/PNG are already compressed; store them as-is.
                z.write(folder / name, name, compress_type=zipfile.ZIP_STORED if name.endswith((".mp4", ".png")) else zipfile.ZIP_DEFLATED)
    return dest


def _safe_folder(record: dict) -> Path:
    """output/<date>/<name>, adding -2, -3… if that folder is already used by another render."""
    date = (record.get("createdAt") or "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise TransferError("The zip's history record has no valid date.")
    name = re.sub(r"[^a-z0-9-]+", "-", Path(record.get("outputDir") or "video").name.lower()).strip("-") or "video"
    base = settings.output_dir / date
    folder, n = base / name, 2
    while folder.exists():
        folder, n = base / f"{name}-{n}", n + 1
    return folder


def import_render(data: bytes) -> dict:
    """Add a render from an exported zip. Importing the same zip twice is a no-op."""
    if len(data) > MAX_BYTES:
        raise TransferError("That file is too big to be a Soccer Brain video.")
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        raise TransferError("That isn't a zip file.") from e
    with z:
        names = set(z.namelist())
        if MANIFEST not in names or "video.mp4" not in names:
            raise TransferError("This zip isn't a Soccer Brain video export (no soccer-brain-render.json / video.mp4).")
        unknown = names - set(FILES) - {MANIFEST}
        if unknown:  # also rules out paths like ../../x
            raise TransferError(f"Unexpected files in the zip: {', '.join(sorted(unknown))}")
        try:
            record = json.loads(z.read(MANIFEST))["history"]
        except Exception as e:
            raise TransferError("The zip's history record is unreadable.") from e
        rid = record.get("id")
        if not isinstance(rid, str) or not re.fullmatch(r"r-[0-9a-f]{6,32}", rid):
            raise TransferError("The zip's history record has no valid id.")
        existing = next((x for x in store.list_history() if x["id"] == rid), None)
        if existing:
            return {**existing, "alreadyImported": True}

        folder = _safe_folder(record)
        folder.mkdir(parents=True)
        for name in names - {MANIFEST}:
            (folder / name).write_bytes(z.read(name))

    rel = store.rel_output(folder)
    record = {**record, "outputDir": rel, "video": f"{rel}/video.mp4", "status": "rendered", "importedAt": store_now()}
    record.pop("youtubeId", None)  # the upload belongs to the other studio's records
    store.add_history(record)
    q = folder / "question.json"
    if q.is_file():
        try:  # keeps "don't repeat these clues" working for imported videos
            store.save_question(Question.model_validate_json(q.read_text()))
        except Exception:
            pass
    return record


def store_now() -> str:
    from datetime import datetime

    return datetime.now().isoformat(timespec="seconds")
