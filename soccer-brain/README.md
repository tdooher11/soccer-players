# Soccer Brain Studio ⚽🧠

Makes soccer-trivia **YouTube Shorts / TikTok / Reels** (1080×1920, 30 fps, H.264 + AAC) from the
curated player list in this repo — locally, with **no paid services and no AI video generation**.

Every video is drawn by code (Remotion + React), narrated by a free local voice, scored with music
and sound effects that were synthesized from scratch, and checked automatically before you publish.

| Format | Example |
|---|---|
| **Guess the Player** | 🇧🇷 Brazil → PSG → Barcelona legend → 2005 Ballon d'Or → 3‑2‑1 → **RONALDINHO!** |
| **Career Path** | Sporting CP → Man United → Real Madrid → Juventus → Al‑Nassr → **CRISTIANO RONALDO** |
| **Who Won More?** | Ballon d'Or: Messi **8** vs Ronaldo **5** |
| **Guess the Club** | Saka · Henry · Martínez → **ARSENAL** |
| **True or False** | Did Cucurella ever play for Real Madrid? → **FALSE** |

---

## 1. Install (once)

Needs **Node 18+**, **Python 3.11+**, **FFmpeg**, and a Chrome/Chromium (Remotion downloads its own
headless Chrome automatically if none is found).

```bash
cd soccer-brain
npm install
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./soccer-brain setup      # downloads the free voices (~650 MB), builds music/SFX, imports players
```

`setup` = `scripts/setup_models.sh` + `./soccer-brain assets` + `./soccer-brain import`.

Optional: `.venv/bin/pip install faster-whisper` enables the "is the answer spoken too early?" QA check.
Optional: `cp .env.example .env` to change the channel name, default voice, or add paid TTS keys.

## 2. Start the browser studio

```bash
./soccer-brain studio          # → http://localhost:8000
```

- **Dashboard** – counts, recent videos, one-click **batch** generation.
- **Create video** – pick a format + player, generate clues, edit any clue or what the narrator says,
  hear each line (▶), change theme / text size / voice / speed / music, and watch the **live preview**
  (play, pause, scrub, jump to any scene). Visual tweaks apply instantly; text and voice changes
  re-synthesize narration in a second or two. Then **Render MP4**.
- **Players** – searchable table, filter by country/club/active/position, edit or add players,
  confirm a player's current club.
- **Videos** – every render with thumbnail, inline playback, download, metadata, "open in editor",
  and retry for failures.

For frame-by-frame timeline inspection there's also Remotion Studio:
`./soccer-brain remotion --project output/2026-10-14/ronaldinho`.

## 3. Make videos from the command line

```bash
./soccer-brain render --player ronaldinho                       # auto clues, medium difficulty
./soccer-brain render --player "kylian mbappe" --difficulty easy --speed 0.9 --text-scale 1.15
./soccer-brain render --question questions/ronaldinho-sample.json   # a hand-written / edited question

./soccer-brain question --player neymar --out my-q.json         # generate → edit the JSON → render it
./soccer-brain render --question my-q.json

./soccer-brain render --format career_path  --player zlatan
./soccer-brain render --format who_won_more --player messi --player "cristiano ronaldo" --stat ballon_dor
./soccer-brain render --format guess_club   --club Arsenal
./soccer-brain render --format true_false   --player cucurella --statement "Real Madrid"
```

Useful flags: `--theme stadium-gold|electric-blue|night-match`, `--voice am_michael`,
`--provider kokoro|piper|openai|elevenlabs|google`, `--no-narration`, `--no-music`, `--no-image`,
`--duration 20`, `--seed 42` (reproducible clue choice).

## 4. Batch rendering

```bash
./soccer-brain batch --count 5                       # 5 players not used in the last 30 days
./soccer-brain batch --count 5 --country Brazil --difficulty easy
./soccer-brain batch --count 3 --retired --format career_path
./soccer-brain batch --count 5 --dry-run             # questions + narration only, no rendering
./soccer-brain retry --batch b-20261014-222520       # re-render only the failed ones
./soccer-brain players --unused                      # who hasn't been featured yet
./soccer-brain history
```

A failing render never stops the batch; it's recorded as `failed` with the error and can be retried
without touching the successful ones.

### Output

```
output/2026-10-14/ronaldinho/
  video.mp4          final Short (loudness-normalised to ≈ −14 LUFS)
  thumbnail.png      preview frame (taken before the reveal)
  metadata.json      suggested title (no spoilers), description, hashtags, photo credit, warnings
  question.json      the exact question — re-render it any time
  project.json       settings + resolved timeline (for retry / Remotion Studio)
  qa/                written by `soccer-brain qa`: per-scene frames, contact sheet, report
```

Nothing is ever uploaded. Review `metadata.json` → `needsAttention` before publishing.

## 5. Quality checks

```bash
./soccer-brain qa output/2026-10-14/ronaldinho
```

Checks codec/size/fps/duration against the timeline, loudness, that the answer isn't in any
pre-reveal text, title or image filename, and (with faster-whisper) transcribes the audio to prove the
answer isn't *spoken* before the reveal and is audible after it. It also writes one frame per scene
and a contact sheet for a human look.

