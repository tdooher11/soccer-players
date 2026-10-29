"""Deterministic trivia engine.

Clues are built only from structured facts in the player store (master list + verified
overlay). Every generated clue carries a `fact` id so it can be re-checked later, and the
final clue set is checked against the whole database: it must point to exactly one player.
"""

from __future__ import annotations

import hashlib
import itertools
import random
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Callable

from . import players as pstore
from .models import (
    AnswerSpec,
    Clue,
    ClubVisual,
    Difficulty,
    FlagVisual,
    IconVisual,
    NoVisual,
    Player,
    Question,
)

POSITION_WORD = {"GK": "goalkeeper", "DEF": "defender", "MID": "midfielder", "FWD": "striker"}
POSITION_ICON = {"GK": "gloves", "DEF": "whistle", "MID": "shirt", "FWD": "boot"}

# Countries whose name reads best with "the" in a sentence.
THE_COUNTRIES = {"United States", "Netherlands", "Czech Republic"}


@dataclass
class Fact:
    id: str
    kind: str
    texts: list[str]
    visual: object
    test: Callable[[Player], bool]
    fame: float  # 0 = obscure, 1 = instant give-away
    source: str
    speech: list[str] | None = None
    matches: int = 0
    # Supporting facts (birth decade, position, continental cups, minor clubs) are only used
    # when the preferred ones can't make the answer unique on their own.
    supporting: bool = False


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s)


def _country_phrase(c: str) -> str:
    return f"the {c}" if c in THE_COUNTRIES else c


def _ord_times(n: int) -> str:
    return {2: "twice", 3: "three times", 4: "four times", 5: "five times", 6: "six times", 7: "seven times", 8: "eight times"}.get(n, f"{n} times")


def _a(word: str) -> str:
    return f"an {word}" if word[:1].upper() in "AEIOU" else f"a {word}"


def _women(p: Player, s: str) -> str:
    return f"Women's {s}" if p.category == "women" else s


def _src(p: Player, field_: str) -> str:
    prov = p.provenance.get(field_)
    return prov.source if prov else "master-list"


