from backend import players as ps
from backend import trivia
from backend.models import Clue, Question


def _pool():
    return ps.load_players()


def test_every_player_gets_an_unambiguous_question():
    pool = _pool()
    for p in pool:
        q = trivia.generate_guess_player(p, seed=1, pool=pool)
        assert len(q.clues) >= 4
        facts = {f.id: f for f in trivia.build_facts(p, ps.load_clubs())}
        chosen = tuple(facts[c.fact] for c in q.clues)
        assert trivia._matches(chosen, pool) == [p.id], p.id
        assert not [w for w in q.warnings if "gives away" in w or "also fit" in w], (p.id, q.warnings)


def test_clues_never_contain_the_answer():
    pool = _pool()
    for p in pool:
        q = trivia.generate_guess_player(p, seed=5, difficulty="easy", pool=pool)
        name_tokens = {t for t in trivia._norm(p.name).split() if len(t) >= 4}
        for c in q.clues:
            assert not name_tokens & set(trivia._norm(c.text).split()), (p.id, c.text)


def test_ronaldinho_matches_spec_style():
    pool = _pool()
    q = trivia.generate_guess_player(ps.get_player("ronaldinho"), difficulty="easy", seed=7, pool=pool)
    assert q.clues[0].fact == "country:BR"
    assert any(c.fact == "primary_club:Barcelona" for c in q.clues)
    assert q.answer.title == "RONALDINHO"


def test_clues_progress_from_vague_to_specific():
    pool = _pool()
    p = ps.get_player("lionel-messi")
    facts = {f.id: f for f in trivia.build_facts(p, ps.load_clubs())}
    q = trivia.generate_guess_player(p, difficulty="medium", seed=3, pool=pool)
    fames = [facts[c.fact].fame for c in q.clues[1:]]
    assert fames == sorted(fames)


def test_unverified_current_club_is_never_a_clue():
    pool = _pool()
    p = ps.get_player("erling-haaland")
    p.current_club_verified_at = None
    ids = [f.id for f in trivia.build_facts(p, ps.load_clubs())]
    assert not any(i.startswith("current_club:") for i in ids)
    assert f"club:{p.current_club}" not in ids


def test_leak_detection_on_custom_clue():
    q = trivia.generate_guess_player(ps.get_player("ronaldinho"), seed=1)
    q.clues.append(Clue(text="Ronaldinho is my name"))
    w = trivia.validate_question(q)
    assert any("gives away" in x for x in w)
    assert any("custom clue" in x for x in w)


def test_ambiguity_detected():
    q = Question.model_validate(
        {
            "id": "t",
            "playerId": "ronaldinho",
            "clues": [{"text": "I'm from Brazil.", "fact": "country:BR", "visual": {"kind": "flag", "code": "BR"}}],
            "answer": {"title": "RONALDINHO"},
        }
    )
    assert any("also fit" in w for w in trivia.validate_question(q))


def test_avoids_previously_used_fact_sets():
    pool = _pool()
    p = ps.get_player("cristiano-ronaldo")
    first = trivia.generate_guess_player(p, seed=9, pool=pool)
    used = {frozenset(c.fact for c in first.clues)}
    second = trivia.generate_guess_player(p, seed=9, pool=pool, avoid_fact_sets=used)
    assert frozenset(c.fact for c in second.clues) != frozenset(c.fact for c in first.clues)
