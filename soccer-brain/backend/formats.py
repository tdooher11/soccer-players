"""Question generators for the additional formats (Guess the Player lives in trivia.py).

All formats return the same Question model, so the renderer, narration, timeline,
history and metadata code is shared.
"""

from __future__ import annotations

import collections
import random

from . import players as pstore
from .models import AnswerSpec, Clue, ClubVisual, Difficulty, FlagVisual, Player, PlayerChip, Question
from .trivia import TriviaError, _norm, fingerprint, validate_question

DEFAULT_DURATION = {"guess_player": 20.0, "career_path": 20.0, "guess_club": 20.0, "who_won_more": 16.0, "true_false": 15.0}

STAT_LABEL = {
    "ballon_dor": ("Ballon d'Or awards", "Ballon d'Or"),
    "champions_league": ("Champions League titles", "Champions League"),
    "world_cup": ("World Cups", "World Cup"),
}


def _club_popularity(pool: list[Player]) -> collections.Counter:
    return collections.Counter(c for p in pool for c in dict.fromkeys(p.career_clubs))


def _chip(p: Player, clubs: dict, value: str | None = None) -> PlayerChip:
    return PlayerChip(
        name=pstore.display_name(p.name),
        flagCode=p.country_code,
        imageSrc=p.image_path,
        club=pstore.club_badge(p.primary_club, clubs) if p.primary_club else None,
        value=value,
    )


# ------------------------------------------------------------------- career path


def _is_subsequence(seq: list[str], career: list[str]) -> bool:
    it = iter(dict.fromkeys(career))
    return all(any(c == x for x in it) for c in seq)


def career_path(p: Player, pool: list[Player], difficulty: Difficulty, duration: float, rng: random.Random) -> Question:
    clubs_all = list(dict.fromkeys(p.career_clubs))
    if len(clubs_all) < 3:
        raise TriviaError(f"{p.name} needs at least 3 career clubs for a career-path question.")
    pop = _club_popularity(pool)
    if len(clubs_all) > 5:
        middle = clubs_all[1:-1]
        ranked = sorted(middle, key=lambda c: (c != p.primary_club, -pop[c]))
        keep = set(ranked[:3])
        shown = [clubs_all[0]] + [c for c in middle if c in keep] + [clubs_all[-1]]
    else:
        shown = clubs_all
    if difficulty == "hard" and p.primary_club in shown and len(shown) > 3:
        trial = [c for c in shown if c != p.primary_club]
        if [x.id for x in pool if _is_subsequence(trial, x.career_clubs)] == [p.id]:
            shown = trial
    matches = [x.id for x in pool if _is_subsequence(shown, x.career_clubs)]
    if matches != [p.id]:
        raise TriviaError(f"That career path also fits {', '.join(m for m in matches if m != p.id)}.")
    clubs = pstore.load_clubs()
    complete = shown == clubs_all
    q = Question(
        id="",
        format="career_path",
        difficulty=difficulty,
        playerId=p.id,
        playerIds=[p.id],
        title="WHOSE CAREER?",
        question="Which famous player had this career?",
        introSpeech="Which famous player had this career?",
        clues=[Clue(text=c, visual=ClubVisual(club=pstore.club_badge(c, clubs)), fact=f"club:{c}", source="master-list career clubs") for c in shown],
        answer=AnswerSpec(
            title=pstore.display_name(p.name).upper(),
            spoken=p.spoken_name or pstore.display_name(p.name),
            subtitle=p.country + (" · main clubs shown" if not complete else ""),
            flagCode=p.country_code,
            imageSrc=p.image_path,
            club=pstore.club_badge(p.primary_club, clubs) if p.primary_club else None,
            jerseyNumber=p.jersey_number,
        ),
        durationSeconds=duration,
    )
    return q


# -------------------------------------------------------------------- who won more