def build_facts(p: Player, clubs: dict) -> list[Fact]:
    facts: list[Fact] = []
    was = "was" if p.retired else "am"
    cc = p.country_code

    facts.append(
        Fact(
            f"country:{cc}",
            "country",
            [f"I'm from {_country_phrase(p.country)}.", f"I play for {_country_phrase(p.country)}." if not p.retired else f"I played for {_country_phrase(p.country)}."],
            FlagVisual(code=cc),
            lambda x, cc=cc: x.country_code == cc,
            0.25,
            _src(p, "country"),
        )
    )
    if p.position:
        w = POSITION_WORD[p.position]
        facts.append(
            Fact(
                f"position:{p.position}",
                "position",
                [f"I was a {w}." if p.retired else f"I'm a {w}.", f"I {'played' if p.retired else 'play'} as a {w}."],
                IconVisual(icon=POSITION_ICON[p.position]),
                lambda x, pos=p.position: x.position == pos,
                0.1,
                _src(p, "position"),
                supporting=True,
            )
        )

    current_fresh = pstore.current_club_is_fresh(p)
    distinct = list(dict.fromkeys(p.career_clubs))
    for i, club in enumerate(distinct):
        badge = pstore.club_badge(club, clubs)
        is_current = (not p.retired) and club == p.current_club
        if club == p.primary_club:
            if p.retired:
                texts = [f"I became a legend at {club}.", f"I'm {_a(club)} legend."]
            else:
                texts = [f"I've starred for {club}."]
            facts.append(
                Fact(f"primary_club:{club}", "primary_club", texts, ClubVisual(club=badge), lambda x, c=club: c in x.career_clubs, 0.8, _src(p, "primary_club"))
            )
            continue
        if is_current:
            if current_fresh:
                facts.append(
                    Fact(
                        f"current_club:{club}",
                        "current_club",
                        [f"I play for {club} now.", f"Today I play for {club}."],
                        ClubVisual(club=badge),
                        lambda x, c=club: x.current_club == c,
                        0.7,
                        f"confirmed {p.current_club_verified_at}",
                    )
                )
            continue  # unverified current club: never used
        fame = 0.45 if i > 0 else 0.3
        facts.append(
            Fact(
                f"club:{club}",
                "club",
                [f"I played for {club}.", f"I once played for {club}.", f"I've worn the {club} shirt."],
                ClubVisual(club=badge),
                lambda x, c=club: c in x.career_clubs,
                fame,
                _src(p, "career_clubs"),
            )
        )
    if len(distinct) >= 3:
        first = distinct[0]
        facts.append(
            Fact(
                f"first_club:{first}",
                "first_club",
                [f"My first big club was {first}.", f"I started my career at {first}."],
                ClubVisual(club=pstore.club_badge(first, clubs)),
                lambda x, c=first: bool(x.career_clubs) and x.career_clubs[0] == c,
                0.35,
                _src(p, "career_clubs"),
            )
        )
    if len(distinct) == 1 and not p.retired:
        facts.append(
            Fact(
                "one_club",
                "one_club",
                [f"I've only ever played for one club: {distinct[0]}."],
                ClubVisual(club=pstore.club_badge(distinct[0], clubs)),
                lambda x, c=distinct[0]: list(dict.fromkeys(x.career_clubs)) == [c],
                0.75,
                _src(p, "career_clubs"),
            )
        )

    for a in p.achievements:
        src = a.provenance.source + (f" ({a.provenance.source_url})" if a.provenance.source_url else "")
        if a.type == "ballon_dor":
            name = "Ballon d'Or Féminin" if p.category == "women" else "Ballon d'Or"
            if a.count == 1 and a.years:
                texts = [f"I won the {a.years[0]} {name}.", f"In {a.years[0]}, I won the {name}!"]
                test = lambda x, y=a.years[0]: (b := x.achievement("ballon_dor")) is not None and y in b.years
                fame = 0.9
            elif a.count == 1:
                texts = [f"I won the {name}!"]
                test = lambda x: (b := x.achievement("ballon_dor")) is not None and b.count >= 1
                fame = 0.75
            else:
                texts = [f"I won the {name} {_ord_times(a.count)}!"]
                test = lambda x, n=a.count: (b := x.achievement("ballon_dor")) is not None and b.count == n
                fame = 0.95
            facts.append(Fact(f"ballon_dor:{a.count}:{','.join(map(str, a.years))}", "award", texts, IconVisual(icon="ballon"), test, fame, src))
        elif a.type in ("world_cup", "champions_league"):
            kind = a.type
            name = _women(p, "World Cup" if kind == "world_cup" else "Champions League")
            icon = "cup" if kind == "world_cup" else "trophy"
            if a.count == 1 and a.years:
                # One win, year known: "I won the World Cup in 2002!"
                y = a.years[0]
                texts = [f"I won the {name} in {y}!", f"In {y}, I won the {name}!"]
                test = lambda x, k=kind, y=y: (b := x.achievement(k)) is not None and y in b.years
                fame = 0.65 if kind == "world_cup" else 0.55
                fid = f"{kind}:1:{y}"
            elif a.count == 1:
                texts = [f"I won the {name}!"]
                test = lambda x, k=kind: (b := x.achievement(k)) is not None and b.count >= 1
                fame = 0.55 if kind == "world_cup" else 0.4
                fid = f"{kind}:1"
            else:
                texts = [f"I won the {name} {_ord_times(a.count)}!"]
                test = lambda x, k=kind, n=a.count: (b := x.achievement(k)) is not None and b.count == n
                fame = 0.85 if kind == "world_cup" else 0.6
                fid = f"{kind}:{a.count}"
            facts.append(Fact(fid, "award", texts, IconVisual(icon=icon), test, fame, src))
        elif a.type == "continental" and a.label:
            lab = _women(p, a.label)
            texts = [f"I won the {lab}!"] if a.count == 1 else [f"I won the {lab} {_ord_times(a.count)}!"]
            facts.append(
                Fact(
                    f"continental:{a.count}",
                    "award",
                    texts,
                    IconVisual(icon="trophy"),
                    lambda x, n=a.count, lab=a.label: (b := x.achievement("continental")) is not None and b.label == lab and b.count >= n,
                    0.45,
                    src,
                    supporting=True,
                )
            )

    if p.dob and not p.died:
        decade = int(p.dob[:4]) // 10 * 10
        facts.append(
            Fact(
                f"born_decade:{decade}",
                "born",
                [f"I was born in the {decade}s.", f"My birthday is in the {decade}s."],
                IconVisual(icon="cake"),
                lambda x, d=decade: bool(x.dob) and int(x.dob[:4]) // 10 * 10 == d,
                0.1,
                _src(p, "dob"),
                supporting=True,
            )
        )
    return facts


