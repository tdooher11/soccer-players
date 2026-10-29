# Soccer Brain Studio — guide for Claude

Trivia-Shorts generator built on the site's `../players.json`. Read `README.md` for usage.

## Rules
- **One code path.** CLI, studio API and batch all go through `backend/production.py` →
  `scripts/render.mjs`. Never add a second renderer or compute timing outside `backend/timeline.py`.
- **Props contract:** `src/shared/types.ts` ⇄ `backend/models.py::VideoProps`. Change both together.
- **Never leak the answer before the reveal:** no names in clues/titles/filenames; the answer object is
  only passed to components from the reveal frame on. Images are hash-named (`players.image_rel_path`).
  (Exception, by request: the studio's *Download MP4* names the file after the player —
  `store.download_name`, served by `/api/history/{id}/download`.)
- **Facts need provenance.** New facts go in `data/verified-facts.json` with `sourceUrl` + `verifiedAt`.
  Don't invent trophies/years. Unconfirmed current clubs are never clues.
- **No licensed media:** no real crests, broadcast footage, or copyrighted music. Music/SFX come from
  `backend/sfx.py`.
- New format = generator in `backend/formats.py` + panel in `src/remotion/formats/Panels.tsx` +
  entries in `FORMAT_PANELS` / `FORMAT_LAYOUT`.

## Verify before committing
```bash
npx tsc -p .                          # types
.venv/bin/python -m pytest            # fast tests (~30 s)
./soccer-brain render --player ronaldinho && ./soccer-brain qa output/<date>/ronaldinho
```
For layout changes render stills and *look* at them:
`node scripts/stills.mjs <props.json> /tmp/out 40 300 470` (props: an output's `project.json` → `props`).
Never commit `node_modules/`, `.venv/`, `models/`, `output/`, `public/tts/`.
