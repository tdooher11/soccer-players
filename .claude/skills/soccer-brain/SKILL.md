---
name: soccer-brain
description: Make Soccer Brain trivia Shorts (Guess the Player, Career Path, Who Won More, Guess the Club, True or False) by driving the soccer-brain app's CLI. Use for requests like "create a Ronaldo trivia video", "make five videos with Brazilian players", "easy Short for younger fans", "career-path question about Zlatan", "regenerate yesterday's videos with slower narration", or "which players haven't been used".
---

# Soccer Brain

The app lives in `soccer-brain/`. **Always go through `./soccer-brain …` (run from that folder)** —
never hand-build Remotion props or call Remotion directly; the CLI owns TTS, timing, validation,
history and metadata.

First time in a fresh checkout: `./soccer-brain setup` (models, audio assets, player import).
See `soccer-brain/README.md` for install steps.

## Map requests to commands

| Request | Command |
|---|---|
| "Ronaldo trivia video" | `./soccer-brain render --player "cristiano ronaldo"` |
| "only 4 clues" | add `--clues 4` (3–5; default 5; players with few facts may get fewer) |
| "easy one for younger fans" | add `--difficulty easy` (and optionally `--text-scale 1.15 --speed 0.9`) |
| "career-path question about Zlatan" | `./soccer-brain render --format career_path --player zlatan` |
| "Messi vs Ronaldo, who won more" | `./soccer-brain render --format who_won_more --player messi --player "cristiano ronaldo" --stat ballon_dor` |
| "guess the club, Arsenal" | `./soccer-brain render --format guess_club --club Arsenal` |
| "true or false: Cucurella at Real Madrid" | `./soccer-brain render --format true_false --player cucurella --statement "Real Madrid"` |
| "five videos, Brazilian players" | `./soccer-brain batch --count 5 --country Brazil` |
| "players not used yet" | `./soccer-brain players --unused` |
| "what did we make?" | `./soccer-brain history` |
| "slower narration" | `--speed 0.9` (1.0 = normal) |
| failed batch items | `./soccer-brain retry --batch <id>` |

Player names are fuzzy-matched; if the CLI says a name is ambiguous, pick an id from its list.

## Regenerating earlier videos with new settings

Each output folder (`output/<date>/<player>/`) holds `question.json`. To redo one with different
settings, re-render the saved question:

```bash
./soccer-brain render --question output/2026-10-14/ronaldinho/question.json --speed 0.9
```

For "yesterday's videos", list folders under `output/<yesterday's date>/` and loop over them.

## Editing clues before rendering

```bash
./soccer-brain question --player neymar --out /tmp/q.json   # edit the clues in the JSON
./soccer-brain render --question /tmp/q.json
```

To replace just one clue with a different true fact (others unchanged):
`./soccer-brain swap --question /tmp/q.json --clue 3` (Guess the Player only; run again for another option).

Clues without a `fact` id are "custom" and get a warning — only write clues you are sure are true.

## After rendering — always report

1. The video path and the suggested title from `metadata.json`.
2. Any warnings the CLI printed (ambiguous clues, unverified facts, missing photo credit).
3. Run `./soccer-brain qa <output folder>` and report pass/fail. Don't claim visual quality you
   haven't looked at; the QA contact sheet is `qa/contact-sheet.jpg`.

Never publish anything — the owner reviews videos before uploading.
