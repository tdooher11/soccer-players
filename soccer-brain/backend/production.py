"""Orchestration shared by the CLI, the studio API and batch jobs.

question -> props (TTS + timeline) -> render -> package (video, question, metadata, thumbnail)
"""

from __future__ import annotations

import json
import logging
import random
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Callable

from . import metadata, store
from . import players as pstore
from . import trivia
from .config import settings
from .models import Difficulty, FormatId, Question, VideoSettings
from .rendering import RenderJob, render
from .timeline import BuildReport, build_props

log = logging.getLogger(__name__)


@dataclass
class Project:
    question: Question
    settings: VideoSettings
    props: dict
    report: BuildReport
    out_dir: Path
    history_id: str


@dataclass
class BatchResult:
    batch_id: str
    rendered: list[dict] = field(default_factory=list)
    failed: list[dict] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def generate_question(
    fmt: FormatId,
    player_ids: list[str],
    *,
    difficulty: Difficulty = "medium",
    duration: float | None = None,
    seed: int | None = None,
    extra: dict | None = None,
    clues: int | None = None,
) -> Question:
    """Dispatch to the format generators. `extra` carries format options (club, statement...).
    `clues` = number of clues for Guess the Player (default 5)."""
    from .formats import DEFAULT_DURATION

    if fmt != "guess_player":
        duration = duration or DEFAULT_DURATION.get(fmt, 18.0)
    pool = pstore.load_players()
    by_id = {p.id: p for p in pool}
    missing = [pid for pid in player_ids if pid not in by_id]
    if missing:
        raise trivia.TriviaError(f"Unknown player id(s): {', '.join(missing)}")
    if fmt == "guess_player":
        p = by_id[player_ids[0]]
        return trivia.generate_guess_player(
            p,
            difficulty=difficulty,
            duration=duration,
            n_clues=clues or trivia.DEFAULT_CLUES,
            seed=seed,
            avoid_fact_sets=store.used_fact_sets(p.id),
            pool=pool,
        )
    from . import formats

    return formats.generate(fmt, [by_id[x] for x in player_ids], pool=pool, difficulty=difficulty, duration=duration, seed=seed, extra=extra or {})


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "video"


def _out_dir(q: Question, day: date | None = None) -> Path:
    base = settings.output_dir / (day or date.today()).isoformat()
    name = _slug(q.answer.title if q.format == "guess_club" else (q.player_id or "-".join(q.player_ids[:2]) or q.id))
    if q.format != "guess_player":
        name = f"{name}-{q.format.replace('_', '-')}"
    d = base / name
    i = 2
    while d.exists() and any(d.iterdir()):
        d = base / f"{name}-{i}"
        i += 1
    return d


def prepare(q: Question, s: VideoSettings, *, batch_id: str | None = None) -> Project:
    """Validate, synthesize narration, compute timeline. Cheap to call repeatedly (TTS is cached)."""
    q.warnings = trivia.validate_question(q)
    props, report = build_props(q, s)
    store.save_question(q)
    out_dir = _out_dir(q)
    out_dir.mkdir(parents=True, exist_ok=True)  # claim the folder so batch siblings get unique names
    (out_dir / "question.json").write_text(json.dumps(q.model_dump(by_alias=True, mode="json"), indent=1, ensure_ascii=False))
    return Project(q, s, props.dump(), report, out_dir, history_id=f"r-{uuid.uuid4().hex[:10]}")


def _thumbnail_frame(props: dict) -> int:
    scenes = props["timeline"]["scenes"]
    clue = [x for x in scenes if x["type"] == "clue"]
    last = clue[-1] if clue else scenes[0]
    return last["from"] + int(last["durationInFrames"] * 0.75)