@dataclass
class Candidate:
    facts: tuple[Fact, ...]
    score: float
    matches: list[str] = field(default_factory=list)


DIFFICULTY_TARGET = {"easy": 0.62, "medium": 0.45, "hard": 0.3}


def _matches(facts: tuple[Fact, ...], pool: list[Player]) -> list[str]:
    return [x.id for x in pool if all(f.test(x) for f in facts)]


def _order(facts: tuple[Fact, ...]) -> list[Fact]:
    """Vague first, give-away last; country leads (it's the show's signature opener)."""
    country = [f for f in facts if f.kind == "country"]
    rest = sorted((f for f in facts if f.kind != "country"), key=lambda f: (f.fame, -f.matches))
    return country + rest


MAJOR_CLUB_MIN_PLAYERS = 3  # a club at least this many of our players played for counts as "major"


def _mark_minor_clubs(facts: list[Fact]) -> None:
    """Club clues about little-known clubs become supporting (needs .matches = players at that club)."""
    for f in facts:
        if f.kind in ("club", "first_club") and f.matches < MAJOR_CLUB_MIN_PLAYERS:
            f.supporting = True


def _combo_ok(combo: tuple[Fact, ...]) -> bool:
    """House rules for a clue set: varied, and no two clues saying the same thing."""
    kinds = [f.kind for f in combo]
    if kinds.count("award") > 3 or kinds.count("born") > 1 or kinds.count("position") > 1 or kinds.count("country") > 1:
        return False
    if sum(k in ("club", "primary_club", "first_club", "current_club", "one_club") for k in kinds) > 3:
        return False
    if "primary_club" in kinds and "one_club" in kinds:
        return False
    # The same club twice (e.g. "first club was Monaco" + "played for Monaco").
    club_names = [f.id.split(":", 1)[1] for f in combo if f.kind in ("club", "primary_club", "first_club", "current_club")]
    return len(club_names) == len(set(club_names))


def choose_clues(
    p: Player,
    pool: list[Player],
    difficulty: Difficulty,
    n: int = 4,
    seed: int = 0,
    avoid_fact_sets: set[frozenset[str]] | None = None,
) -> Candidate | None:
    clubs = pstore.load_clubs()
    facts = build_facts(p, clubs)
    for f in facts:
        f.matches = sum(1 for x in pool if f.test(x))
    _mark_minor_clubs(facts)
    rng = random.Random(seed)
    target = DIFFICULTY_TARGET[difficulty]
    best: Candidate | None = None
    for combo in itertools.combinations(facts, min(n, len(facts))):
        if not _combo_ok(combo):
            continue
        kinds = [f.kind for f in combo]
        m = _matches(combo, pool)
        if m != [p.id]:
            continue
        ordered = _order(combo)
        # Unique only on the last clue = nobody can solve early (good); unique much earlier = too easy.
        solved_at = next(i for i in range(1, len(ordered) + 1) if _matches(tuple(ordered[:i]), pool) == [p.id])
        mean_fame = sum(f.fame for f in combo) / len(combo)
        score = -abs(mean_fame - target) * 3
        score -= 1.2 * sum(f.supporting for f in combo)  # prefer clubs + big trophies
        # Include every big trophy the player has (Ballon d'Or, Champions League, World Cup) and
        # their signature club: these are the clues fans remember. Ordering keeps them late.
        big = sum(f.id.split(":")[0] in ("ballon_dor", "champions_league", "world_cup") for f in combo)
        weight = 0.5 if difficulty == "hard" else 1.0
        score += weight * (0.5 * big + (0.3 if "primary_club" in kinds else 0))
        score += 0.6 if "country" in kinds else 0
        score += 0.25 * (solved_at - 1) / max(1, len(ordered) - 1)
        if difficulty == "easy":
            score += 0.5 * ordered[-1].fame
        if difficulty == "hard" and ordered[-1].fame > 0.85:
            score -= 0.4
        if avoid_fact_sets and frozenset(f.id for f in combo) in avoid_fact_sets:
            score -= 2.0
        score += rng.random() * 0.15
        if best is None or score > best.score:
            best = Candidate(tuple(ordered), score, m)
    return best