Tests: `.venv/bin/python -m pytest` (fast suite) and `.venv/bin/python -m pytest -m slow` (real render).

---

## How it works

```
players.json (site master list)          data/verified-facts.json (sourced extras)
            │  ./soccer-brain import  (provenance per field; never overwrites your edits)
            ▼
     data/players.json ──► trivia engine ──► Question (clues + fact ids + answer)
                                               │   validate: unique answer, no leaks, facts still true
                                               ▼
                      timeline.py: TTS each line → measure → size scenes → VideoProps
                                               │
            Remotion Player (studio preview) ◄─┴─► scripts/render.mjs (MP4 + thumbnail)
                                                         │
                                       loudnorm → output/… + metadata + history
```

- **One renderer, one data path.** The CLI, the studio and batch all call `backend/production.py`,
  which calls `scripts/render.mjs`. The browser preview uses the very same React composition
  (`src/remotion/QuizVideo.tsx`).
- **Timing comes from the narration.** Each narrated line is synthesized first, measured, and the
  scene stretched so speech is never cut. Spare time is trimmed back toward the target; if it's still
  long, speech is sped up slightly (max +12 %), and only then is the video extended (with a warning).
- **Formats are panels.** Background, header, mystery card, countdown, reveal, confetti, outro and
  audio are shared; each format adds a question panel (`src/remotion/formats/`) and a generator
  (`backend/trivia.py`, `backend/formats.py`).

### Facts and safety rules

- Clues are generated only from structured facts, each tagged with a `fact` id and source.
- Every Guess-the-Player clue set is checked against the **whole database**: exactly one player may
  match. Clues are ordered vague → give-away.
- Facts not in the master list (e.g. Ballon d'Or **years**) live in `data/verified-facts.json` with a
  source URL and date, and are applied only when they agree with the curated counts.
- **Current club is never used as a clue unless confirmed** in the Players page within the last 120
  days ("✓ confirm it's correct today"). Historical "played for" clues are used instead.
- Hand-written clues are allowed but flagged "custom — check it's true".
- True/False "FALSE" questions carry a warning: career lists omit youth teams and short loans.
- Edits you make in the studio are stored with `manual` provenance; re-importing the master list
  never overwrites them and reports a conflict instead.

### Narration

| Provider | Cost | Notes |
|---|---|---|
| `kokoro` (default) | free, local | Kokoro‑82M (Apache‑2.0). Voices `am_michael` (default), `am_puck`, `bm_george`, … |
| `piper` | free, local | Lighter/faster, more robotic. |
| `openai` / `elevenlabs` / `google` | paid | Only if you set the key **and** choose it. The studio shows an estimate first. |

Clips are cached by content hash in `public/tts/`, so re-rendering costs nothing. Tricky names are
fixed in `data/pronunciations.json` (spoken text only — the screen always shows the real spelling),
or per player with "Spoken name" in the Players editor.

### Assets & licences

- **Fonts:** Montserrat and Nunito (SIL OFL), self-hosted in `public/fonts/`.
- **Flags:** from flagcdn (public domain), copied from the site's `assets/flags/`.
- **Music & SFX:** generated by `backend/sfx.py` from math — original, royalty-free.
- **Player photos:** Wikimedia Commons images already used by the site. Credits are looked up via
  the Commons API into `data/image-credits.json` and put in each video's description; when a credit
  is unknown, `metadata.json` says "CREDIT NEEDED". No photo? The reveal shows a jersey in the
  player's club colours instead.
- **Club badges:** never real crests — a generic shield in club colours with letters.
- **Remotion** is free for individuals and companies of up to 3 people; larger companies need a
  [Remotion company licence](https://www.remotion.dev/license).

## Known limitations

- Ambiguity is checked against *your* database (107 players), not every footballer who ever lived.
  The engine prefers specific facts, but a human glance at the clues is still worthwhile.
- Award **years** are only known where `data/verified-facts.json` has them (currently Ballon d'Or).
  Other clues use counts from the master list ("won the World Cup twice").
- Career lists are "main clubs"; Career Path videos say "major clubs", and False answers are flagged.
- A render takes ~1.5–2 min per 18 s video on a 4-core machine (CPU only).
- Some Commons photos/credits may fail to download if Wikimedia rate-limits you; re-run
  `./soccer-brain import` later (it only fetches what's missing).

## Project layout

```
backend/          Python: config, models, players (import/store), trivia, formats, tts, timeline,
                  production (orchestration), rendering, metadata, qa, sfx, cli, main (FastAPI)
src/remotion/     Remotion compositions: QuizVideo.tsx, components/, formats/, theme.ts, fonts.ts
src/app/          Studio UI (Vite + React + @remotion/player)
src/shared/       types.ts — the props contract shared by Python and TypeScript
scripts/          render.mjs (the renderer), stills.mjs (QA stills), setup_models.sh
data/             players.json, verified-facts.json, pronunciations.json, clubs.json, image-credits.json
public/           fonts, flags, img (hash-named photos), audio (music + sfx), tts (cache)
questions/        hand-written example questions
tests/            pytest suite
```
