# Soccer Players — project guide

A kid-friendly soccer web app (static site, GitHub Pages) built for a five‑year‑old.
Everything is graphical: player cards with photos, club crests, country flags, and
countable trophy icons. **Keep it simple, colorful, and accurate.**

Live site: https://tdooher11.github.io/soccer-players/

## Pages
- `index.html` — the player cards (the home page).
- `fifa.html` — "Which Team?" — which club each player is in across FIFA 18 / EA FC 24 / EA FC 26.
- `trophies.html` — "Roll of Honour" — competition winners by year (`honours.js`).
- `matches.html` — "Upcoming Matches" — live fixtures + who's playing, for our players' teams.
- `worldcup.html` — 2026 World Cup scores/schedule.

## Single source of truth
- **`players.json` is canonical.** All player data lives here.
- **`players.md` is generated — never hand‑edit it.** Regenerate with `node build-md.js`
  after any change to `players.json`.

## Player schema (`players.json`)
```jsonc
{
  "name": "David De Gea",
  "country": "Spain", "countryCode": "ES",   // countryCode drives the flag + the "continental" trophy label
  "currentClub": "Fiorentina",               // or "Retired"
  "jerseyNumber": 43,
  "rarity": "gold",
  "clubs": ["Atlético Madrid", "Manchester United", "Fiorentina"],
  "dob": "1990-11-07",
  "died": "2003-08-26",                       // optional; card shows "🕊️ 1951–2003 · aged N"
  "pos": "GK",                                // GK | DEF | MID | FWD  (FWD renders as "Striker")
  "honors": { "wc": 0, "cl": 0, "bo": 0, "co": 0 }, // World Cup, Champions League, Ballon d'Or, Continental (Euros/Copa/Gold Cup by countryCode)
  "stats": { "pace": 57, "shooting": 21, "passing": 72, "dribbling": 64, "defending": 24, "physical": 80 },
  "funFact": "One kid-friendly sentence.",
  "imageUrl": "assets/players/david-de-gea.jpg", // "" for no photo → card shows a club-colored placeholder
  "fotmobUrl": "https://www.fotmob.com/search?term=David%20De%20Gea"
}
```

## Assets — always self‑hosted, always freely‑licensed
- **Photos:** `assets/players/<slug>.jpg`. Source from **Wikimedia Commons** via
  `https://commons.wikimedia.org/wiki/Special:FilePath/<Filename>?width=400`.
  Do **not** vendor non‑free images (files hosted on `en.wikipedia.org` rather than Commons
  are usually non‑free — skip them and use the placeholder, or ask the owner for an image).
- **Flags:** `assets/flags/<cc>.png` (lowercased code) from `https://flagcdn.com/w160/<cc>.png`.
  New country ⇒ add the flag file **and** add the code to `FLAG_EMOJI` in `players.js`.
- **Crests:** two maps in `players.js` — `CLUBS` (colored fallback badge) and `CLUB_ESPN`
  (real logo by ESPN team id). New club ⇒ add to **both**.

## FIFA / EA FC placement (`fifa-teams.js`)
- **Active player:** add to `FC_TEAMS` with the real club per edition
  (`{ e18, e24, e26 }`); use `null` if they weren't in that game yet (too young).
- **Retired player:** set the edition value to `"LEGEND"` **and** place them in a
  `SPECIAL_TEAMS` bucket for that edition (Icons / a Classic XI / "Not in this game").
  A `"LEGEND"` with no special‑team entry shows up **nowhere** — don't forget this step.
- **Pre‑FIFA legends** (retired before the game existed, or not yet a FUT Icon that year):
  put them in **"Not in this game"** for that edition. If you leave a player out of
  `FC_TEAMS` entirely they wrongly fall into "Too young for this game!" — so always add an entry.

## Matches page data (`team-ids.json`, `team-badges.json`)
- If you add a player whose **current club is new**, add that club to:
  - `team-ids.json` — club → TheSportsDB team id (verify the id is the *right* club).
  - `team-badges.json` — club → correct crest URL (used to fix TheSportsDB's occasionally
    swapped home/away badge fields).
- Retired players / `"Retired"` clubs are skipped on this page (no fixtures).

## Verifying changes — ALWAYS over HTTP, never file://
The site fetches `players.json` at runtime, and `fetch()` is blocked on `file://`. So:
```bash
python3 -m http.server 8099    # then open http://localhost:8099/
```
For headless checks (recommended before every commit) use Playwright with the
pre‑installed Chromium:
```bash
npm install playwright --no-save
NODE_PATH="$PWD/node_modules" node script.js   # chromium: executablePath:'/opt/pw-browsers/chromium'
```
Confirm: the card renders, the **photo actually loads** (`img.naturalWidth > 0`), flags/crests
resolve, and (for FIFA changes) the player lands in the right bucket. Remove `node_modules`
before committing — it should never be committed.

## Git discipline
- Work on a **feature branch**, never commit straight to `main`. One PR per change.
- After editing `players.json`, run `node build-md.js` and commit `players.md` too.
- Verify headless over HTTP **before** committing.
- Squash‑merge PRs.
