import pytest

from backend import metadata, players as ps
from backend.production import generate_question
from backend.trivia import TriviaError


def test_career_path_is_accurate_order():
    q = generate_question("career_path", ["cristiano-ronaldo"], seed=1)
    assert [c.text for c in q.clues] == ["Sporting CP", "Manchester United", "Real Madrid", "Juventus", "Al-Nassr"]
    assert q.answer.title == "CRISTIANO RONALDO"


def test_career_path_subset_is_labelled():
    q = generate_question("career_path", ["zlatan-ibrahimovic"], seed=1)
    career = list(dict.fromkeys(ps.get_player("zlatan-ibrahimovic").career_clubs))
    shown = [c.text for c in q.clues]
    assert [c for c in career if c in shown] == shown  # chronological subsequence
    assert "main clubs" in q.answer.subtitle


def test_who_won_more_messi_ronaldo():
    q = generate_question("who_won_more", ["lionel-messi", "cristiano-ronaldo"], extra={"stat": "ballon_dor"})
    assert q.answer.title == "LIONEL MESSI"
    assert q.answer.details == ["Lionel Messi — 8", "Cristiano Ronaldo — 5"]


def test_who_won_more_tie_is_rejected():
    with pytest.raises(TriviaError):
        generate_question("who_won_more", ["bukayo-saka", "declan-rice"], extra={"stat": "ballon_dor"})


def test_guess_club_unique_shared_club():
    q = generate_question("guess_club", ["bukayo-saka"], seed=2)
    members = [ps.get_player(i) for i in q.player_ids]
    shared = set.intersection(*(set(m.career_clubs) for m in members))
    assert shared == {q.answer.club.name}
    assert len({m.category for m in members}) == 1


def test_true_false_cucurella_real_madrid():
    q = generate_question("true_false", ["marc-cucurella"], extra={"statement": "Real Madrid"})
    assert q.answer.verdict == "FALSE"
    assert any("career list is complete" in w for w in q.warnings)
    t = generate_question("true_false", ["marc-cucurella"], extra={"statement": "Chelsea"})
    assert t.answer.verdict == "TRUE"


def test_metadata_title_hides_answer():
    pool = ps.players_by_id()
    for pid in ["ronaldinho", "lionel-messi", "pele", "bukayo-saka"]:
        q = generate_question("guess_player", [pid], seed=4)
        m = metadata.build(q, pool, video_file="x.mp4", duration=18.0)
        for t in m["titleOptions"]:
            assert pool[pid].name.split()[-1].lower() not in t.lower()
        assert "#soccer" in m["hashtags"]
