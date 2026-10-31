"""YouTube analytics: connect the channel, pull per-video numbers, and compare formats.

Read-only. Uses the YouTube Data API v3 (uploads, titles, comments) and the YouTube
Analytics API v2 (views, watch time, retention curve, daily views). Sign-in is the
standard Google "desktop app" OAuth flow with a loopback redirect to the studio, so
nothing runs anywhere but this computer.

Files (all in data/, all git-ignored — they hold your credentials and channel data):
  youtube-client.json  the OAuth client you create in Google Cloud (id + secret)
  youtube-token.json   the refresh token Google gives back after you sign in
  youtube.json         the last sync: videos, numbers, links to our renders
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import secrets
import statistics
import time
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode

import httpx

from . import players as pstore
from . import store
from .config import settings

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DATA_API = "https://www.googleapis.com/youtube/v3"
ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports"

# Totals per video. engagedViews (Shorts views that weren't an instant swipe-away)
# is newer; if the API refuses it we ask again without it.
TOTAL_METRICS = [
    "views",
    "engagedViews",
    "estimatedMinutesWatched",
    "averageViewDuration",
    "averageViewPercentage",
    "likes",
    "comments",
    "shares",
    "subscribersGained",
]
EARLY_DAYS = 2  # "views in the first 2 days" — a fair way to compare old and new videos
MIN_GROUP = 3  # don't draw conclusions from fewer videos than this per group
DEEP_LIMIT = 150  # newest uploads that get retention / daily views / comments (3 API calls each)

SCENE_LABEL = {"countdown": "Countdown", "reveal": "Reveal", "outro": "Comment ask"}


class YouTubeError(RuntimeError):
    pass


class NotConnected(YouTubeError):
    pass


# ----------------------------------------------------------------------------- files


def _path(name: str) -> Path:
    return settings.data_dir / name


def _load(name: str, default: Any) -> Any:
    p = _path(name)
    return json.loads(p.read_text()) if p.exists() else default


def _save(name: str, data: Any) -> None:
    p = _path(name)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    tmp.replace(p)


def load_data() -> dict:
    return _load("youtube.json", {"channel": None, "syncedAt": None, "videos": {}, "links": {}})


# ------------------------------------------------------------------------- client id


def save_client(raw: str | dict) -> dict:
    """Accept the JSON file Google Cloud gives you (or just id + secret)."""
    d = json.loads(raw) if isinstance(raw, str) else raw
    inner = d.get("installed") or d.get("web") or d
    cid, secret = inner.get("client_id") or inner.get("clientId"), inner.get("client_secret") or inner.get("clientSecret")
    if not cid or not secret:
        raise YouTubeError("That doesn't look like an OAuth client file — it needs client_id and client_secret.")
    if "web" in d:
        log.warning("This is a 'Web application' client; a 'Desktop app' client is simpler (any localhost port works).")
    client = {"client_id": cid.strip(), "client_secret": secret.strip()}
    _save("youtube-client.json", client)
    return client


def _client() -> dict:
    c = _load("youtube-client.json", None)
    if not c:
        raise NotConnected("YouTube isn't set up yet — add your Google OAuth client first (see README → YouTube analytics).")
    return c


# ----------------------------------------------------------------------------- OAuth

_pending: dict[str, tuple[str, str, float]] = {}  # state -> (code_verifier, redirect_uri, created)


def auth_url(redirect_uri: str) -> str:
    """Google sign-in URL. PKCE + state; the verifier stays in this process."""
    c = _client()
    state = secrets.token_urlsafe(16)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    now = time.time()
    for k in [k for k, v in _pending.items() if now - v[2] > 900]:
        _pending.pop(k, None)
    _pending[state] = (verifier, redirect_uri, now)
    q = {
        "client_id": c["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # always hand back a refresh token
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return f"{AUTH_URL}?{urlencode(q)}"


def finish_auth(code: str, state: str, *, http: httpx.Client | None = None) -> dict:
    if state not in _pending:
        raise YouTubeError("Sign-in expired or came from somewhere else — press Connect again.")
    verifier, redirect_uri, _ = _pending.pop(state)
    c = _client()
    r = (http or httpx.Client(timeout=30)).post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": c["client_id"],
            "client_secret": c["client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        },
    )
    if r.status_code != 200:
        raise YouTubeError(f"Google refused the sign-in: {r.text[:300]}")
    tok = r.json()
    if not tok.get("refresh_token"):
        raise YouTubeError("Google didn't return a refresh token — remove the app's access in your Google account and connect again.")
    tok["expires_at"] = time.time() + tok.get("expires_in", 3600) - 60
    _save("youtube-token.json", tok)
    return tok


def disconnect() -> None:
    _path("youtube-token.json").unlink(missing_ok=True)


def status() -> dict:
    d = load_data()
    return {
        "configured": _path("youtube-client.json").exists(),
        "connected": _path("youtube-token.json").exists(),
        "channel": d.get("channel"),
        "syncedAt": d.get("syncedAt"),
        "videos": len(d.get("videos", {})),
    }


class Api:
    """Thin authenticated GET wrapper. `http` is injectable for tests."""

    def __init__(self, http: httpx.Client | None = None):
        self.http = http or httpx.Client(timeout=30)
        self.calls = 0

    def _token(self) -> str:
        tok = _load("youtube-token.json", None)
        if not tok:
            raise NotConnected("Not connected to YouTube — press Connect in the Analytics tab.")
        if tok.get("expires_at", 0) > time.time() and tok.get("access_token"):
            return tok["access_token"]
        c = _client()
        r = self.http.post(
            TOKEN_URL,
            data={"client_id": c["client_id"], "client_secret": c["client_secret"], "refresh_token": tok["refresh_token"], "grant_type": "refresh_token"},
        )
        if r.status_code != 200:
            # invalid_grant: revoked, or (apps left in "Testing") expired after 7 days.
            raise NotConnected("YouTube sign-in has expired — press Connect again. " + r.text[:200])
        new = r.json()
        tok.update(access_token=new["access_token"], expires_at=time.time() + new.get("expires_in", 3600) - 60)
        _save("youtube-token.json", tok)
        return tok["access_token"]

    def get(self, url: str, params: dict) -> dict:
        self.calls += 1
        r = self.http.get(url, params=params, headers={"Authorization": f"Bearer {self._token()}"})
        if r.status_code == 401:
            raise NotConnected("YouTube sign-in was rejected — press Connect again.")
        if r.status_code >= 400:
            try:
                msg = r.json()["error"]["message"]
            except Exception:
                msg = r.text[:300]
            raise YouTubeError(f"{r.status_code}: {msg}")
        return r.json()


# ------------------------------------------------------------------------------ sync


def _iso_seconds(d: str) -> float:
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", d or "")
    if not m:
        return 0.0
    days, h, mi, s = (float(x or 0) for x in m.groups())
    return days * 86400 + h * 3600 + mi * 60 + s


def _rows(resp: dict) -> list[dict]:
    names = [h["name"] for h in resp.get("columnHeaders", [])]
    return [dict(zip(names, row)) for row in resp.get("rows", []) or []]


def _chunks(xs: list, n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def sync(*, api: Api | None = None, max_videos: int = 500, today: date | None = None, progress: Callable[[str], None] | None = None) -> dict:
    """Pull everything we need and save it to data/youtube.json. Returns a short summary."""
    api = api or Api()
    say = progress or (lambda m: log.info(m))
    today = today or date.today()
    data = load_data()

    ch = api.get(f"{DATA_API}/channels", {"part": "snippet,contentDetails,statistics", "mine": "true"})
    if not ch.get("items"):
        raise YouTubeError("This Google account has no YouTube channel.")
    c = ch["items"][0]
    data["channel"] = {
        "id": c["id"],
        "title": c["snippet"]["title"],
        "subscribers": int(c.get("statistics", {}).get("subscriberCount", 0) or 0),
    }
    uploads = c["contentDetails"]["relatedPlaylists"]["uploads"]

    say("Listing uploads…")
    ids: list[str] = []
    page = None
    while len(ids) < max_videos:
        r = api.get(f"{DATA_API}/playlistItems", {"part": "contentDetails", "playlistId": uploads, "maxResults": 50, **({"pageToken": page} if page else {})})
        ids += [it["contentDetails"]["videoId"] for it in r.get("items", [])]
        page = r.get("nextPageToken")
        if not page:
            break
    ids = ids[:max_videos]

    videos: dict[str, dict] = {}
    for batch in _chunks(ids, 50):
        try:
            r = api.get(f"{DATA_API}/videos", {"part": "snippet,contentDetails,statistics,status,fileDetails", "id": ",".join(batch)})
        except YouTubeError:  # fileDetails is owner-only; be tolerant
            r = api.get(f"{DATA_API}/videos", {"part": "snippet,contentDetails,statistics,status", "id": ",".join(batch)})
        for v in r.get("items", []):
            old = data["videos"].get(v["id"], {})
            st = v.get("statistics", {})
            videos[v["id"]] = {
                **old,
                "id": v["id"],
                "title": v["snippet"]["title"],
                "publishedAt": v["snippet"]["publishedAt"],
                "thumbnail": (v["snippet"].get("thumbnails", {}).get("medium") or v["snippet"].get("thumbnails", {}).get("default") or {}).get("url"),
                "durationSeconds": _iso_seconds(v["contentDetails"].get("duration", "")),
                "privacy": v.get("status", {}).get("privacyStatus"),
                "fileName": v.get("fileDetails", {}).get("fileName"),
                "public": {
                    "views": int(st.get("viewCount", 0) or 0),
                    "likes": int(st.get("likeCount", 0) or 0),
                    "comments": int(st.get("commentCount", 0) or 0),
                },
            }
    data["videos"] = videos

    data["links"] = auto_link(videos, data.get("links", {}))
    linked = [vid for vid in videos if data["links"].get(vid)]

    say(f"Fetching analytics for {len(videos)} videos…")
    if videos:
        start = min(v["publishedAt"][:10] for v in videos.values())
        metrics = list(TOTAL_METRICS)
        for batch in _chunks(list(videos), 200):
            params = {
                "ids": "channel==MINE",
                "startDate": start,
                "endDate": today.isoformat(),
                "dimensions": "video",
                "filters": "video==" + ",".join(batch),
                "maxResults": 200,
                "sort": "-views",
            }
            try:
                r = api.get(ANALYTICS_API, {**params, "metrics": ",".join(metrics)})
            except YouTubeError as e:
                if "engagedViews" not in metrics:
                    raise
                log.info("engagedViews not available (%s); retrying without it", e)
                metrics.remove("engagedViews")
                r = api.get(ANALYTICS_API, {**params, "metrics": ",".join(metrics)})
            for row in _rows(r):
                vid = row.pop("video")
                if vid in videos:
                    videos[vid]["analytics"] = row

    # Deeper numbers (retention, early views, comments) for every recent upload, not just the
    # matched ones, so linking a video by hand afterwards doesn't leave it without them.
    deep = sorted(videos, key=lambda k: videos[k]["publishedAt"], reverse=True)[:DEEP_LIMIT]
    for i, vid in enumerate(deep, 1):
        v = videos[vid]
        say(f"Retention, early views and comments {i}/{len(deep)}: {v['title']}")
        pub = date.fromisoformat(v["publishedAt"][:10])
        try:
            r = api.get(
                ANALYTICS_API,
                {
                    "ids": "channel==MINE",
                    "startDate": pub.isoformat(),
                    "endDate": today.isoformat(),
                    "dimensions": "elapsedVideoTimeRatio",
                    "metrics": "audienceWatchRatio",
                    "filters": f"video=={vid}",
                },
            )
            v["retention"] = [[float(x["elapsedVideoTimeRatio"]), float(x["audienceWatchRatio"])] for x in _rows(r)]
        except YouTubeError as e:
            log.info("no retention for %s: %s", vid, e)
            v["retention"] = []
        try:
            end = min(today, pub + timedelta(days=6))
            r = api.get(
                ANALYTICS_API,
                {"ids": "channel==MINE", "startDate": pub.isoformat(), "endDate": end.isoformat(), "dimensions": "day", "metrics": "views", "filters": f"video=={vid}", "sort": "day"},
            )
            v["daily"] = [[x["day"], int(x["views"])] for x in _rows(r)]
        except YouTubeError as e:
            log.info("no daily views for %s: %s", vid, e)
            v["daily"] = []
        try:
            r = api.get(f"{DATA_API}/commentThreads", {"part": "snippet", "videoId": vid, "maxResults": 100, "textFormat": "plainText", "order": "time"})
            v["commentTexts"] = [it["snippet"]["topLevelComment"]["snippet"]["textDisplay"] for it in r.get("items", [])]
        except YouTubeError as e:  # comments off, or "made for kids"
            log.info("no comments for %s: %s", vid, e)
            v["commentTexts"] = []

    data["syncedAt"] = datetime.now().isoformat(timespec="seconds")
    _save("youtube.json", data)
    return {"videos": len(videos), "linked": len(linked), "apiCalls": api.calls, "syncedAt": data["syncedAt"]}


# --------------------------------------------------------------- matching to renders


def _norm(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\.(mp4|mov)$", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def auto_link(videos: dict[str, dict], links: dict[str, str | None]) -> dict[str, str | None]:
    """Match YouTube uploads to rendered videos.

    Manual choices (including "not ours" = None) always win. Otherwise, in order:
    the uploaded file name equals the studio's download name; the YouTube title equals
    our suggested title. Ties are broken by video length; still-ambiguous ones are left
    for you to link by hand in the Analytics tab.
    """
    hist = [h for h in store.list_history() if h.get("status") == "rendered" and h.get("video")]
    names = {p.id: pstore.display_name(p.name) for p in pstore.load_players()}
    taken = {h for h in links.values() if h}
    out = dict(links)
    for vid, v in videos.items():
        if vid in out:
            continue
        pub = v.get("publishedAt", "")[:19]
        cands = [h for h in hist if h["id"] not in taken and (not pub or h["createdAt"][:19] <= pub)]
        hits: list[dict] = []
        fname = _norm(v.get("fileName"))
        if fname and fname != "video":
            hits = [h for h in cands if _norm(store.download_name(h, names)) == fname]
        if not hits:
            title = _norm(v.get("title"))
            hits = [h for h in cands if title and (_norm(h.get("title")) == title or _norm(store.download_name(h, names)) == title)]
        if len(hits) > 1 and v.get("durationSeconds"):
            best = min(abs((h.get("durationSeconds") or 0) - v["durationSeconds"]) for h in hits)
            hits = [h for h in hits if abs((h.get("durationSeconds") or 0) - v["durationSeconds"]) == best]
        if len(hits) == 1:
            out[vid] = hits[0]["id"]
            taken.add(hits[0]["id"])
    return out


def set_link(video_id: str, history_id: str | None) -> dict:
    data = load_data()
    if video_id not in data["videos"]:
        raise YouTubeError("Unknown YouTube video — sync first.")
    if history_id == "":  # forget the manual choice; the next sync tries to match again
        data["links"].pop(video_id, None)
        _save("youtube.json", data)
        return data["links"]
    if history_id:
        if not any(h["id"] == history_id for h in store.list_history()):
            raise YouTubeError("Unknown studio video.")
        for k, v in list(data["links"].items()):  # a render can only be one upload
            if v == history_id and k != video_id:
                data["links"][k] = None
    data["links"][video_id] = history_id
    _save("youtube.json", data)
    return data["links"]


# ---------------------------------------------------------------------- comments


_WORD_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5}
_MISSED = re.compile(r"\b(no idea|didn'?t get|did not get|couldn'?t|could not|none|zero|0 clues?|got it wrong|missed)\b")


def clues_needed(text: str, max_clues: int = 5) -> int | str | None:
    """'3!' / 'got it on the second clue' / 'first one' -> 3 / 2 / 1; 'no idea' -> 'missed'."""
    t = text.lower()
    if _MISSED.search(t):
        return "missed"
    m = re.search(r"(?<![\d:/.])([1-9])(?:st|nd|rd|th)?(?![\d:/.%])", t)
    if m and 1 <= int(m.group(1)) <= max_clues:
        return int(m.group(1))
    m = re.search(r"\b(" + "|".join(_WORD_NUM) + r")\b", t)
    if m:
        return _WORD_NUM[m.group(1)]
    return None


# ------------------------------------------------------------------------ analysis


def _project(h: dict) -> dict | None:
    p = settings.output_dir / h["outputDir"] / "project.json"
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def _at(curve: list[list[float]], ratio: float) -> float | None:
    """Audience still watching at a point in the video (linear interpolation)."""
    if not curve:
        return None
    pts = sorted(curve)
    if ratio <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= ratio <= x1:
            return y0 + (y1 - y0) * ((ratio - x0) / (x1 - x0) if x1 > x0 else 0)
    return pts[-1][1]


def _scene_label(sid: str) -> str:
    if sid.startswith("clue-"):
        return f"Clue {sid.split('-')[1]}"
    return SCENE_LABEL.get(sid, sid.title())


def _bucket_duration(s: float | None) -> str | None:
    if not s:
        return None
    return "under 18s" if s < 18 else "18–22s" if s < 22 else "22–26s" if s < 26 else "26s+"


def video_rows() -> list[dict]:
    """One row per YouTube video, with what we know about how it was made."""
    data = load_data()
    hist = {h["id"]: h for h in store.list_history()}
    players = {p.id: p for p in pstore.load_players()}
    rows = []
    for vid, v in data["videos"].items():
        a = v.get("analytics") or {}
        h = hist.get(data["links"].get(vid) or "")
        row: dict[str, Any] = {
            "id": vid,
            "url": f"https://youtube.com/shorts/{vid}",
            "title": v["title"],
            "thumbnail": v.get("thumbnail"),
            "publishedAt": v["publishedAt"],
            "durationSeconds": v.get("durationSeconds"),
            "privacy": v.get("privacy"),
            "historyId": h["id"] if h else None,
            "linkState": "linked" if h else ("not-ours" if vid in data["links"] else "unlinked"),
            # Counts come from the live public numbers (what YouTube Studio shows); the Analytics
            # API totals lag ~2 days, so only watch-time style metrics come from there.
            "views": int(v["public"]["views"] or 0),
            "engagedViews": a.get("engagedViews"),
            "avgViewPercentage": a.get("averageViewPercentage"),
            "avgViewDuration": a.get("averageViewDuration"),
            "likes": int(v["public"]["likes"] or 0),
            "comments": int(v["public"]["comments"] or 0),
            "shares": a.get("shares"),
            "subscribersGained": a.get("subscribersGained"),
            "retention": v.get("retention") or [],
        }
        daily = v.get("daily") or []
        pub = date.fromisoformat(v["publishedAt"][:10])
        age = (date.today() - pub).days
        # Analytics lags ~2 days, so only call it once the window is safely in the past.
        row["earlyViews"] = sum(n for d, n in daily if (date.fromisoformat(d) - pub).days < EARLY_DAYS) if daily and age >= EARLY_DAYS + 2 else None
        row["likeRate"] = round(1000 * row["likes"] / row["views"], 1) if row["views"] else None
        row["commentRate"] = round(1000 * row["comments"] / row["views"], 1) if row["views"] else None

        answers = [clues_needed(t) for t in v.get("commentTexts") or []]
        row["cluesNeeded"] = {str(k): answers.count(k) for k in (1, 2, 3, 4, 5, "missed") if answers.count(k)}

        if h:
            proj = _project(h) or {}
            props = proj.get("props") or {}
            st = proj.get("settings") or {}
            tl = props.get("timeline") or {}
            p0 = players.get((h.get("playerIds") or [None])[0])
            published = datetime.fromisoformat(v["publishedAt"].replace("Z", "+00:00")).astimezone()
            row["made"] = {
                "format": h.get("format"),
                "difficulty": h.get("difficulty"),
                "clues": len(h.get("clues") or []) or None,
                "length": _bucket_duration(h.get("durationSeconds")),
                "theme": st.get("theme"),
                "voice": st.get("voice") or st.get("ttsProvider") or "default",
                "speechSpeed": st.get("speechSpeed"),
                "player": pstore.display_name(p0.name) if p0 else None,
                "playerType": None if not p0 else ("Women" if p0.category == "women" else "Legend" if p0.retired else "Current star"),
                "weekday": published.strftime("%A"),
                "postedHour": f"{published.hour:02d}:00",
            }
            row["answer"] = h.get("answer")
            row["clueTexts"] = h.get("clues")
            scenes = []
            total = tl.get("totalFrames") or 0
            for s in tl.get("scenes") or []:
                if not total:
                    break
                r0, r1 = s["from"] / total, (s["from"] + s["durationInFrames"]) / total
                a0, a1 = _at(row["retention"], r0), _at(row["retention"], r1)
                scenes.append(
                    {"id": s["id"], "label": _scene_label(s["id"]), "start": round(r0, 4), "end": round(r1, 4), "watchingAtStart": a0, "watchingAtEnd": a1}
                )
            row["scenes"] = scenes
            reveal = next((s for s in scenes if s["id"] == "reveal"), None)
            row["reachedReveal"] = reveal["watchingAtStart"] if reveal and reveal["watchingAtStart"] is not None else None
        rows.append(row)
    rows.sort(key=lambda r: r["publishedAt"], reverse=True)
    return rows


COMPARE = [
    ("format", "Format"),
    ("clues", "Number of clues"),
    ("difficulty", "Difficulty"),
    ("length", "Video length"),
    ("playerType", "Type of player"),
    ("theme", "Look"),
    ("voice", "Voice"),
    ("speechSpeed", "Narration speed"),
    ("weekday", "Day posted"),
]
METRICS = [
    ("earlyViews", f"Views, first {EARLY_DAYS} days"),
    ("avgViewPercentage", "Avg % watched"),
    ("reachedReveal", "Still watching at reveal"),
    ("likeRate", "Likes per 1k views"),
    ("commentRate", "Comments per 1k views"),
]


def _median(xs: list[float]) -> float | None:
    xs = [x for x in xs if x is not None]
    return round(statistics.median(xs), 3) if xs else None


def report() -> dict:
    rows = video_rows()
    ours = [r for r in rows if r.get("made")]

    comparisons = []
    for key, label in COMPARE:
        groups: dict[str, list[dict]] = {}
        for r in ours:
            val = r["made"].get(key)
            if val is not None:
                groups.setdefault(str(val), []).append(r)
        if len(groups) < 2:
            continue
        comparisons.append(
            {
                "key": key,
                "label": label,
                "groups": sorted(
                    (
                        {"value": g, "n": len(rs), **{m: _median([x.get(m) for x in rs]) for m, _ in METRICS}}
                        for g, rs in groups.items()
                    ),
                    key=lambda x: -x["n"],
                ),
            }
        )

    # Where viewers leave: average % of the audience lost during each scene.
    drops: dict[str, list[float]] = {}
    order: list[str] = []
    for r in ours:
        for s in r.get("scenes") or []:
            if s["watchingAtStart"] is None or s["watchingAtEnd"] is None:
                continue
            if s["id"] not in order:
                order.append(s["id"])
            drops.setdefault(s["id"], []).append(s["watchingAtStart"] - s["watchingAtEnd"])
    rank = {"countdown": 100, "reveal": 101, "outro": 102}
    order.sort(key=lambda sid: int(sid.split("-")[1]) if sid.startswith("clue-") else rank.get(sid, 200))
    scene_drops = [{"id": sid, "label": _scene_label(sid), "n": len(drops[sid]), "avgDrop": round(statistics.mean(drops[sid]), 4)} for sid in order]

    clue_votes: dict[str, int] = {}
    for r in ours:
        for k, n in (r.get("cluesNeeded") or {}).items():
            clue_votes[k] = clue_votes.get(k, 0) + n

    return {
        "status": status(),
        "videos": rows,
        "ours": len(ours),
        "comparisons": comparisons,
        "metrics": [{"key": k, "label": l} for k, l in METRICS],
        "sceneDrops": scene_drops,
        "cluesNeeded": clue_votes,
        "insights": insights(ours, comparisons, scene_drops, clue_votes),
    }


def _fmt(metric: str, v: float) -> str:
    if metric == "reachedReveal":
        return f"{v * 100:.0f}%"
    if metric == "avgViewPercentage":
        return f"{v:.0f}%"
    return f"{v:,.0f}" if v >= 10 else f"{v:.1f}"


def insights(ours: list[dict], comparisons: list[dict], scene_drops: list[dict], votes: dict[str, int]) -> list[str]:
    """Plain-English takeaways. Conservative: says 'not enough yet' rather than guess."""
    out: list[str] = []
    if len(ours) < 2 * MIN_GROUP:
        out.append(
            f"Only {len(ours)} studio video{'s' if len(ours) != 1 else ''} with numbers so far — comparisons get trustworthy at about "
            f"{MIN_GROUP} videos per option (e.g. {MIN_GROUP} with 4 clues and {MIN_GROUP} with 5). Keep posting and syncing."
        )
    reach = [r["reachedReveal"] for r in ours if r.get("reachedReveal") is not None]
    if reach:
        out.append(f"On a typical video, {statistics.median(reach) * 100:.0f}% of the starting audience is still watching when the answer is revealed.")
    leaks = [s for s in scene_drops if s["id"] not in ("outro",) and s["n"] >= 2]
    if leaks:
        worst = max(leaks, key=lambda s: s["avgDrop"])
        if worst["avgDrop"] > 0.05:
            tip = {
                "clue-1": "the opening seconds decide a Short — try a punchier first clue or start the narration sooner",
                "countdown": "people bail during the countdown — try a shorter countdown",
            }.get(worst["id"], "consider a shorter or more surprising clue there")
            out.append(f"Viewers leave most during {worst['label']} (about {worst['avgDrop'] * 100:.0f}% of the audience on average) — {tip}.")
    for comp in comparisons:  # one line per comparison: its clearest difference
        found = []
        for metric, label in METRICS:
            good = [g for g in comp["groups"] if g["n"] >= MIN_GROUP and g.get(metric) is not None]
            if len(good) < 2:
                continue
            best = max(good, key=lambda g: g[metric])
            worst = min(good, key=lambda g: g[metric])
            if worst[metric] and best[metric] / worst[metric] >= 1.2:
                found.append((best[metric] / worst[metric], metric, label, best, worst))
        if found:
            _, metric, label, best, worst = max(found, key=lambda f: f[0])
            out.append(
                f"{comp['label']}: “{best['value']}” beats “{worst['value']}” on {label.lower()} "
                f"({_fmt(metric, best[metric])} vs {_fmt(metric, worst[metric])}, {best['n']} vs {worst['n']} videos)."
            )
    total = sum(votes.values())
    if total >= 10:
        nums = {int(k): n for k, n in votes.items() if k.isdigit()}
        early = sum(n for k, n in nums.items() if k <= 2) / total
        missed = votes.get("missed", 0) / total
        typical = max(nums, key=nums.get) if nums else None
        line = f"From {total} comments that said how many clues they needed, the most common answer is {typical}."
        if early > 0.6:
            line += " Most people get it in 1–2 clues — the videos may be too easy; try 'hard' difficulty or a vaguer first clue."
        elif missed + votes.get("5", 0) / total > 0.5:
            line += " Many people need every clue or miss it — try 'easy' difficulty or more famous players."
        out.append(line)
    elif ours:
        out.append("Not enough “how many clues” comments yet to judge difficulty (need about 10).")
    return out


# --------------------------------------------------------------- shareable summary


def share_text(*, comments_per_video: int = 5) -> str:
    """Everything in the Analytics tab as compact plain text, to paste into a chat."""
    rep = report()
    st = rep["status"]
    data = load_data()
    ch = st.get("channel") or {}
    p = lambda v: "–" if v is None else f"{v * 100:.0f}%"  # noqa: E731
    n = lambda v: "–" if v is None else (f"{v:,.0f}" if v >= 10 or float(v).is_integer() else f"{v:.1f}")  # noqa: E731
    out = [
        "# Soccer Brain — YouTube report",
        f"Channel: {ch.get('title', '?')} ({n(ch.get('subscribers'))} subscribers) · synced {st.get('syncedAt')} · "
        f"report made {datetime.now().isoformat(timespec='minutes')} · {len(rep['videos'])} uploads, {rep['ours']} matched to studio renders",
        "Note: views/likes/comments are live (match YouTube Studio); avg watched, engaged views, retention and 'early' lag ~2 days. "
        "'early' = views in the first 2 days; 'reveal' = share of starting audience still watching at the reveal.",
        "",
        "## Takeaways",
        *[f"- {t}" for t in rep["insights"]],
        "",
        "## Where viewers leave (avg share of audience lost per scene)",
        *[f"- {d['label']}: {'−' if d['avgDrop'] >= 0 else '+'}{abs(d['avgDrop']) * 100:.1f}% ({d['n']} videos)" for d in rep["sceneDrops"]],
        "",
        "## Clues needed (from comments)",
        ", ".join(f"{k}: {rep['cluesNeeded'][k]}" for k in ("1", "2", "3", "4", "5", "missed") if k in rep["cluesNeeded"]) or "none yet",
        "",
        "## Comparisons (medians)",
    ]
    heads = [m["label"] for m in rep["metrics"]]
    for c in rep["comparisons"]:
        out.append(f"### {c['label']}")
        out.append("option | videos | " + " | ".join(heads))
        for g in c["groups"]:
            out.append(f"{g['value']} | {g['n']} | " + " | ".join(_fmt(m["key"], g[m["key"]]) if g.get(m["key"]) is not None else "–" for m in rep["metrics"]))
    out += ["", "## Videos (newest first)"]
    for r in rep["videos"]:
        avg = r["avgViewPercentage"]
        line = (
            f"- {r['publishedAt'][:16].replace('T', ' ')} · “{r['title']}” · {n(r['durationSeconds'])}s · views {n(r['views'])}"
            f" (early {n(r['earlyViews'])}, engaged {n(r['engagedViews'])}) · avg watched {'–' if avg is None else f'{avg:.0f}%'}"
            f" · reveal {p(r.get('reachedReveal'))} · likes {n(r['likes'])} · comments {n(r['comments'])} · subs +{n(r['subscribersGained'])}"
        )
        out.append(line)
        if r.get("made"):
            m = r["made"]
            out.append(
                "  made: " + ", ".join(f"{k}={v}" for k, v in m.items() if v is not None)
            )
            if r.get("clueTexts"):
                out.append("  clues: " + " | ".join(r["clueTexts"]))
            if any(s["watchingAtStart"] is not None for s in r.get("scenes") or []):
                out.append(
                    "  watching at start of: "
                    + ", ".join(f"{s['label']} {p(s['watchingAtStart'])}" for s in r["scenes"] if s["watchingAtStart"] is not None)
                )
            else:
                out.append("  (no retention curve from YouTube yet)")
            if r["cluesNeeded"]:
                out.append("  clues-needed votes: " + ", ".join(f"{k}: {v}" for k, v in r["cluesNeeded"].items()))
        else:
            out.append(f"  ({'not a studio video' if r['linkState'] == 'not-ours' else 'not matched to a studio render'})")
        texts = (data["videos"].get(r["id"], {}).get("commentTexts") or [])[:comments_per_video]
        if texts:
            out.append("  comments: " + " | ".join(re.sub(r"\s+", " ", t)[:100] for t in texts))
    return "\n".join(out) + "\n"
