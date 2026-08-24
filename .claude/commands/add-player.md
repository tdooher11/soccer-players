---
description: Add a soccer player to the roster end-to-end (data, photo, crests, FIFA placement, verify, PR)
argument-hint: <player name>
---

Add **$ARGUMENTS** to the roster, following the project conventions in `CLAUDE.md`.

Do it in this order and don't skip the verification:

1. **Check** they're not already in `players.json`.
2. **Research** the facts you need: full name, nationality (+ `countryCode`), current club
   (or "Retired"), career clubs, date of birth (and death, if applicable), position
   (GK/DEF/MID/FWD), and honours counts (World Cup, Champions League, Ballon d'Or, and the
   continental title for their country). If anything is uncertain, verify it on the web —
   don't guess. Consider dispatching the `player-research` agent for this.
3. **Photo:** find a **freely-licensed Wikimedia Commons** image and vendor it to
   `assets/players/<slug>.jpg` via `Special:FilePath?width=400`. If only a non-free image
   exists, use `"imageUrl": ""` (the card shows a club-colored placeholder) and say so.
4. **Add the player object** to `players.json` (use a small node script that reads → pushes →
   writes, to keep formatting stable), then run `node build-md.js`.
5. **Crests / flag:** if a club or country is new, add it to the right maps
   (`CLUBS` + `CLUB_ESPN` in `players.js`; the flag file + `FLAG_EMOJI`). If the player's
   *current* club is new, also add it to `team-ids.json` and `team-badges.json`.
6. **FIFA placement** in `fifa-teams.js`: active → real clubs per edition; retired → `"LEGEND"`
   plus a `SPECIAL_TEAMS` bucket for each edition (pre-FIFA players go in "Not in this game").
7. **Verify headless over HTTP** (see `CLAUDE.md`): card renders, photo loads at full
   resolution, flag/crests resolve, and the FIFA bucket is correct. Remove `node_modules` after.
8. **Ship:** commit on the feature branch (include `players.md`), push, open a PR describing
   the card + FIFA placement + any new assets, and squash-merge.

Keep the `funFact` to one kid-friendly sentence.
