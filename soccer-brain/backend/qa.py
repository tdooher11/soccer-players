"""Automated checks on a rendered video folder.

Machine-checkable: codec/size/fps/duration, audio present + loudness, scene frames extracted,
answer not in pre-reveal text, (optional) answer not *spoken* before the reveal (Whisper).
Subjective quality still needs a human look at qa/contact-sheet.jpg.
"""

from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from pathlib import Path


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout)


def loudness(path: Path) -> float | None:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def extract_frames(video: Path, props: dict, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    fps = props["fps"]
    frames = []
    for sc in props["timeline"]["scenes"]:
        t = (sc["from"] + sc["durationInFrames"] * 0.7) / fps
        dest = out_dir / f"{sc['from']:04d}-{sc['id']}.jpg"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(dest)], check=True)
        frames.append(dest)
    sheet = out_dir.parent / "contact-sheet.jpg"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-pattern_type", "glob", "-i", str(out_dir / "*.jpg"),
            "-vf", f"scale=360:640,tile={len(frames)}x1:padding=6:color=white", "-frames:v", "1", str(sheet),
        ],
        check=True,
    )
    return frames


def transcribe(video: Path) -> list[dict] | None:
    try:
        import numpy as np
        from faster_whisper import WhisperModel
    except ImportError:
        return None
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(video), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(np.frombuffer(raw, np.float32), word_timestamps=True)
    return [{"t": round(w.start, 2), "word": w.word.strip()} for s in segs for w in (s.words or [])]


def check_video(folder: Path, *, with_transcript: bool = True) -> dict:
    video = folder / "video.mp4"
    project = json.loads((folder / "project.json").read_text())
    question = json.loads((folder / "question.json").read_text())
    props = project["props"]
    checks: list[dict] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        checks.append({"check": name, "ok": bool(ok), "detail": detail})

    check("video file exists", video.exists())
    if not video.exists():
        return {"passed": False, "checks": checks}
    info = probe(video)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    dur = float(info["format"]["duration"])
    expected = props["timeline"]["totalFrames"] / props["fps"]
    check("H.264 video", v["codec_name"] == "h264", v["codec_name"])
    check("1080x1920 (9:16)", (v["width"], v["height"]) == (1080, 1920), f"{v['width']}x{v['height']}")
    check("30 fps", v["r_frame_rate"] in ("30/1", "30000/1000"), v["r_frame_rate"])
    check("AAC audio", a is not None and a["codec_name"] == "aac", a["codec_name"] if a else "missing")
    check("duration matches timeline", abs(dur - expected) < 0.15, f"{dur:.2f}s vs {expected:.2f}s")
    check("Shorts-length (≤ 60s)", dur <= 60, f"{dur:.2f}s")
    lufs = loudness(video)
    check("loudness near -14 LUFS", lufs is not None and -16.5 <= lufs <= -12, f"{lufs} LUFS")

    # Mystery formats: the answer must not appear before the reveal. (Who Won More names both
    # players in the question and True/False's title contains both options, by design.)
    mystery = question["format"] in ("guess_player", "career_path", "guess_club")
    ans_tokens = {t for t in _norm(question["answer"]["title"]).split() if len(t) >= 4}
    pre_text = " ".join([props.get("title") or "", props.get("question") or ""] + [c["text"] for c in props["clues"]])
    if mystery:
        leak = ans_tokens & set(_norm(pre_text).split())
        check("answer absent from pre-reveal text", not leak, ", ".join(sorted(leak)))
    reveal = next(s for s in props["timeline"]["scenes"] if s["type"] == "reveal")
    reveal_t = reveal["from"] / props["fps"]
    check("countdown precedes reveal", any(s["type"] == "countdown" and s["from"] < reveal["from"] for s in props["timeline"]["scenes"]))
    img = props["answer"].get("imageSrc")
    if img and mystery:
        meta_name = Path(img).name
        check("answer image filename is anonymous", not (ans_tokens & set(_norm(meta_name.replace("-", " ").replace(".", " ")).split())), meta_name)

    meta_path = folder / "metadata.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())
        if question["format"] in ("guess_player", "career_path", "guess_club"):
            check("title does not reveal answer", not (ans_tokens & set(_norm(meta["title"]).split())), meta["title"])

    frames = extract_frames(video, props, folder / "qa" / "frames")
    check("scene frames extracted", len(frames) == len(props["timeline"]["scenes"]), str(len(frames)))

    transcript = None
    if with_transcript and props["audio"]["narration"]:
        transcript = transcribe(video)
        if transcript is not None and mystery:
            early = [w for w in transcript if w["t"] < reveal_t - 0.05]
            spoken_leak = ans_tokens & set(_norm(" ".join(w["word"] for w in early)).split())
            check("answer not spoken before reveal", not spoken_leak, ", ".join(sorted(spoken_leak)))
            later = [w for w in transcript if w["t"] >= reveal_t - 0.05]
            heard = ans_tokens & set(_norm(" ".join(w["word"] for w in later)).split())
            check("answer audible at reveal", bool(heard) or question["format"] in ("who_won_more", "true_false"), " ".join(w["word"] for w in later))

    report = {
        "passed": all(c["ok"] for c in checks),
        "video": str(video),
        "durationSeconds": round(dur, 2),
        "loudnessLUFS": lufs,
        "checks": checks,
        "contactSheet": str(folder / "qa" / "contact-sheet.jpg"),
        "transcript": " ".join(f"[{w['t']}]{w['word']}" for w in transcript) if transcript else None,
        "humanReview": "Look at the contact sheet / watch the video for subjective quality (layout, pacing, pronunciation).",
    }
    (folder / "qa" / "report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
    return report
