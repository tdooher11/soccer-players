import math

import pytest

from backend import tts
from backend.models import Question, VideoSettings
from backend.production import generate_question
from backend.timeline import build_props


@pytest.fixture(scope="module")
def q() -> Question:
    return generate_question("guess_player", ["ronaldinho"], seed=7)


def test_tts_synthesis_and_cache():
    a = tts.synthesize("Guess the player! I'm from Brazil.")
    assert a.seconds > 0.8 and a.path.exists()
    b = tts.synthesize("Guess the player! I'm from Brazil.")
    assert b.cached and b.path == a.path
    assert "ronaldinho" not in a.path.name.lower()


def test_piper_provider_also_works():
    clip = tts.synthesize("Who am I?", provider="piper")
    assert clip.seconds > 0.3


def test_pronunciation_overrides_apply_to_speech_only():
    assert "Em-bah-pay" in tts.apply_pronunciation("It's Kylian Mbappé!") or "Em-bah-pay" in tts.apply_pronunciation("Mbappé")
    assert tts.apply_pronunciation("I played for PSG.") == "I played for P S G."


def test_narration_never_cut_off(q):
    props, report = build_props(q, VideoSettings())
    scenes = {s.id: s for s in props.timeline.scenes}
    assert props.audio.narration, "expected narration cues"
    for cue in props.audio.narration:
        sc = scenes[cue.scene_id]
        assert cue.from_ >= sc.from_
        assert cue.from_ + cue.duration_in_frames <= sc.from_ + sc.duration_in_frames, cue.scene_id
    assert abs(report.actual_seconds - q.duration_seconds) < 1.5


def test_timeline_is_contiguous_and_ordered(q):
    props, _ = build_props(q, VideoSettings())
    t = 0
    for s in props.timeline.scenes:
        assert s.from_ == t
        t += s.duration_in_frames
    assert t == props.timeline.total_frames
    types = [s.type for s in props.timeline.scenes]
    assert types.index("countdown") < types.index("reveal") < types.index("outro")


def test_narration_off_hits_target_exactly(q):
    props, report = build_props(q, VideoSettings(narration=False))
    assert props.audio.narration == []
    assert props.timeline.total_frames == round(q.duration_seconds * 30)


def test_missing_audio_fallback(q, monkeypatch):
    def boom(*a, **k):
        raise tts.TTSError("engine exploded")

    monkeypatch.setattr(tts, "synthesize", boom)
    props, report = build_props(q, VideoSettings())
    assert props.audio.narration == []
    assert any("failed" in w for w in report.warnings)
    assert props.timeline.total_frames > 0


def test_missing_image_fallback(q):
    q2 = q.model_copy(deep=True)
    q2.answer.image_src = None
    props, _ = build_props(q2, VideoSettings())
    assert props.answer.image_src is None and props.answer.jersey_number is not None
    props, _ = build_props(q, VideoSettings(showAnswerImage=False))
    assert props.answer.image_src is None


def test_long_target_duration(q):
    q2 = q.model_copy(deep=True)
    q2.duration_seconds = 25
    props, report = build_props(q2, VideoSettings())
    assert math.isclose(props.timeline.total_frames / 30, 25, abs_tol=0.8)


def test_unknown_provider_errors():
    with pytest.raises(tts.TTSError):
        tts.get_provider("nope")


def test_paid_provider_falls_back_without_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert tts.resolve_provider("openai").name in ("kokoro", "piper")


def test_slack_trim_is_exact_despite_rounding():
    """A tiny overrun spread over several scenes must still be trimmed (no forced speed-up)."""
    from backend.timeline import PlannedScene, _fit

    scenes = [PlannedScene(f"clue-{i}", "clue", i, 3.2) for i in range(4)]
    durs = _fit(scenes, 30, target_frames=380, tolerance=0)  # base 4 x 96 = 384 frames
    assert sum(durs) == 380


def test_outro_asks_for_comments(q):
    props, report = build_props(q, VideoSettings())
    assert props.outro.title == "HOW MANY CLUES?"
    outro = next(s for s in report.scenes if s["id"] == "outro")
    assert "comment" in outro["speech"].lower()
