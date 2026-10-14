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


def rel_output(path: Path) -> str:
    try:
        return str(path.relative_to(settings.output_dir))
    except ValueError:
        return str(path)
