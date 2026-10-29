"""Suggested YouTube Shorts metadata. Titles never reveal a mystery answer."""

from __future__ import annotations

import hashlib

from .models import Player, Question

DEMONYM = {
    "Argentina": "Argentine", "Belgium": "Belgian", "Brazil": "Brazilian", "Bulgaria": "Bulgarian", "Canada": "Canadian",
    "Cape Verde": "Cape Verdean", "Colombia": "Colombian", "Croatia": "Croatian", "Czech Republic": "Czech", "Czechia": "Czech",
    "Denmark": "Danish", "Egypt": "Egyptian", "England": "English", "France": "French", "Germany": "German", "Greece": "Greek",
    "Hungary": "Hungarian", "Italy": "Italian", "Liberia": "Liberian", "Mexico": "Mexican", "Morocco": "Moroccan",
    "Netherlands": "Dutch", "Northern Ireland": "Northern Irish", "Norway": "Norwegian", "Poland": "Polish", "Portugal": "Portuguese",
    "Russia": "Russian", "Scotland": "Scottish", "Senegal": "Senegalese", "South Korea": "South Korean", "Soviet Union": "Soviet",
    "Spain": "Spanish", "Sweden": "Swedish", "Ukraine": "Ukrainian", "United States": "American", "USA": "American", "Uruguay": "Uruguayan",
}

POS = {"GK": "Goalkeeper", "DEF": "Defender", "MID": "Midfielder", "FWD": "Striker"}

BASE_TAGS = ["#soccer", "#football", "#soccertrivia", "#footballquiz", "#shorts", "#soccerbrain"]


def _pick(options: list[str], key: str) -> str:
    return options[int(hashlib.sha1(key.encode()).hexdigest(), 16) % len(options)]


def build(q: Question, players: dict[str, Player], *, video_file: str, duration: float, tts: dict | None = None, recent_titles: list[str] | None = None) -> dict:
    p = players.get(q.player_id or "")
    demonym = DEMONYM.get(p.country, p.country) if p else None
    kind = ("Legend" if p.retired else "Star") if p else "Player"
    pos = POS.get(p.position or "", "Player") if p else "Player"

    if q.format == "guess_player":
        titles = [
            f"Can You Guess This {demonym} Soccer {kind}? ⚽" if demonym else "Can You Guess This Soccer Player? ⚽",
            f"Guess the Player in {len(q.clues)} Clues! ⚽",
            f"Who Is This {demonym} {pos}? 🤔⚽" if demonym else "Who Is This Player? 🤔⚽",
            "Only Real Fans Get This One! Guess the Player ⚽",
        ]
        words = {3: "Three", 4: "Four", 5: "Five"}
        n = len(q.clues)
        hook = f"{words[n]} clues. One mystery player. Can you guess before the countdown ends?" if n in words else "Can you guess the player before the countdown ends?"
    elif q.format == "career_path":
        titles = ["Guess the Player From Their Career Path! ⚽", "Whose Career Is This? 🤔⚽", "Can You Name This Player From Their Clubs? ⚽"]
        hook = "Follow the clubs and name the player!"
    elif q.format == "who_won_more":
        titles = [f"{q.question} ⚽", "Who Won More? Most Fans Get This Wrong! ⚽"]
        hook = q.question or "Who won more?"
    elif q.format == "guess_club":
        titles = ["Guess the Club From These Players! ⚽", "Which Team Did They All Play For? 🤔⚽"]
        hook = "These players all share one club. Which one?"
    else:
        titles = [f"True or False? {q.question} ⚽" if q.question and len(q.question) < 70 else "True or False? Soccer Edition ⚽"]
        hook = q.question or "True or false?"
    fresh = [t for t in titles if t not in (recent_titles or [])] or titles
    title = _pick(fresh, q.id)

    tags = list(BASE_TAGS)
    if p:
        tags.append(f"#{p.country.replace(' ', '').lower()}")
    if q.format == "guess_player":
        tags.append("#guesstheplayer")

    credit_lines = []
    for pid in q.player_ids or ([q.player_id] if q.player_id else []):
        pl = players.get(pid)
        if pl and pl.image_path and q.answer.image_src:
            c = pl.image_credit
            if c and c.author:
                credit_lines.append(f"Photo: {c.author}, {c.license or 'see source'}, via Wikimedia Commons — {c.source_url or ''}".strip(" —"))
            else:
                credit_lines.append("Photo: Wikimedia Commons (CREDIT NEEDED — add author/licence before publishing)")
    description = "\n".join(
        [
            hook,
            "",
            "Pause the video if you need more time — and tell us in the comments how many clues you needed! 👇",
            "",
            "Soccer Brain: quick soccer trivia for fans of all ages.",
            "",
            *credit_lines,
            "Music & sound effects: original, made for Soccer Brain.",
            "",
            " ".join(tags),
        ]
    ).strip()
    meta = {
        "title": title,
        "titleOptions": titles,
        "description": description,
        "hashtags": tags,
        "playerIds": q.player_ids or ([q.player_id] if q.player_id else []),
        "questionId": q.id,
        "questionType": q.format,
        "difficulty": q.difficulty,
        "durationSeconds": round(duration, 2),
        "outputFilename": video_file,
        "narration": tts,
        "needsAttention": [line for line in credit_lines if "CREDIT NEEDED" in line] + q.warnings,
    }
    leaks = [w for w in ([q.answer.title] + ([q.answer.spoken] if q.answer.spoken else [])) if w and w.lower() in title.lower()]
    if q.format in ("guess_player", "career_path", "guess_club") and leaks:
        meta["needsAttention"].append("Title contains the answer.")
    return meta