def render_projects(projects: list[Project], on_event: Callable[[dict], None] | None = None, *, batch_id: str | None = None) -> BatchResult:
    """Render a list of prepared projects. Failures are recorded, never fatal for others."""
    result = BatchResult(batch_id=batch_id or f"b-{uuid.uuid4().hex[:8]}")
    by_hist = {p.history_id: p for p in projects}
    pool = pstore.players_by_id()
    for p in projects:
        p.out_dir.mkdir(parents=True, exist_ok=True)
        (p.out_dir / "question.json").write_text(json.dumps(p.question.model_dump(by_alias=True, mode="json"), indent=1, ensure_ascii=False))
        (p.out_dir / "project.json").write_text(
            json.dumps({"settings": p.settings.model_dump(by_alias=True), "props": p.props, "build": p.report.dump()}, indent=1, ensure_ascii=False)
        )
        store.add_history(
            {
                "id": p.history_id,
                "batchId": batch_id,
                "createdAt": datetime.now().isoformat(timespec="seconds"),
                "status": "rendering",
                "questionId": p.question.id,
                "fingerprint": p.question.fingerprint,
                "format": p.question.format,
                "difficulty": p.question.difficulty,
                "playerIds": p.question.player_ids or ([p.question.player_id] if p.question.player_id else []),
                "clues": [c.text for c in p.question.clues],
                "answer": p.question.answer.title,
                "outputDir": store.rel_output(p.out_dir),
                "video": None,
                "error": None,
                "durationSeconds": p.report.actual_seconds,
                "warnings": p.question.warnings + p.report.warnings,
            }
        )
    jobs = [
        RenderJob(
            id=p.history_id,
            props=p.props,
            output=p.out_dir / "video.mp4",
            thumbnail=p.out_dir / "thumbnail.png",
            thumbnail_frame=_thumbnail_frame(p.props),
        )
        for p in projects
    ]
    res = render(jobs, on_event=on_event)
    for hid, path in res.ok.items():
        p = by_hist[hid]
        meta = metadata.build(
            p.question,
            pool,
            video_file=store.rel_output(path),
            duration=p.report.actual_seconds,
            recent_titles=[h.get("title") for h in store.list_history()[-6:] if h.get("title")],
            tts={"provider": p.report.tts_provider, "voice": p.report.tts_voice, "speed": p.report.speech_speed} if p.settings.narration else None,
        )
        (p.out_dir / "metadata.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
        rec = store.update_history(hid, status="rendered", video=store.rel_output(path), title=meta["title"], error=None)
        result.rendered.append(rec or {"id": hid})
    for hid, err in res.errors.items():
        rec = store.update_history(hid, status="failed", error=err[-2000:])
        result.failed.append(rec or {"id": hid, "error": err})
    return result


def make_video(q: Question, s: VideoSettings, on_event=None) -> tuple[Project, BatchResult]:
    proj = prepare(q, s)
    return proj, render_projects([proj], on_event)


def retry_failed(batch_id: str | None = None, on_event=None) -> BatchResult:
    """Re-render failed jobs from their saved project files (successful ones are untouched)."""
    projects = []
    for h in store.list_history():
        if h.get("status") != "failed" or (batch_id and h.get("batchId") != batch_id):
            continue
        out_dir = settings.output_dir / h["outputDir"]
        pj = json.loads((out_dir / "project.json").read_text())
        q = Question.model_validate(json.loads((out_dir / "question.json").read_text()))
        s = VideoSettings.model_validate(pj["settings"])
        props, report = build_props(q, s)  # rebuild: audio cache may have been cleared
        projects.append(Project(q, s, props.dump(), report, out_dir, h["id"]))
    return render_projects(projects, on_event, batch_id=batch_id)


def eligible_players(*, days: int = 30, country: str | None = None, retired: bool | None = None, position: str | None = None, category: str | None = None) -> list:
    recent = store.recently_used_ids(days)
    out = []
    for p in pstore.load_players():
        if p.id in recent:
            continue
        if country and country.lower() not in (p.country.lower(), p.country_code.lower()):
            continue
        if retired is not None and p.retired != retired:
            continue
        if position and p.position != position.upper():
            continue
        if category and p.category != category:
            continue
        out.append(p)
    return out


def batch(
    count: int,
    *,
    fmt: FormatId = "guess_player",
    difficulty: Difficulty = "medium",
    duration: float | None = None,
    s: VideoSettings | None = None,
    days: int = 30,
    country: str | None = None,
    retired: bool | None = None,
    position: str | None = None,
    player_ids: list[str] | None = None,
    seed: int | None = None,
    clues: int | None = None,
    dry_run: bool = False,
    on_event=None,
) -> BatchResult:
    """Generate and render `count` videos about players not used in the last `days` days."""
    s = s or VideoSettings()
    rng = random.Random(seed)
    batch_id = f"b-{datetime.now():%Y%m%d-%H%M%S}"
    if player_ids:
        pool = [p for p in pstore.load_players() if p.id in player_ids]
    else:
        pool = eligible_players(days=days, country=country, retired=retired, position=position)
    rng.shuffle(pool)
    projects: list[Project] = []
    result = BatchResult(batch_id=batch_id)
    seen_fps: set[str] = set()
    for i, p in enumerate(pool):
        if len(projects) >= count:
            break
        ids = [p.id]
        if fmt == "who_won_more":  # pair with another eligible player from the same category
            mates = [x for x in pool[i + 1 :] if x.category == p.category and x.id not in {pid for pr in projects for pid in pr.question.player_ids}]
            if not mates:
                continue
            ids.append(rng.choice(mates).id)
        try:
            q = generate_question(fmt, ids, difficulty=difficulty, duration=duration, seed=rng.randint(0, 10**6), clues=clues)
        except trivia.TriviaError as e:
            result.skipped.append(f"{p.id}: {e}")
            continue
        if q.fingerprint in seen_fps:
            result.skipped.append(f"{p.id}: duplicate question")
            continue
        blocking = [w for w in q.warnings if "gives away" in w or "also fit" in w or "no longer match" in w]
        if blocking:
            result.skipped.append(f"{p.id}: {'; '.join(blocking)}")
            continue
        seen_fps.add(q.fingerprint or q.id)
        projects.append(prepare(q, s, batch_id=batch_id))
        if on_event:
            on_event({"event": "prepared", "job": projects[-1].history_id, "player": p.id})
    if len(projects) < count:
        result.skipped.append(f"Only {len(projects)} eligible players found (wanted {count}).")
    if dry_run:
        for pr in projects:
            result.rendered.append({"questionId": pr.question.id, "playerIds": pr.question.player_ids, "clues": [c.text for c in pr.question.clues], "seconds": pr.report.actual_seconds})
        return result
    r = render_projects(projects, on_event, batch_id=batch_id)
    r.skipped = result.skipped
    return r
