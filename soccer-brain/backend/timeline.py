"""Turns a Question + VideoSettings into Remotion VideoProps.

This is the single place where timing is decided. Narration is synthesized first and
measured; scenes are then sized so narration is never cut off, and squeezed back towards
the target duration where there is slack.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

from . import tts
from .config import settings
from .models import (
    AnswerProps,
    AudioCue,
    AudioSpec,
    Branding,
    ClueProps,
    MusicSpec,
    OutroProps,
    Question,
    Scene,
    Timeline,
    VideoProps,
    VideoSettings,
)

log = logging.getLogger(__name__)

MUSIC_SRC = "audio/music/stadium-pulse.mp3"

# Frames between scene start and the narrator starting (lets the card animate in).
LEAD = {"clue": 6, "countdown": 0, "reveal": 9, "outro": 3}
# Breathing room after narration ends before the next scene.
TAIL = {"clue": 9, "countdown": 0, "reveal": 14, "outro": 10}
FIRST_LINE_EXTRA_LEAD = 4  # let the opening whoosh pass before "Guess the player!"
MIN_SECONDS = {"clue": 2.0, "countdown": 2.0, "reveal": 2.8, "outro": 1.0}
MAX_AUTO_SPEEDUP = 1.12

# The closing call-to-action: asks viewers to comment how many clues they needed.
# (title, subtitle) on screen + what the narrator says. Overridable per question.
_COMMENT = "Comment how many you needed!"
OUTRO = {
    "guess_player": ("HOW MANY CLUES?", _COMMENT, "Got it? Comment how many clues you needed!"),
    "career_path": ("HOW MANY CLUBS?", _COMMENT, "Got it? Comment how many clubs you needed!"),
    "guess_club": ("HOW MANY PLAYERS?", _COMMENT, "Got it? Comment how many players you needed!"),
    "who_won_more": ("DID YOU GET IT?", "Tell us in the comments!", "Did you get it right? Tell us in the comments!"),
    "true_false": ("DID YOU GET IT?", "Tell us in the comments!", "Did you get it right? Tell us in the comments!"),
}
# Running slightly long is better than rushing the narrator.
OVERRUN_TOLERANCE_SECONDS = 0.75


@dataclass
class PlannedScene:
    id: str
    type: str
    index: int
    base_seconds: float
    speech: str | None = None
    clip: tts.Clip | None = None


@dataclass
class BuildReport:
    target_seconds: float
    actual_seconds: float = 0.0
    speech_speed: float = 1.0
    warnings: list[str] = field(default_factory=list)
    scenes: list[dict] = field(default_factory=list)
    narration_seconds: float = 0.0
    tts_provider: str | None = None
    tts_voice: str | None = None
    tts_cached: int = 0
    tts_generated: int = 0

    def dump(self) -> dict:
        return self.__dict__


def spoken_name(q: Question) -> str:
    return q.answer.spoken or q.answer.title.title()


def plan_scenes(q: Question, s: VideoSettings) -> list[PlannedScene]:
    """Scene list with base durations that sum to the target duration."""
    T = q.duration_seconds
    C = float(s.countdown_seconds)
    R = 3.0
    O = 2.5
    n = max(1, len(q.clues))
    clue_total = max(T - C - R - O, n * MIN_SECONDS["clue"])
    first = min(2.0, clue_total / n) if n > 1 else clue_total
    rest = (clue_total - first) / (n - 1) if n > 1 else 0

    intro = q.intro_speech or ("Guess the player!" if q.format == "guess_player" else q.question)
    scenes: list[PlannedScene] = []
    for i, clue in enumerate(q.clues):
        speech = clue.speech or clue.text
        if i == 0 and intro:
            speech = f"{intro} {speech}"
        scenes.append(PlannedScene(f"clue-{i + 1}", "clue", i, first if i == 0 else rest, speech))
    if not q.clues:  # formats with just a question
        scenes.append(PlannedScene("clue-1", "clue", 0, clue_total, intro))
    scenes.append(PlannedScene("countdown", "countdown", 0, C))
    reveal = q.reveal_speech or f"It's {spoken_name(q)}!"
    scenes.append(PlannedScene("reveal", "reveal", 0, R, reveal))
    scenes.append(PlannedScene("outro", "outro", 0, O, q.outro_speech or OUTRO[q.format][2]))
    return scenes


def _synthesize(scenes: list[PlannedScene], s: VideoSettings, speed: float, report: BuildReport) -> None:
    provider = tts.resolve_provider(s.tts_provider)
    report.tts_provider = provider.name
    for sc in scenes:
        sc.clip = None
        if not (s.narration and sc.speech):
            continue
        try:
            sc.clip = tts.synthesize(sc.speech, provider=provider.name, voice=s.voice, speed=speed)
            report.tts_cached += sc.clip.cached
            report.tts_generated += not sc.clip.cached
        except Exception as e:  # missing-audio fallback: render without this line
            log.exception("TTS failed for scene %s", sc.id)
            report.warnings.append(f"Narration for {sc.id} failed ({e}); rendering without it.")
    report.tts_voice = s.voice or (settings.tts_voice if provider.name == settings.tts_provider and settings.tts_voice else provider.default_voice())


def _needs(scenes: list[PlannedScene], fps: int) -> list[int]:
    out = []
    for sc in scenes:
        n = math.ceil(MIN_SECONDS[sc.type] * fps)
        if sc.type == "countdown":
            n = round(sc.base_seconds * fps)
        if sc.clip:
            n = max(n, LEAD[sc.type] + (FIRST_LINE_EXTRA_LEAD if sc.id == "clue-1" else 0) + math.ceil(sc.clip.seconds * fps) + TAIL[sc.type])
        out.append(n)
    return out


def _fit(scenes: list[PlannedScene], fps: int, target_frames: int, tolerance: int = 0) -> list[int]:
    needs = _needs(scenes, fps)
    # Round scene *boundaries*, not each scene, so the base lengths add up to the target exactly.
    edges, acc = [0], 0.0
    for sc in scenes:
        acc += sc.base_seconds
        edges.append(round(acc * fps))
    base = [b - a for a, b in zip(edges, edges[1:])]
    durs = [max(b, n) for b, n in zip(base, needs)]
    excess = sum(durs) - (target_frames + tolerance)
    if excess > 0:
        slack = [d - n for d, n in zip(durs, needs)]
        total_slack = sum(slack)
        if total_slack > 0:
            take = min(excess, total_slack)
            cut = [math.floor(take * sl / total_slack) for sl in slack]
            # Hand out frames lost to rounding, biggest slack first, so the cut is exact.
            for i in sorted(range(len(slack)), key=lambda i: -slack[i]):
                if sum(cut) >= take:
                    break
                if cut[i] < slack[i]:
                    cut[i] += 1
            durs = [d - c for d, c in zip(durs, cut)]
    elif sum(durs) < target_frames:
        excess = sum(durs) - target_frames
        # Under target (e.g. narration off): give spare time to clue scenes.
        clue_idx = [i for i, sc in enumerate(scenes) if sc.type == "clue"]
        for k, i in enumerate(clue_idx):
            durs[i] += (-excess) // len(clue_idx) + (1 if k < (-excess) % len(clue_idx) else 0)
    return durs


def build_props(q: Question, s: VideoSettings, *, auto_speed: bool = True) -> tuple[VideoProps, BuildReport]:
    fps = s.fps
    target = round(q.duration_seconds * fps)
    tolerance = round(OVERRUN_TOLERANCE_SECONDS * fps)
    report = BuildReport(target_seconds=q.duration_seconds)
    scenes = plan_scenes(q, s)

    speed = s.speech_speed
    _synthesize(scenes, s, speed, report)
    durs = _fit(scenes, fps, target, tolerance)
    # Over target even after removing slack? Speak a little faster (bounded), then accept.
    while auto_speed and s.narration and sum(durs) > target + tolerance and speed < s.speech_speed * MAX_AUTO_SPEEDUP - 1e-6:
        speed = round(min(speed + 0.04, s.speech_speed * MAX_AUTO_SPEEDUP), 3)
        _synthesize(scenes, s, speed, report)
        durs = _fit(scenes, fps, target, tolerance)
    report.speech_speed = speed
    if sum(durs) > target + tolerance:
        report.warnings.append(
            f"Narration needs {sum(durs) / fps:.1f}s; video extended beyond the {q.duration_seconds:.0f}s target so nothing is cut off."
        )

    # Assemble timeline + narration cues.
    out_scenes: list[Scene] = []
    cues: list[AudioCue] = []
    t = 0
    for sc, d in zip(scenes, durs):
        out_scenes.append(Scene(id=sc.id, type=sc.type, index=sc.index, **{"from": t, "durationInFrames": d}))
        if sc.clip:
            lead = LEAD[sc.type] + (FIRST_LINE_EXTRA_LEAD if sc.id == "clue-1" else 0)
            cues.append(
                AudioCue(
                    src=sc.clip.public_src,
                    volume=1.0,
                    sceneId=sc.id,
                    **{"from": t + lead, "durationInFrames": math.ceil(sc.clip.seconds * fps)},
                )
            )
            report.narration_seconds += sc.clip.seconds
        report.scenes.append({"id": sc.id, "type": sc.type, "seconds": round(d / fps, 2), "speech": sc.speech})
        t += d
    report.actual_seconds = round(t / fps, 2)

    a = q.answer
    props = VideoProps(
        format=q.format,
        fps=fps,
        theme=s.theme,
        textScale=s.text_scale,
        title=q.title,
        question=q.question,
        clues=[ClueProps(text=c.text, visual=c.visual) for c in q.clues],
        chips=q.chips,
        answer=AnswerProps(
            title=a.title,
            subtitle=a.subtitle,
            flagCode=a.flag_code,
            imageSrc=a.image_src if s.show_answer_image else None,
            club=a.club,
            jerseyNumber=a.jersey_number,
            details=a.details,
            verdict=a.verdict,
            versus=a.versus,
        ),
        showAnswerImage=s.show_answer_image,
        timeline=Timeline(totalFrames=t, scenes=out_scenes),
        audio=AudioSpec(
            narration=cues,
            music=MusicSpec(src=MUSIC_SRC, volume=s.music_volume) if s.music and (settings.public_dir / MUSIC_SRC).exists() else None,
            sfxVolume=s.sfx_volume,
        ),
        branding=Branding(channel=settings.channel_name, handle=settings.channel_handle),
        outro=OutroProps(title=q.outro_title or OUTRO[q.format][0], subtitle=q.outro_subtitle or OUTRO[q.format][1]),
    )
    if s.music and props.audio.music is None:
        report.warnings.append("Music file missing; run `./soccer-brain assets`.")
    return props, report
