"""JSON-file persistence for generated questions and production history."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta
from pathlib import Path

from .config import settings
from .models import Question

_lock = threading.RLock()


def _read(name: str) -> list[dict]:
    p = settings.data_dir / name
    if not p.exists():
        return []
    return json.loads(p.read_text()).get("items", [])


def _write(name: str, items: list[dict]) -> None:
    p = settings.data_dir / name
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps({"items": items}, indent=1, ensure_ascii=False))
    tmp.replace(p)


# --------------------------------------------------------------------- questions


def list_questions() -> list[Question]:
    return [Question.model_validate(x) for x in _read("questions.json")]


def save_question(q: Question) -> Question:
    with _lock:
        items = [x for x in _read("questions.json") if x["id"] != q.id]
        items.append(q.model_dump(by_alias=True, mode="json"))
        _write("questions.json", items)
    return q


def get_question(qid: str) -> Question | None:
    return next((q for q in list_questions() if q.id == qid), None)


def used_fact_sets(player_id: str) -> set[frozenset[str]]:
    """Clue fact-sets already rendered for this player (to avoid near-identical videos)."""
    rendered = {h["questionId"] for h in list_history() if h.get("status") == "rendered"}
    return {
        frozenset(c.fact for c in q.clues if c.fact)
        for q in list_questions()
        if q.player_id == player_id and q.id in rendered
    }


# ----------------------------------------------------------------------- history


def list_history() -> list[dict]:
    return _read("production-history.json")


def add_history(record: dict) -> dict:
    with _lock:
        items = [x for x in _read("production-history.json") if x["id"] != record["id"]]
        items.append(record)
        _write("production-history.json", items)
    return record


def update_history(rid: str, **fields) -> dict | None:
    with _lock:
        items = _read("production-history.json")
        for x in items:
            if x["id"] == rid:
                x.update(fields)
                _write("production-history.json", items)
                return x
    return None


def last_used(player_id: str) -> datetime | None:
    dates = [
        datetime.fromisoformat(h["createdAt"])
        for h in list_history()
        if h.get("status") == "rendered" and player_id in h.get("playerIds", [])
    ]
    return max(dates) if dates else None


def recently_used_ids(days: int) -> set[str]:
    cutoff = datetime.now() - timedelta(days=days)
    out: set[str] = set()
    for h in list_history():
        if h.get("status") == "rendered" and datetime.fromisoformat(h["createdAt"]) >= cutoff:
            out.update(h.get("playerIds", []))
    return out


FORMAT_LABEL = {
    "guess_player": "Guess the Player",
    "career_path": "Career Path",
    "who_won_more": "Who Won More",
    "guess_club": "Guess the Club",
    "true_false": "True or False",
}


def download_name(record: dict, names: dict[str, str]) -> str:
    """Friendly file name for a rendered video, e.g. 'Ronaldinho - Guess the Player - 2026-10-29.mp4'.

    `names` maps player id -> display name. Characters Windows forbids in file names are removed.
    """
    import re

    fmt = record.get("format", "")
    people = [names.get(pid, pid) for pid in record.get("playerIds", [])]
    if fmt == "guess_club":
        subject = (record.get("answer") or "Club").title()
    elif fmt == "who_won_more" and len(people) >= 2:
        subject = " vs ".join(n.split()[-1] for n in people[:2])
    else:
        subject = people[0] if people else (record.get("answer") or "Video").title()
    day = (record.get("createdAt") or "")[:10]
    name = " - ".join(x for x in (subject, FORMAT_LABEL.get(fmt, fmt), day) if x)
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name).strip(" .")
    return f"{name or 'video'}.mp4"


def rel_output(path: Path) -> str:
    try:
        return str(path.relative_to(settings.output_dir))
    except ValueError:
        return str(path)