def _texts_for(facts: list[Fact], seed: int) -> list[str]:
    """Pick wording for each clue, avoiding two clues that open the same way ("In 1998, ...")."""
    out: list[str] = []
    for f in facts:
        text = _pick_text(f, seed)

        def clashes(t: str) -> int:
            o = " ".join(t.split()[:2]).lower()
            # "I won ..." repeating is natural; a repeated "In 1998, ..." is not, so it counts double.
            return sum((2 if o.startswith("in ") else 1) for prev in out if " ".join(prev.split()[:2]).lower() == o)

        if clashes(text):
            text = min(f.texts, key=lambda t: (clashes(t), t != text))
        out.append(text)
    return out


def _pick_text(f: Fact, seed: int) -> str:
    h = int(hashlib.sha1(f"{seed}|{f.id}".encode()).hexdigest(), 16)
    return f.texts[h % len(f.texts)]


def answer_for(p: Player) -> AnswerSpec:
    clubs = pstore.load_clubs()
    name = pstore.display_name(p.name)
    if p.primary_club:
        subtitle = f"{p.country} · {p.primary_club} {'legend' if p.retired else 'star'}"
    elif p.position:
        subtitle = f"{p.country} · {'Legendary ' if p.retired else ''}{POSITION_WORD[p.position].title()}"
    else:
        subtitle = p.country
    return AnswerSpec(
        title=name.upper(),
        spoken=p.spoken_name or name,
        subtitle=subtitle,
        flagCode=p.country_code,
        imageSrc=p.image_path,
        club=pstore.club_badge(p.primary_club, clubs) if p.primary_club else None,
        jerseyNumber=p.jersey_number,
    )


INTROS = ["Guess the player!", "Who am I?", "Can you guess this player?", "Guess who!"]


def fingerprint(fmt: str, player_ids: list[str], fact_ids: list[str]) -> str:
    return hashlib.sha1(f"{fmt}|{','.join(sorted(player_ids))}|{','.join(sorted(fact_ids))}".encode()).hexdigest()[:16]


DEFAULT_CLUES = 5


def seconds_for_clues(n: int) -> float:
    """Default video length: ~3 s per clue plus countdown, reveal and outro (4 clues = 20 s)."""
    return 11.0 + 3.0 * (n - 1)


class TriviaError(ValueError):
    pass


