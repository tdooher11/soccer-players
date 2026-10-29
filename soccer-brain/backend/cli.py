"""soccer-brain command-line interface. Run `./soccer-brain --help`."""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
import time
from pathlib import Path

from .config import settings


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    for noisy in ("httpx", "httpcore", "phonemizer", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _progress_printer():
    state = {"last": -1.0}

    def on_event(ev: dict) -> None:
        e = ev.get("event")
        if e == "progress":
            p = ev.get("progress", 0)
            if p - state["last"] >= 0.1 or p >= 1:
                state["last"] = p
                print(f"  rendering {ev['job']}: {p * 100:5.1f}%", flush=True)
        elif e == "bundled":
            print(f"  bundled in {ev['seconds']:.1f}s", flush=True)
        elif e == "done":
            state["last"] = -1.0
            print(f"  ✓ {ev['job']} ({ev['seconds']:.0f}s)", flush=True)
        elif e in ("error", "fatal"):
            print(f"  ✗ {ev.get('job', '')}: {ev.get('message', '')[:400]}", flush=True)
        elif e == "prepared":
            print(f"  prepared {ev['player']}", flush=True)

    return on_event


def _video_settings(a):
    from .models import VideoSettings

    kw = {}
    for name in ("theme", "voice", "fps"):
        if getattr(a, name, None) is not None:
            kw[name] = getattr(a, name)
    if getattr(a, "provider", None):
        kw["ttsProvider"] = a.provider
    if getattr(a, "speed", None):
        kw["speechSpeed"] = a.speed
    if getattr(a, "text_scale", None):
        kw["textScale"] = a.text_scale
    if getattr(a, "no_narration", False):
        kw["narration"] = False
    if getattr(a, "no_music", False):
        kw["music"] = False
    if getattr(a, "no_image", False):
        kw["showAnswerImage"] = False
    return VideoSettings(**kw)


def _add_video_opts(p: argparse.ArgumentParser) -> None:
    g = p.add_argument_group("video settings")
    g.add_argument("--theme", choices=["stadium-gold", "electric-blue", "night-match"])
    g.add_argument("--provider", help="TTS provider: kokoro (default), piper, openai, elevenlabs, google")
    g.add_argument("--voice", help="voice id, see `soccer-brain voices`")
    g.add_argument("--speed", type=float, help="narration speed multiplier (0.7-1.4)")
    g.add_argument("--text-scale", type=float, help="text size multiplier (0.8-1.3)")
    g.add_argument("--no-narration", action="store_true")
    g.add_argument("--no-music", action="store_true")
    g.add_argument("--no-image", action="store_true", help="use the jersey graphic instead of a photo")


def _resolve_player(ref: str) -> str:
    from . import players as ps
    from .players import slugify

    pool = ps.load_players()
    ids = {p.id for p in pool}
    if ref in ids:
        return ref
    s = slugify(ref)
    if s in ids:
        return s
    hits = [p.id for p in pool if s and (s in p.id or s in slugify(p.name))]
    if len(hits) == 1:
        return hits[0]
    if not hits:
        raise SystemExit(f"No player matches '{ref}'. Try `soccer-brain players --search {ref}`.")
    raise SystemExit(f"'{ref}' is ambiguous: {', '.join(hits[:8])}")


# ------------------------------------------------------------------------ commands


def cmd_setup(a) -> None:
    subprocess.run(["bash", str(settings.root / "scripts" / "setup_models.sh")], check=True)
    cmd_assets(a)
    cmd_import(a)


def cmd_assets(a) -> None:
    from . import sfx

    paths = sfx.build_all(settings.public_dir, force=getattr(a, "force", False))
    print(f"{len(paths)} audio assets ready in {settings.public_dir / 'audio'}")


def cmd_import(a) -> None:
    from .players import import_master_list

    r = import_master_list(download_images=not getattr(a, "no_images", False), fetch_credits=not getattr(a, "no_credits", False))
    print(f"Imported from {settings.master_list}: {r.summary()}")
    for c in r.conflicts:
        print(f"  conflict {c['player']}.{c['field']}: kept {c['kept']!r}, master list says {c['masterList']!r}")
    for e in r.errors:
        print(f"  error: {e}")


def cmd_players(a) -> None:
    from . import players as ps
    from . import store

    recent = store.recently_used_ids(a.days) if a.unused else set()
    rows = []
    for p in ps.load_players():
        if a.search and a.search.lower() not in p.name.lower() and a.search.lower() not in p.id:
            continue
        if a.country and a.country.lower() not in (p.country.lower(), p.country_code.lower()):
            continue
        if a.retired and not p.retired or a.active and p.retired:
            continue
        if a.unused and p.id in recent:
            continue
        lu = store.last_used(p.id)
        rows.append((p.id, p.name, p.country, "retired" if p.retired else (p.current_club or "?"), lu.date().isoformat() if lu else "never"))
    if a.json:
        print(json.dumps([dict(zip(["id", "name", "country", "club", "lastUsed"], r)) for r in rows], indent=1, ensure_ascii=False))
        return
    for r in rows:
        print(f"{r[0]:28} {r[1]:28} {r[2]:16} {r[3]:22} last used: {r[4]}")
    print(f"{len(rows)} players")


def cmd_question(a) -> None:
    from .production import generate_question

    ids = [_resolve_player(x) for x in a.player or []]
    q = generate_question(a.format, ids, difficulty=a.difficulty, duration=a.duration, seed=a.seed, extra=_format_extra(a))
    data = json.dumps(q.model_dump(by_alias=True, mode="json"), indent=1, ensure_ascii=False)
    if a.out:
        Path(a.out).write_text(data)
        print(f"Wrote {a.out} — edit the clues, then: soccer-brain render --question {a.out}")
    else:
        print(data)


def _format_extra(a) -> dict:
    extra = {}
    for k in ("club", "statement", "stat", "historical"):
        v = getattr(a, k, None)
        if v is not None:
            extra[k] = v
    return extra


def cmd_swap(a) -> None:
    from .models import Question
    from .trivia import swap_clue

    path = Path(a.question)
    q = Question.model_validate(json.loads(path.read_text()))
    q = swap_clue(q, a.clue - 1, seed=a.seed)
    path.write_text(json.dumps(q.model_dump(by_alias=True, mode="json"), indent=1, ensure_ascii=False))
    for i, c in enumerate(q.clues, 1):
        print(f"{'→' if i == a.clue else ' '} {i}. {c.text}")
    print(f"Saved {path}. Render it with: soccer-brain render --question {path}")


def cmd_render(a) -> None:
    from .models import Question
    from .production import generate_question, make_video

    if a.question:
        q = Question.model_validate(json.loads(Path(a.question).read_text()))
    elif a.player or a.format == "guess_club":
        ids = [_resolve_player(x) for x in a.player or []]
        q = generate_question(a.format, ids, difficulty=a.difficulty, duration=a.duration, seed=a.seed, extra=_format_extra(a))
    else:
        raise SystemExit("Give --player NAME or --question FILE")
    s = _video_settings(a)
    print(f"Question {q.id} ({q.format}, {q.difficulty}):")
    for i, c in enumerate(q.clues, 1):
        print(f"  {i}. {c.text}")
    for w in q.warnings:
        print(f"  ! {w}")
    t = time.time()
    proj, res = make_video(q, s, _progress_printer())
    for w in proj.report.warnings:
        print(f"  ! {w}")
    if res.rendered:
        print(f"Done in {time.time() - t:.0f}s → {proj.out_dir / 'video.mp4'}  ({proj.report.actual_seconds:.1f}s video)")
    else:
        raise SystemExit(f"Render failed: {res.failed[0].get('error', '')[:800]}")


def cmd_batch(a) -> None:
    from .production import batch

    retired = True if a.retired else (False if a.active else None)
    t = time.time()
    res = batch(
        a.count,
        fmt=a.format,
        difficulty=a.difficulty,
        duration=a.duration,
        s=_video_settings(a),
        days=a.days,
        country=a.country,
        retired=retired,
        position=a.position,
        player_ids=[_resolve_player(x) for x in a.player] if a.player else None,
        seed=a.seed,
        dry_run=a.dry_run,
        on_event=_progress_printer(),
    )
    print(f"Batch {res.batch_id}: {len(res.rendered)} rendered, {len(res.failed)} failed, {len(res.skipped)} skipped ({time.time() - t:.0f}s)")
    for r in res.rendered:
        print(f"  ✓ {r.get('outputDir', r.get('questionId'))}  {r.get('title', '')}")
    for r in res.failed:
        print(f"  ✗ {r.get('outputDir')}: {(r.get('error') or '')[:200]}")
    for s in res.skipped:
        print(f"  - skipped {s}")
    if res.failed:
        print(f"Retry failures with: soccer-brain retry --batch {res.batch_id}")


def cmd_retry(a) -> None:
    from .production import retry_failed

    res = retry_failed(a.batch, _progress_printer())
    print(f"{len(res.rendered)} re-rendered, {len(res.failed)} still failing")


def cmd_history(a) -> None:
    from . import store

    items = store.list_history()[-a.limit :]
    for h in items:
        print(f"{h['createdAt']}  {h['status']:9} {h['format']:13} {', '.join(h.get('playerIds', [])):28} {h.get('outputDir', '')}")


def cmd_voices(a) -> None:
    from .tts import provider_status

    for p in provider_status():
        tag = "paid" if p["paid"] else "free"
        state = "ready" if p["available"] else f"unavailable: {p['reason']}"
        print(f"{p['name']} ({tag}) — {state}")
        for v in p["voices"]:
            print(f"    {v['id']:24} {v['label']}{'  (default)' if v['id'] == p['defaultVoice'] else ''}")


def cmd_say(a) -> None:
    from .tts import synthesize

    clip = synthesize(a.text, provider=a.provider, voice=a.voice, speed=a.speed or 1.0)
    print(f"{clip.path}  ({clip.seconds:.2f}s{' cached' if clip.cached else ''})")


def cmd_studio(a) -> None:
    import uvicorn

    dist = settings.root / "dist" / "index.html"
    if not dist.exists() or a.build:
        print("Building the studio UI (first run)…")
        subprocess.run(["npx", "vite", "build"], cwd=settings.root, check=True)
    print(f"Soccer Brain Studio → http://localhost:{a.port}")
    uvicorn.run("backend.main:app", host=a.host, port=a.port, log_level="info")


def cmd_remotion(a) -> None:
    """Open Remotion Studio on a project's props (timeline-level inspection)."""
    props = settings.root / "src" / "remotion" / "sample-props.json"
    if a.project:
        pj = json.loads((Path(a.project) / "project.json").read_text())
        props.write_text(json.dumps(pj["props"], indent=1, ensure_ascii=False))
    else:  # rebuild the sample so its narration clips exist in this checkout's TTS cache
        from .models import Question, VideoSettings
        from .timeline import build_props

        q = Question.model_validate(json.loads((settings.root / "questions" / "ronaldinho-sample.json").read_text()))
        built, _ = build_props(q, VideoSettings())
        props.write_text(json.dumps(built.dump(), indent=1, ensure_ascii=False))
    subprocess.run(["npx", "remotion", "studio"], cwd=settings.root)


def cmd_qa(a) -> None:
    from .qa import check_video

    report = check_video(Path(a.dir), with_transcript=not a.no_transcribe)
    print(json.dumps(report, indent=1, ensure_ascii=False))
    if not report["passed"]:
        sys.exit(1)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="soccer-brain", description="Soccer Brain Studio — soccer trivia Shorts generator")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("setup", help="download free TTS voices, build audio assets, import players").set_defaults(fn=cmd_setup)
    p = sub.add_parser("assets", help="(re)generate music + sound effects")
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_assets)
    p = sub.add_parser("import", help="import/refresh players from the master list")
    p.add_argument("--no-images", action="store_true")
    p.add_argument("--no-credits", action="store_true")
    p.set_defaults(fn=cmd_import)

    p = sub.add_parser("players", help="list players")
    p.add_argument("--search")
    p.add_argument("--country")
    p.add_argument("--retired", action="store_true")
    p.add_argument("--active", action="store_true")
    p.add_argument("--unused", action="store_true", help="only players not used in the last --days")
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--json", action="store_true")
    p.set_defaults(fn=cmd_players)

    def add_q_opts(p):
        p.add_argument("--player", action="append", help="player id or name (repeat for multi-player formats)")
        p.add_argument("--format", default="guess_player", choices=["guess_player", "career_path", "who_won_more", "guess_club", "true_false"])
        p.add_argument("--difficulty", default="medium", choices=["easy", "medium", "hard"])
        p.add_argument("--duration", type=float, help="target length in seconds (default depends on format; 18 for Guess the Player)")
        p.add_argument("--seed", type=int)
        p.add_argument("--club", help="guess_club: the club (default: best shared club)")
        p.add_argument("--historical", action="store_true", help="guess_club: allow former teammates (default)")
        p.add_argument("--stat", help="who_won_more: ballon_dor | world_cup | champions_league")
        p.add_argument("--statement", help="true_false: a club, e.g. 'Real Madrid'")

    p = sub.add_parser("question", help="generate a question JSON (edit it, then render --question)")
    add_q_opts(p)
    p.add_argument("--out")
    p.set_defaults(fn=cmd_question)

    p = sub.add_parser("swap", help="swap one clue in a question JSON for a different true fact")
    p.add_argument("--question", required=True, help="question JSON file (edited in place)")
    p.add_argument("--clue", type=int, required=True, help="clue number to replace (1 = first)")
    p.add_argument("--seed", type=int)
    p.set_defaults(fn=cmd_swap)

    p = sub.add_parser("render", help="render one video")
    add_q_opts(p)
    p.add_argument("--question", help="render an edited question JSON file")
    _add_video_opts(p)
    p.set_defaults(fn=cmd_render)

    p = sub.add_parser("batch", help="generate + render several videos")
    p.add_argument("--count", type=int, default=5)
    p.add_argument("--format", default="guess_player", choices=["guess_player", "career_path", "who_won_more", "guess_club", "true_false"])
    p.add_argument("--difficulty", default="medium", choices=["easy", "medium", "hard"])
    p.add_argument("--duration", type=float)
    p.add_argument("--days", type=int, default=30, help="skip players used in the last N days")
    p.add_argument("--country")
    p.add_argument("--retired", action="store_true")
    p.add_argument("--active", action="store_true")
    p.add_argument("--position", choices=["GK", "DEF", "MID", "FWD"])
    p.add_argument("--player", action="append", help="restrict to these players")
    p.add_argument("--seed", type=int)
    p.add_argument("--dry-run", action="store_true", help="generate questions + narration only, no rendering")
    _add_video_opts(p)
    p.set_defaults(fn=cmd_batch)

    p = sub.add_parser("retry", help="re-render failed jobs")
    p.add_argument("--batch")
    p.set_defaults(fn=cmd_retry)

    p = sub.add_parser("history", help="show production history")
    p.add_argument("--limit", type=int, default=30)
    p.set_defaults(fn=cmd_history)

    sub.add_parser("voices", help="list TTS providers and voices").set_defaults(fn=cmd_voices)
    p = sub.add_parser("say", help="preview narration for a line of text")
    p.add_argument("text")
    p.add_argument("--provider")
    p.add_argument("--voice")
    p.add_argument("--speed", type=float)
    p.set_defaults(fn=cmd_say)

    for name in ("studio", "preview"):
        p = sub.add_parser(name, help="start the browser studio")
        p.add_argument("--port", type=int, default=8000)
        p.add_argument("--host", default="127.0.0.1")
        p.add_argument("--build", action="store_true", help="rebuild the UI first")
        p.set_defaults(fn=cmd_studio)

    p = sub.add_parser("remotion", help="open Remotion Studio (frame-level inspection)")
    p.add_argument("--project", help="an output folder to load")
    p.set_defaults(fn=cmd_remotion)

    p = sub.add_parser("qa", help="check a rendered video folder (specs, frames, answer leaks)")
    p.add_argument("dir")
    p.add_argument("--no-transcribe", action="store_true")
    p.set_defaults(fn=cmd_qa)

    a = ap.parse_args(argv)
    _setup_logging(a.verbose)
    a.fn(a)


if __name__ == "__main__":
    main()