def who_won_more(a: Player, b: Player, stat: str | None, duration: float) -> Question:
    def count(p: Player, s: str) -> int:
        x = p.achievement(s)
        return x.count if x else 0

    stats = [stat] if stat else ["ballon_dor", "champions_league", "world_cup"]
    chosen = next((s for s in stats if count(a, s) != count(b, s) and max(count(a, s), count(b, s)) > 0), None)
    if not chosen:
        raise TriviaError(f"{a.name} and {b.name} have the same number of {', '.join(STAT_LABEL[s][0] for s in stats)} — pick another stat or pair.")
    if a.category != b.category:
        raise TriviaError("Compare players from the same competition category (men's vs women's awards differ).")
    plural, single = STAT_LABEL[chosen]
    ca, cb = count(a, chosen), count(b, chosen)
    winner = a if ca > cb else b
    clubs = pstore.load_clubs()
    na, nb = pstore.display_name(a.name), pstore.display_name(b.name)
    sources = {(x.achievement(chosen).provenance.source if x.achievement(chosen) else "master-list") for x in (a, b)}
    return Question(
        id="",
        format="who_won_more",
        playerId=winner.id,
        playerIds=[a.id, b.id],
        title="WHO WON MORE?",
        question=f"Who has won more {plural}?",
        introSpeech=f"Who has won more {plural}? {a.spoken_name or na}… or {b.spoken_name or nb}?",
        clues=[],
        chips=[_chip(a, clubs, str(ca)), _chip(b, clubs, str(cb))],
        answer=AnswerSpec(
            title=pstore.display_name(winner.name).upper(),
            spoken=winner.spoken_name or pstore.display_name(winner.name),
            subtitle=f"{max(ca, cb)} {plural if max(ca, cb) != 1 else single}",
            flagCode=winner.country_code,
            imageSrc=winner.image_path,
            details=[f"{na} — {ca}", f"{nb} — {cb}"],
            versus=[_chip(a, clubs, str(ca)), _chip(b, clubs, str(cb))],
        ),
        revealSpeech=f"It's {winner.spoken_name or pstore.display_name(winner.name)}! {max(ca, cb)} to {min(ca, cb)}!",
        durationSeconds=duration,
        warnings=[] if sources <= {"verified", "master-list"} else ["Check the stat source before publishing."],
    )


# ---------------------------------------------------------------------- guess club


def guess_club(seed_players: list[Player], pool: list[Player], club: str | None, rng: random.Random, duration: float) -> Question:
    pop = _club_popularity(pool)
    if club is None:
        if seed_players:
            common = set.intersection(*(set(p.career_clubs) for p in seed_players))
            if not common:
                raise TriviaError("Those players never shared a club.")
            club = max(common, key=lambda c: pop[c])
        else:
            men = collections.Counter(c for p in pool if p.category == "men" for c in dict.fromkeys(p.career_clubs))
            options = [c for c, n in men.items() if n >= 3]
            if not options:
                raise TriviaError("No club has 3+ players in the database yet.")
            club = rng.choice(sorted(options))
    category = seed_players[0].category if seed_players else "men"
    members = [p for p in pool if club in p.career_clubs and p.category == category]
    chosen = list(seed_players)
    others = sorted((p for p in members if p not in chosen), key=lambda p: (-(p.image_path is not None), -len(p.achievements), p.name))
    rng.shuffle(others)
    others.sort(key=lambda p: -(len(p.achievements) + (2 if p.primary_club == club else 0)))
    for p in others:
        if len(chosen) >= 3:
            break
        trial = chosen + [p]
        shared = set.intersection(*(set(x.career_clubs) for x in trial))
        if len(trial) < 3 or shared == {club}:
            chosen = trial
    if len(chosen) < 3:
        raise TriviaError(f"Not enough players for {club} in the database (need 3).")
    shared = set.intersection(*(set(x.career_clubs) for x in chosen))
    if shared != {club}:
        raise TriviaError(f"These players also all played for {', '.join(sorted(shared - {club}))} — ambiguous.")
    all_current = all(not p.retired and p.current_club == club and pstore.current_club_is_fresh(p) for p in chosen)
    clubs = pstore.load_clubs()
    badge = pstore.club_badge(club, clubs)
    names = [pstore.display_name(p.name) for p in chosen]
    leak = {t for t in _norm(club).split() if len(t) >= 4} & set(_norm(" ".join(names)).split())
    if leak:
        raise TriviaError("A player's name contains the club name.")
    return Question(
        id="",
        format="guess_club",
        playerId=None,
        playerIds=[p.id for p in chosen],
        title="GUESS THE CLUB",
        question="Which club did all these players play for?" if not all_current else "Which club do all these players play for?",
        introSpeech="Which club did all these players play for?" if not all_current else "Which club do these players play for?",
        clues=[
            Clue(text=n, speech=p.spoken_name or n, visual=FlagVisual(code=p.country_code), fact=f"club:{club}", source="master-list career clubs")
            for n, p in zip(names, chosen)
        ],
        answer=AnswerSpec(
            title=club.upper(),
            spoken=club,
            subtitle="Current teammates!" if all_current else "They all played there!",
            flagCode=None,
            imageSrc=None,
            club=badge,
            details=[] if all_current else ["(not always at the same time)"],
        ),
        chips=[_chip(p, clubs) for p in chosen],
        durationSeconds=duration,
    )


