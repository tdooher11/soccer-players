"""FastAPI backend for Soccer Brain Studio.  Start with `./soccer-brain studio`."""

from __future__ import annotations

import logging
import queue
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import players as pstore
from . import production, store, trivia, tts
from .config import settings
from .models import Achievement, Difficulty, FormatId, Player, Provenance, Question, VideoSettings, today
from .timeline import build_props

log = logging.getLogger("soccer_brain.api")
app = FastAPI(title="Soccer Brain Studio", version="1.0")


@app.exception_handler(trivia.TriviaError)
async def _trivia_error(_, exc: trivia.TriviaError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(tts.TTSError)
async def _tts_error(_, exc: tts.TTSError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


# --------------------------------------------------------------------- job queue

JOBS: dict[str, dict] = {}
_q: "queue.Queue[tuple[str, Any]]" = queue.Queue()


def _worker() -> None:
    while True:
        job_id, fn = _q.get()
        job = JOBS[job_id]
        job.update(status="running", startedAt=time.time())

        def on_event(ev: dict, job=job) -> None:
            e = ev.get("event")
            if e == "progress":
                job["progress"][ev["job"]] = ev["progress"]
            elif e == "bundle":
                job["stage"] = f"bundling {int(ev['progress'] * 100)}%"
            elif e == "prepared":
                job["stage"] = f"prepared {ev['player']}"
            elif e in ("done", "error"):
                job["stage"] = f"{e}: {ev['job']}"
            job["events"].append({k: v for k, v in ev.items() if k != "message"} | ({"message": ev["message"][:500]} if "message" in ev else {}))
            job["events"] = job["events"][-50:]

        try:
            res = fn(on_event)
            job.update(status="done" if not res.failed else ("partial" if res.rendered else "failed"), result=_result_dict(res))
        except Exception as e:  # surfaced in the UI
            log.exception("job %s failed", job_id)
            job.update(status="failed", error=str(e))
        job["finishedAt"] = time.time()
        _q.task_done()


def _result_dict(res: production.BatchResult) -> dict:
    return {"batchId": res.batch_id, "rendered": res.rendered, "failed": res.failed, "skipped": res.skipped}


threading.Thread(target=_worker, daemon=True).start()


def _enqueue(kind: str, fn, meta: dict | None = None) -> dict:
    jid = uuid.uuid4().hex[:10]
    JOBS[jid] = {"id": jid, "kind": kind, "status": "queued", "progress": {}, "stage": "queued", "events": [], "createdAt": time.time(), "meta": meta or {}}
    _q.put((jid, fn))
    return JOBS[jid]


# ------------------------------------------------------------------------ models


class GenerateReq(BaseModel):
    format: FormatId = "guess_player"
    player_ids: list[str] = Field(alias="playerIds")
    difficulty: Difficulty = "medium"
    duration: float | None = None
    seed: int | None = None
    extra: dict = Field(default_factory=dict)
    clues: int | None = Field(default=None, ge=3, le=5)


class ProjectReq(BaseModel):
    question: Question
    settings: VideoSettings = Field(default_factory=VideoSettings)


class SwapReq(BaseModel):
    question: Question
    index: int = Field(ge=0)
    seed: int | None = None
    avoid: list[str] = Field(default_factory=list)


class TTSReq(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    provider: str | None = None
    voice: str | None = None
    speed: float = 1.0


class BatchReq(BaseModel):
    count: int = Field(5, ge=1, le=50)
    format: FormatId = "guess_player"
    difficulty: Difficulty = "medium"
    duration: float | None = None
    days: int = 30
    country: str | None = None
    status: Literal["any", "active", "retired"] = "any"
    position: str | None = None
    clues: int | None = Field(default=None, ge=3, le=5)
    settings: VideoSettings = Field(default_factory=VideoSettings)
    dry_run: bool = Field(False, alias="dryRun")


class ConfirmClubReq(BaseModel):
    club: str | None = None


# ------------------------------------------------------------------------ routes


@app.get("/api/health")
def health():
    return {"ok": True, "tts": [{"name": p["name"], "available": p["available"]} for p in tts.provider_status()]}


@app.get("/api/stats")
def stats():
    hist = store.list_history()
    return {
        "players": len(pstore.load_players()),
        "questions": len(store.list_questions()),
        "rendered": sum(1 for h in hist if h["status"] == "rendered"),
        "failed": sum(1 for h in hist if h["status"] == "failed"),
        "recent": list(reversed(hist[-8:])),
        "channel": settings.channel_name,
    }


def _player_row(p: Player, last_used: dict[str, str]) -> dict:
    d = p.model_dump(by_alias=True, mode="json", exclude={"provenance"})
    d["lastUsed"] = last_used.get(p.id)
    d["currentClubFresh"] = pstore.current_club_is_fresh(p)
    return d


@app.get("/api/players")
def list_players(search: str | None = None, country: str | None = None, club: str | None = None, status: str | None = None, position: str | None = None):
    lu: dict[str, str] = {}
    for h in store.list_history():
        if h["status"] == "rendered":
            for pid in h.get("playerIds", []):
                lu[pid] = max(lu.get(pid, ""), h["createdAt"])
    out = []
    for p in pstore.load_players():
        if search and search.lower() not in p.name.lower() and search.lower() not in p.id:
            continue
        if country and country not in (p.country, p.country_code):
            continue
        if club and club not in p.career_clubs and club != p.current_club:
            continue
        if status == "active" and p.retired or status == "retired" and not p.retired:
            continue
        if position and p.position != position:
            continue
        out.append(_player_row(p, lu))
    return out


@app.get("/api/players/{pid}")
def get_player(pid: str):
    p = pstore.get_player(pid)
    if not p:
        raise HTTPException(404, "player not found")
    d = p.model_dump(by_alias=True, mode="json")
    d["currentClubFresh"] = pstore.current_club_is_fresh(p)
    return d


EDITABLE = {
    "name": "name", "spokenName": "spoken_name", "country": "country", "countryCode": "country_code", "currentClub": "current_club",
    "primaryClub": "primary_club", "careerClubs": "career_clubs", "retired": "retired", "position": "position", "dob": "dob",
    "died": "died", "jerseyNumber": "jersey_number", "funFact": "fun_fact", "notes": "notes", "category": "category",
}


@app.put("/api/players/{pid}")
def update_player(pid: str, body: dict):
    cur = pstore.get_player(pid)
    if not cur:
        raise HTTPException(404, "player not found")
    data = cur.model_dump(by_alias=True)
    changed = []
    for k, field_ in EDITABLE.items():
        if k in body and body[k] != data.get(k):
            data[k] = body[k]
            changed.append(field_)
    if "achievements" in body:
        achs = []
        for a in body["achievements"]:
            prev = cur.achievement(a["type"])
            same = prev and prev.count == a.get("count") and prev.years == a.get("years", [])
            achs.append(
                prev.model_dump(by_alias=True) if same else {**a, "provenance": Provenance(source="manual", updatedAt=today()).model_dump(by_alias=True)}
            )
        data["achievements"] = [x for x in achs if x.get("count", 0) > 0]
    try:
        p = Player.model_validate(data)
    except Exception as e:
        raise HTTPException(422, str(e)) from e
    if "current_club" in changed:
        p.current_club_verified_at = None
    return pstore.upsert_player(p, manual_fields=changed).model_dump(by_alias=True, mode="json")


@app.post("/api/players")
def create_player(body: dict):
    pid = pstore.slugify(body.get("name", ""))
    if not pid:
        raise HTTPException(422, "name required")
    if pstore.get_player(pid):
        raise HTTPException(409, "player already exists")
    try:
        p = Player.model_validate({**body, "id": pid, "achievements": [
            {**a, "provenance": {"source": "manual", "updatedAt": today()}} for a in body.get("achievements", []) if a.get("count", 0) > 0
        ]})
    except Exception as e:
        raise HTTPException(422, str(e)) from e
    fields = [f for k, f in EDITABLE.items() if k in body]
    return pstore.upsert_player(p, manual_fields=fields).model_dump(by_alias=True, mode="json")


@app.post("/api/players/{pid}/confirm-club")
def confirm_club(pid: str, req: ConfirmClubReq):
    try:
        return pstore.confirm_current_club(pid, req.club).model_dump(by_alias=True, mode="json")
    except KeyError as e:
        raise HTTPException(404, "player not found") from e


@app.get("/api/clubs")
def clubs():
    names = sorted({c for p in pstore.load_players() for c in p.career_clubs})
    known = pstore.load_clubs()
    return [pstore.club_badge(n, known).model_dump() for n in names]


@app.get("/api/tts")
def tts_status():
    return tts.provider_status()


@app.post("/api/tts/preview")
def tts_preview(req: TTSReq):
    clip = tts.synthesize(req.text, provider=req.provider, voice=req.voice, speed=req.speed)
    return {"src": "/" + clip.public_src, "seconds": round(clip.seconds, 2), "cached": clip.cached}


@app.post("/api/questions/generate")
def generate(req: GenerateReq):
    q = production.generate_question(
        req.format, req.player_ids, difficulty=req.difficulty, duration=req.duration, seed=req.seed, extra=req.extra, clues=req.clues
    )
    return q.model_dump(by_alias=True, mode="json")


@app.post("/api/questions/swap-clue")
def swap_clue(req: SwapReq):
    """Replace one clue with a different true fact; the other clues are untouched."""
    q = trivia.swap_clue(req.question, req.index, seed=req.seed, avoid=req.avoid)
    return q.model_dump(by_alias=True, mode="json")


class ClueTextReq(BaseModel):
    text: str


@app.post("/api/clues/visual")
def clue_visual(req: ClueTextReq):
    """Icon/badge/flag that fits a hand-edited clue (null = keep the current one)."""
    v = trivia.visual_for_text(req.text)
    return {"visual": v.model_dump(by_alias=True, mode="json") if v else None}


@app.get("/api/clues/visual-options")
def clue_visual_options(playerIds: str = ""):
    return trivia.visual_options([x for x in playerIds.split(",") if x])


@app.post("/api/questions/validate")
def validate(q: Question):
    return {"warnings": trivia.validate_question(q)}


@app.post("/api/projects/build")
def build_project(req: ProjectReq):
    """Narration + timeline for the live preview (no MP4)."""
    t = time.time()
    req.question.warnings = trivia.validate_question(req.question)
    props, report = build_props(req.question, req.settings)
    p = tts.get_provider(report.tts_provider)
    chars = sum(len(s["speech"] or "") for s in report.scenes)
    return {
        "props": props.dump(),
        "report": report.dump(),
        "warnings": req.question.warnings + report.warnings,
        "cost": {"provider": p.name, "paid": p.paid, "chars": chars, "estimatedUsd": p.estimate_cost(chars) if report.tts_generated else 0.0},
        "buildSeconds": round(time.time() - t, 2),
    }


@app.post("/api/renders")
def start_render(req: ProjectReq):
    q, s = req.question, req.settings
    job = _enqueue("render", lambda on_event: production.make_video(q, s, on_event)[1], {"question": q.id, "playerIds": q.player_ids})
    return job


@app.post("/api/batch")
def start_batch(req: BatchReq):
    retired = {"any": None, "active": False, "retired": True}[req.status]

    def run(on_event):
        return production.batch(
            req.count, fmt=req.format, difficulty=req.difficulty, duration=req.duration, s=req.settings, days=req.days,
            country=req.country or None, retired=retired, position=req.position or None, clues=req.clues, dry_run=req.dry_run,
            on_event=on_event,
        )

    return _enqueue("batch", run, {"count": req.count})


@app.post("/api/retry")
def retry(body: dict | None = None):
    bid = (body or {}).get("batchId")
    return _enqueue("retry", lambda on_event: production.retry_failed(bid, on_event), {"batchId": bid})


@app.get("/api/jobs")
def jobs():
    return sorted(JOBS.values(), key=lambda j: -j["createdAt"])[:20]


@app.get("/api/jobs/{jid}")
def job(jid: str):
    if jid not in JOBS:
        raise HTTPException(404, "job not found")
    return JOBS[jid]


@app.get("/api/history")
def history():
    names = {p.id: pstore.display_name(p.name) for p in pstore.load_players()}
    out = []
    for h in reversed(store.list_history()):
        d = dict(h)
        folder = settings.output_dir / h.get("outputDir", "")
        d["thumbnail"] = f"/output/{h['outputDir']}/thumbnail.png" if (folder / "thumbnail.png").exists() else None
        d["videoUrl"] = f"/output/{h['video']}" if h.get("video") else None
        d["downloadUrl"] = f"/api/history/{h['id']}/download" if h.get("video") else None
        d["downloadName"] = store.download_name(h, names) if h.get("video") else None
        meta = folder / "metadata.json"
        d["metadataUrl"] = f"/output/{h['outputDir']}/metadata.json" if meta.exists() else None
        out.append(d)
    return out


@app.get("/api/history/{rid}/download")
def history_download(rid: str):
    """The rendered MP4, saved under the player's name instead of video.mp4."""
    h = next((x for x in store.list_history() if x["id"] == rid), None)
    if not h or not h.get("video"):
        raise HTTPException(404, "video not found")
    path = (settings.output_dir / h["video"]).resolve()
    if settings.output_dir.resolve() not in path.parents or not path.is_file():
        raise HTTPException(404, "video file missing")
    names = {p.id: pstore.display_name(p.name) for p in pstore.load_players()}
    return FileResponse(path, media_type="video/mp4", filename=store.download_name(h, names))


@app.get("/api/history/{rid}/project")
def history_project(rid: str):
    """Load a past video back into the editor."""
    import json

    h = next((x for x in store.list_history() if x["id"] == rid), None)
    if not h:
        raise HTTPException(404, "not found")
    folder = settings.output_dir / h["outputDir"]
    q = json.loads((folder / "question.json").read_text())
    pj = folder / "project.json"
    s = json.loads(pj.read_text())["settings"] if pj.exists() else VideoSettings().model_dump(by_alias=True)
    return {"question": q, "settings": s}


# --------------------------------------------------------------------- static files

settings.output_dir.mkdir(parents=True, exist_ok=True)
app.mount("/output", StaticFiles(directory=settings.output_dir), name="output")

_dist = settings.root / "dist"


@app.get("/{path:path}")
def spa(path: str):
    """Serve the built UI, then live public/ assets (TTS clips, images, fonts, audio)."""
    for base in (_dist, settings.public_dir):
        f = (base / path).resolve()
        if path and f.is_file() and base.resolve() in f.parents:
            return FileResponse(f)
    index = _dist / "index.html"
    if index.exists():
        # Always re-check the page so a rebuilt UI shows up without clearing the browser cache
        # (the JS/CSS it points to have content-hashed names, so they can be cached).
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    raise HTTPException(404, "UI not built — run `./soccer-brain studio --build`")