def generate_guess_player(
    p: Player,
    *,
    difficulty: Difficulty = "medium",
    duration: float | None = None,
    n_clues: int = DEFAULT_CLUES,
    seed: int | None = None,
    avoid_fact_sets: set[frozenset[str]] | None = None,
    pool: list[Player] | None = None,
) -> Question:
    """Build a Guess-the-Player question. `avoid_fact_sets` = clue sets already used.

    Uses `n_clues` clues when the player has enough distinctive facts, otherwise fewer (min 3).
    `duration` defaults to a length that fits the clue count (see seconds_for_clues)."""
    pool = pool if pool is not None else pstore.load_players()
    seed = seed if seed is not None else random.randint(0, 10**6)
    avoid_sets = avoid_fact_sets or set()
    cand = None
    for n in range(max(3, n_clues), 2, -1):
        cand = choose_clues(p, pool, difficulty, n, seed, avoid_sets)
        if cand is not None:
            break
    if cand is None:
        raise TriviaError(
            f"Not enough distinctive facts to make an unambiguous question about {p.name}. "
            "Add career clubs, a primary club or verified achievements in the player editor."
        )
    clues = [Clue(text=t, visual=f.visual, fact=f.id, source=f.source) for f, t in zip(cand.facts, _texts_for(list(cand.facts), seed))]
    fp = fingerprint("guess_player", [p.id], [f.id for f in cand.facts])
    q = Question(
        id=f"{p.id}-{fp[:6]}",
        format="guess_player",
        difficulty=difficulty,
        playerId=p.id,
        playerIds=[p.id],
        title="GUESS THE PLAYER",
        introSpeech=INTROS[seed % len(INTROS)],
        clues=clues,
        answer=answer_for(p),
        durationSeconds=duration if duration is not None else seconds_for_clues(len(clues)),
        fingerprint=fp,
    )
    q.warnings = validate_question(q, pool)
    return q


# ------------------------------------------------------------ clue icon from text

# Nicknames people type for clubs -> the club's name in clubs.json.
CLUB_ALIASES = {
    "Man United": "Manchester United", "Man Utd": "Manchester United", "Man City": "Manchester City",
    "Barca": "Barcelona", "Paris Saint-Germain": "PSG", "Paris Saint Germain": "PSG", "Inter": "Inter Milan",
    "Milan": "AC Milan", "Bayern": "Bayern Munich", "Spurs": "Tottenham Hotspur", "Tottenham": "Tottenham Hotspur",
    "Atletico": "Atlético Madrid", "Dortmund": "Borussia Dortmund", "Porto": "FC Porto", "Wolves": "Wolverhampton Wanderers",
    "Leverkusen": "Bayer Leverkusen", "Salzburg": "RB Salzburg", "Leipzig": "RB Leipzig", "Schalke": "Schalke 04",
    "West Ham": "West Ham United", "Leeds": "Leeds United", "Boca": "Boca Juniors", "Galaxy": "LA Galaxy",
}
DEMONYMS = {
    "Argentine": "Argentina", "Argentinian": "Argentina", "Belgian": "Belgium", "Brazilian": "Brazil", "Canadian": "Canada",
    "Colombian": "Colombia", "Croatian": "Croatia", "Czech": "Czechia", "Egyptian": "Egypt", "English": "England",
    "French": "France", "German": "Germany", "Hungarian": "Hungary", "Italian": "Italy", "Mexican": "Mexico",
    "Moroccan": "Morocco", "Dutch": "Netherlands", "Norwegian": "Norway", "Polish": "Poland", "Portuguese": "Portugal",
    "Senegalese": "Senegal", "Korean": "South Korea", "Soviet": "Soviet Union", "Spanish": "Spain", "Swedish": "Sweden",
    "American": "United States", "USA": "United States", "Uruguayan": "Uruguay", "Holland": "Netherlands",
}
# (pattern on lower-cased, accent-free text, icon) — checked in order, before clubs.
_AWARD_ICONS = [
    (r"ballon d ?or", "ballon"),
    (r"world cup", "cup"),
    (r"champions league|european cup|\beuros?\b|copa america|gold cup|africa cup|asian cup", "trophy"),
    (r"golden boot|top scorer", "boot"),
    (r"golden glove", "gloves"),
]
# Checked after clubs and countries (a club/country is the more specific picture).
_LATE_ICONS = [
    (r"la liga|serie a|bundesliga|premier league|ligue 1|copa|nations league|\bleague\b|\btitles?\b|trophy|trophies|\bcups?\b", "trophy"),
    (r"goalkeeper|keeper|clean sheet|saves?\b", "gloves"),
    (r"defender|defend|tackl", "whistle"),
    (r"midfield", "shirt"),
    (r"striker|forward|winger|goals?\b|scor", "boot"),
    (r"\bborn\b|birthday|years old|\d0s\b", "cake"),
    (r"shirt|jersey|number", "shirt"),
    (r"captain|legend|record|best|famous", "star"),
]