# ---------------------------------------------------------------------- true/false


def true_false(p: Player, pool: list[Player], club: str | None, rng: random.Random, duration: float) -> Question:
    pop = _club_popularity(pool)
    clubs_p = list(dict.fromkeys(p.career_clubs))
    if not clubs_p:
        raise TriviaError(f"{p.name} has no career clubs recorded.")
    if club is None:
        if rng.random() < 0.5:
            club = rng.choice(clubs_p)
        else:
            big = [c for c, _ in pop.most_common(15) if c not in clubs_p]
            if not big:
                raise TriviaError("No good decoy club found.")
            club = rng.choice(big[:8])
    truth = club in clubs_p
    name = pstore.display_name(p.name)
    spoken = p.spoken_name or name
    clubs = pstore.load_clubs()
    pronoun = "She" if p.category == "women" else "He"
    shown = clubs_p if len(clubs_p) <= 4 else clubs_p[:2] + ["…"] + clubs_p[-1:]
    details = [f"Yes! {pronoun} played for {club}."] if truth else [f"No! {pronoun} never played for {club}.", f"{pronoun} played for {', '.join(shown)}."]
    warnings = []
    if not truth:
        warnings.append(
            "FALSE answers assume the career list is complete (youth teams and short loans are often missing). Double-check before publishing."
        )
    return Question(
        id="",
        format="true_false",
        playerId=p.id,
        playerIds=[p.id],
        title="TRUE OR FALSE?",
        question=f"Did {name} ever play for {club}?",
        introSpeech=f"True or false? Did {spoken} ever play for {club}?",
        clues=[],
        chips=[_chip(p, clubs)],
        answer=AnswerSpec(
            title="TRUE" if truth else "FALSE",
            spoken="True" if truth else "False",
            subtitle="",
            flagCode=p.country_code,
            imageSrc=p.image_path,
            club=pstore.club_badge(club, clubs),
            details=details,
            verdict="TRUE" if truth else "FALSE",
        ),
        revealSpeech=(f"True! {spoken} played for {club}!" if truth else f"False! {spoken} never played for {club}."),
        durationSeconds=duration,
        warnings=warnings,
    )


# ------------------------------------------------------------------------ dispatch


def generate(fmt: str, players: list[Player], *, pool: list[Player], difficulty: Difficulty, duration: float, seed: int | None, extra: dict) -> Question:
    rng = random.Random(seed)
    if fmt == "career_path":
        q = career_path(players[0], pool, difficulty, duration, rng)
    elif fmt == "who_won_more":
        if len(players) != 2:
            raise TriviaError("Who Won More needs exactly two players.")
        q = who_won_more(players[0], players[1], extra.get("stat"), duration)
    elif fmt == "guess_club":
        q = guess_club(players, pool, extra.get("club"), rng, duration)
    elif fmt == "true_false":
        q = true_false(players[0], pool, extra.get("statement"), rng, duration)
    else:
        raise TriviaError(f"Unknown format {fmt}")
    q.difficulty = difficulty
    fp = fingerprint(fmt, q.player_ids, [c.text for c in q.clues] + [q.question or ""])
    q.fingerprint = fp
    q.id = f"{'-'.join(q.player_ids)[:40]}-{fmt.replace('_', '')}-{fp[:6]}"
    q.warnings = q.warnings + validate_question(q, pool)
    return q
