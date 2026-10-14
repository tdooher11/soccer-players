from pathlib import Path

from backend import production, rendering, store
from backend.config import settings
from backend.models import VideoSettings


def _fake_render(fail_ids: set[str]):
    def fake(jobs, on_event=None):
        res = rendering.RenderResult()
        for j in jobs:
            if j.props["answer"]["title"] in fail_ids:
                res.errors[j.id] = "simulated crash"
            else:
                j.output.parent.mkdir(parents=True, exist_ok=True)
                j.output.write_bytes(b"fake mp4")
                res.ok[j.id] = j.output
        return res

    return fake


def test_batch_continues_after_failure_and_retry_only_reruns_failed(monkeypatch):
    s = VideoSettings(narration=False, music=False)
    monkeypatch.setattr(production, "render", _fake_render({"PELÉ"}))
    res = production.batch(3, player_ids=["pele", "lionel-messi", "ronaldinho"], s=s, seed=1, days=0)
    assert len(res.rendered) == 2 and len(res.failed) == 1
    failed = res.failed[0]
    assert failed["status"] == "failed" and "simulated" in failed["error"]
    out = settings.output_dir / failed["outputDir"]
    assert (out / "question.json").exists() and (out / "project.json").exists()
    ok_dirs = [settings.output_dir / r["outputDir"] for r in res.rendered]
    for d in ok_dirs:
        assert (d / "metadata.json").exists()

    calls = []

    def recording(jobs, on_event=None):
        calls.extend(j.id for j in jobs)
        return _fake_render(set())(jobs, on_event)

    monkeypatch.setattr(production, "render", recording)
    r2 = production.retry_failed(res.batch_id)
    assert calls == [failed["id"]]
    assert len(r2.rendered) == 1
    hist = {h["id"]: h for h in store.list_history()}
    assert hist[failed["id"]]["status"] == "rendered"


def test_batch_selects_unused_players_and_no_duplicates(monkeypatch):
    monkeypatch.setattr(production, "render", _fake_render(set()))
    s = VideoSettings(narration=False, music=False)
    production.batch(2, player_ids=["neymar", "kaka"], s=s, seed=2, days=0)  # mark two as used
    recent = store.recently_used_ids(30)
    assert {"neymar", "kaka"} <= recent
    res = production.batch(6, s=s, seed=3, days=30, dry_run=True)
    picked = [pid for r in res.rendered for pid in r["playerIds"]]
    assert len(picked) == len(set(picked)) == 6
    assert not set(picked) & recent


def test_output_folders_unique():
    q = production.generate_question("guess_player", ["kaka"], seed=1)
    a = production.prepare(q, VideoSettings(narration=False))
    b = production.prepare(q, VideoSettings(narration=False))
    assert a.out_dir != b.out_dir
    assert Path(a.out_dir).parent.name == Path(b.out_dir).parent.name  # same date folder