def _fold(s: str) -> str:
    """Strip accents but keep case: 'Atlético' -> 'Atletico'."""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def visual_for_text(text: str, pool: list[Player] | None = None, clubs: dict | None = None):
    """Best icon/badge/flag for a hand-written clue, or None if nothing in the text suggests one."""
    pool = pool if pool is not None else pstore.load_players()
    clubs = clubs if clubs is not None else pstore.load_clubs()
    low = _norm(text)
    for pat, icon in _AWARD_ICONS:
        if re.search(pat, low):
            return IconVisual(icon=icon)

    folded = _fold(text)

    def find(names: dict[str, str]):
        # Longest first so "Inter Miami" wins over "Inter"; proper nouns, so match case.
        hits = [(folded.find(_fold(k)), -len(k), names[k]) for k in names if re.search(rf"(?<![A-Za-z]){re.escape(_fold(k))}(?![A-Za-z])", folded)]
        return min(hits)[2] if hits else None

    club_names = {c: c for c in clubs} | {c: c for p in pool for c in p.career_clubs}
    club = find(club_names | {k: v for k, v in CLUB_ALIASES.items() if v in club_names})
    if club:
        return ClubVisual(club=pstore.club_badge(club, clubs))
    codes = {p.country: p.country_code for p in pool}
    country = find({c: c for c in codes} | {k: v for k, v in DEMONYMS.items() if v in codes})
    if country:
        return FlagVisual(code=codes[country])
    for pat, icon in _LATE_ICONS:
        if re.search(pat, low):
            return IconVisual(icon=icon)
    return None


def visual_options(player_ids: list[str], pool: list[Player] | None = None) -> list[dict]:
    """Choices for the studio's icon picker: these players' flags and clubs, then every icon."""
    pool = pool if pool is not None else pstore.load_players()
    clubs = pstore.load_clubs()
    chosen = [p for p in pool if p.id in player_ids]
    out: list[dict] = [{"label": "No icon", "visual": NoVisual()}]
    for cc, country in dict.fromkeys((p.country_code, p.country) for p in chosen):
        out.append({"label": f"Flag: {country}", "visual": FlagVisual(code=cc)})
    for club in dict.fromkeys(c for p in chosen for c in p.career_clubs):
        out.append({"label": f"Club: {club}", "visual": ClubVisual(club=pstore.club_badge(club, clubs))})
    labels = {"ballon": "Ballon d'Or", "cup": "World Cup", "trophy": "Trophy", "boot": "Boot", "gloves": "Gloves",
              "shirt": "Shirt", "cake": "Birthday cake", "star": "Star", "whistle": "Whistle"}
    out += [{"label": f"Icon: {v}", "visual": IconVisual(icon=k)} for k, v in labels.items()]
    return [{"label": o["label"], "visual": o["visual"].model_dump(by_alias=True, mode="json")} for o in out]


def swap_clue(q: Question, index: int, *, seed: int | None = None, avoid: list[str] | None = None, pool: list[Player] | None = None) -> Question:
    """Replace clue `index` with a different true fact, keeping the other clues as they are.

    The new set must still point to exactly one player. Prefers a fact about as easy as the one it
    replaces (so the clue order still runs vague -> give-away), with some randomness so repeated
    swaps offer different options. `avoid` = fact ids already tried for this slot.
    """
    if q.format != "guess_player":
        raise TriviaError("Swapping a single clue is available for Guess the Player videos.")
    if not 0 <= index < len(q.clues):
        raise TriviaError(f"There is no clue {index + 1}.")
    pool = pool if pool is not None else pstore.load_players()
    p = next((x for x in pool if x.id == q.player_id), None)
    if p is None:
        raise TriviaError("This question isn't linked to a player in the database.")
    facts = {f.id: f for f in build_facts(p, pstore.load_clubs())}
    for f in facts.values():
        f.matches = sum(1 for x in pool if f.test(x))
    _mark_minor_clubs(list(facts.values()))
    keep = [facts[c.fact] for i, c in enumerate(q.clues) if i != index and c.fact in facts]
    kept_ids = {f.id for f in keep}
    current = facts.get(q.clues[index].fact or "")
    skip = kept_ids | set(avoid or []) | ({current.id} if current else set())
    custom_kept = sum(1 for i, c in enumerate(q.clues) if i != index and c.fact not in facts)

    options = []
    for f in facts.values():
        if f.id in skip:
            continue
        combo = tuple(keep + [f])
        if not _combo_ok(combo):
            continue
        # Custom (hand-written) clues can't be checked, so only demand uniqueness from the known facts.
        if custom_kept == 0 and _matches(combo, pool) != [p.id]:
            continue
        options.append(f)
    if not options and avoid:
        return swap_clue(q, index, seed=seed, avoid=None, pool=pool)  # tried them all: start over
    if not options:
        raise TriviaError("No other clue keeps the answer unambiguous. Try swapping a different clue, or edit it by hand.")

    target = current.fame if current else DIFFICULTY_TARGET[q.difficulty]
    options.sort(key=lambda f: (f.supporting, abs(f.fame - target)))
    rng = random.Random(seed)
    new = rng.choice(options[: min(3, len(options))])
    text_seed = rng.randint(0, 10**6)

    out = q.model_copy(deep=True)
    out.clues[index] = Clue(text=_pick_text(new, text_seed), visual=new.visual, fact=new.id, source=new.source)
    fact_ids = [c.fact for c in out.clues if c.fact]
    out.fingerprint = fingerprint("guess_player", [p.id], fact_ids)
    out.warnings = validate_question(out, pool)
    return out


# ------------------------------------------------------------------------ validation


def _answer_tokens(q: Question, pool_by_id: dict[str, Player]) -> set[str]:
    toks: set[str] = set()
    names = [q.answer.title]
    if q.answer.spoken:
        names.append(q.answer.spoken)
    for pid in q.player_ids or ([q.player_id] if q.player_id else []):
        if pid in pool_by_id:
            names.append(pool_by_id[pid].name)
    for n in names:
        toks |= {t for t in _norm(n).split() if len(t) >= 4}
    return toks


def validate_question(q: Question, pool: list[Player] | None = None) -> list[str]:
    """Return human-readable problems. Empty list = OK to render."""
    pool = pool if pool is not None else pstore.load_players()
    by_id = {x.id: x for x in pool}
    warnings: list[str] = []
    if q.format in ("guess_player", "career_path", "guess_club"):
        tokens = _answer_tokens(q, by_id) if q.format != "guess_club" else {t for t in _norm(q.answer.title).split() if len(t) >= 4}
        for i, c in enumerate(q.clues):
            words = set(_norm(f"{c.text} {c.speech or ''}").split())
            leak = tokens & words
            if leak:
                warnings.append(f"Clue {i + 1} gives away the answer ({', '.join(sorted(leak))}).")
        texts = [_norm(c.text) for c in q.clues]
        if len(set(texts)) != len(texts):
            warnings.append("Two clues are identical.")
        if q.question and tokens & set(_norm(q.question).split()):
            warnings.append("The question text gives away the answer.")
    for i, c in enumerate(q.clues):
        if len(c.text) > 60:
            warnings.append(f"Clue {i + 1} is long ({len(c.text)} chars); it may be hard to read on a phone.")
        if not c.fact:
            warnings.append(f"Clue {i + 1} is a custom clue — double-check it is true before publishing.")
    p = by_id.get(q.player_id or "")
    if p and q.format == "guess_player":
        facts = {f.id: f for f in build_facts(p, pstore.load_clubs())}
        known = [c.fact for c in q.clues if c.fact]
        stale = [fid for fid in known if fid not in facts]
        if stale:
            warnings.append(f"These clues no longer match the player data: {', '.join(stale)}.")
        usable = tuple(facts[fid] for fid in known if fid in facts)
        if usable and len(usable) == len(q.clues):
            m = _matches(usable, pool)
            if m != [p.id]:
                others = [by_id[x].name for x in m if x != p.id][:3]
                warnings.append(f"Clues also fit: {', '.join(others)}. Make them more specific.")
    return warnings
