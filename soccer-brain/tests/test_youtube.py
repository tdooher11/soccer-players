"""YouTube analytics against a fake Google (no network)."""

import json
import time
from datetime import date
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from backend import store, youtube
from backend.config import settings

SCENES = [("clue-1", 0, 100), ("clue-2", 100, 100), ("clue-3", 200, 100), ("countdown", 300, 90), ("reveal", 390, 90), ("outro", 480, 60)]


def _render(rid, answer, player, created, title, clues=5, difficulty="medium"):
    out = f"2026-10-01/{rid}"
    d = settings.output_dir / out
    d.mkdir(parents=True, exist_ok=True)
    (d / "project.json").write_text(
        json.dumps(
            {
                "settings": {"theme": "stadium-gold", "speechSpeed": 1.0, "voice": None, "ttsProvider": None},
                "props": {"timeline": {"totalFrames": 540, "scenes": [{"id": i, "from": f, "durationInFrames": n} for i, f, n in SCENES]}},
            }
        )
    )
    store.add_history(
        {
            "id": rid,
            "createdAt": created,
            "status": "rendered",
            "format": "guess_player",
            "difficulty": difficulty,
            "playerIds": [player],
            "clues": [f"clue {i}" for i in range(clues)],
            "answer": answer,
            "outputDir": out,
            "video": f"{out}/video.mp4",
            "durationSeconds": 18.0,
            "title": title,
        }
    )


class FakeGoogle:
    def __init__(self):
        self.refreshed = 0
        self.engaged_supported = False

    def __call__(self, req: httpx.Request) -> httpx.Response:
        u = urlparse(str(req.url))
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.netloc == "oauth2.googleapis.com":
            form = parse_qs(req.content.decode())
            if form["grant_type"][0] == "refresh_token":
                self.refreshed += 1
                return httpx.Response(200, json={"access_token": "fresh", "expires_in": 3600})
            assert form["code_verifier"][0]
            return httpx.Response(200, json={"access_token": "a1", "refresh_token": "r1", "expires_in": 3600})
        assert req.headers["Authorization"] == "Bearer fresh"
        if u.path.endswith("/channels"):
            return httpx.Response(200, json={"items": [{"id": "UC1", "snippet": {"title": "Soccer Brain"}, "statistics": {"subscriberCount": "42"}, "contentDetails": {"relatedPlaylists": {"uploads": "UU1"}}}]})
        if u.path.endswith("/playlistItems"):
            return httpx.Response(200, json={"items": [{"contentDetails": {"videoId": v}} for v in ("vA", "vB", "vC")]})
        if u.path.endswith("/videos"):
            return httpx.Response(
                200,
                json={
                    "items": [
                        _yt("vA", "Ronaldinho - Guess the Player - 2026-10-01", "2026-10-02T10:00:00Z", "Ronaldinho - Guess the Player - 2026-10-01.mp4"),
                        _yt("vB", "Can You Guess This Brazilian Star? ⚽", "2026-10-03T10:00:00Z", "video.mp4"),
                        _yt("vC", "My holiday vlog", "2026-10-04T10:00:00Z", "IMG_0001.MOV"),
                    ]
                },
            )
        if u.path.endswith("/commentThreads"):
            texts = {"vA": ["3!", "got it on the second clue", "no idea lol", "Ronaldinho is the GOAT"], "vB": ["1", "first one"]}.get(q["videoId"], [])
            return httpx.Response(200, json={"items": [{"snippet": {"topLevelComment": {"snippet": {"textDisplay": t}}}} for t in texts]})
        if u.netloc == "youtubeanalytics.googleapis.com":
            dims = q["dimensions"]
            if dims == "video":
                if "engagedViews" in q["metrics"] and not self.engaged_supported:
                    return httpx.Response(400, json={"error": {"message": "Unknown identifier (engagedViews) given in field parameters.metrics."}})
                cols = q["metrics"].split(",")
                vals = {"vA": dict(views=1000, averageViewPercentage=80.0, likes=50, comments=4), "vB": dict(views=400, averageViewPercentage=60.0, likes=10, comments=2), "vC": dict(views=10)}
                rows = [[v] + [vals[v].get(c, 0) for c in cols] for v in q["filters"].split("==")[1].split(",")]
                return httpx.Response(200, json={"columnHeaders": [{"name": "video"}] + [{"name": c} for c in cols], "rows": rows})
            if dims == "elapsedVideoTimeRatio":
                drop = 0.5 if q["filters"].endswith("vA") else 0.3
                rows = [[r / 100, round(1.0 - drop * r / 100, 4)] for r in range(1, 101)]
                return httpx.Response(200, json={"columnHeaders": [{"name": "elapsedVideoTimeRatio"}, {"name": "audienceWatchRatio"}], "rows": rows})
            if dims == "day":
                return httpx.Response(200, json={"columnHeaders": [{"name": "day"}, {"name": "views"}], "rows": [["2026-10-02", 300], ["2026-10-03", 200], ["2026-10-04", 100]]})
        return httpx.Response(404, json={"error": {"message": f"unexpected {req.url}"}})


def _yt(vid, title, published, fname):
    return {
        "id": vid,
        "snippet": {"title": title, "publishedAt": published, "thumbnails": {"medium": {"url": f"https://i.ytimg.com/{vid}.jpg"}}},
        "contentDetails": {"duration": "PT18S"},
        "statistics": {"viewCount": "999", "likeCount": "1", "commentCount": "0"},
        "status": {"privacyStatus": "public"},
        "fileDetails": {"fileName": fname},
    }


@pytest.fixture
def connected(tmp_data):
    for f in ("youtube.json", "youtube-token.json", "youtube-client.json"):
        (tmp_data / f).unlink(missing_ok=True)
    youtube.save_client({"installed": {"client_id": "cid", "client_secret": "sec"}})
    (tmp_data / "youtube-token.json").write_text(json.dumps({"access_token": "old", "refresh_token": "r1", "expires_at": time.time() - 10}))
    _render("r-aaa", "RONALDINHO", "ronaldinho", "2026-10-01T09:00:00", "Can You Guess This Legend? ⚽")
    _render("r-bbb", "NEYMAR", "neymar", "2026-10-02T09:00:00", "Can You Guess This Brazilian Star? ⚽", clues=4, difficulty="hard")
    return FakeGoogle()


def test_sync_matches_uploads_and_builds_report(connected):
    api = youtube.Api(http=httpx.Client(transport=httpx.MockTransport(connected)))
    res = youtube.sync(api=api, today=date(2026, 10, 30))
    assert res["videos"] == 3 and res["linked"] == 2
    assert connected.refreshed == 1  # expired access token was refreshed once

    links = youtube.load_data()["links"]
    assert links["vA"] == "r-aaa"  # by uploaded file name (the studio's download name)
    assert links["vB"] == "r-bbb"  # by our suggested title
    assert "vC" not in links

    rep = youtube.report()
    rows = {r["id"]: r for r in rep["videos"]}
    a = rows["vA"]
    assert a["views"] == 1000 and a["avgViewPercentage"] == 80.0  # engagedViews refused -> retried without it
    assert a["engagedViews"] is None
    assert a["made"]["clues"] == 5 and a["made"]["playerType"] == "Legend"
    reveal = next(s for s in a["scenes"] if s["id"] == "reveal")
    assert reveal["watchingAtStart"] == pytest.approx(1 - 0.5 * 390 / 540, abs=0.01)
    assert a["reachedReveal"] == pytest.approx(reveal["watchingAtStart"])
    assert a["earlyViews"] == 500  # first 2 days only
    assert a["cluesNeeded"] == {"2": 1, "3": 1, "missed": 1}
    assert rows["vC"]["linkState"] == "unlinked" and "made" not in rows["vC"]

    assert rep["ours"] == 2
    assert {c["key"] for c in rep["comparisons"]} >= {"clues", "difficulty", "playerType"}
    assert [d["id"] for d in rep["sceneDrops"]][:3] == ["clue-1", "clue-2", "clue-3"]
    assert rep["cluesNeeded"] == {"1": 2, "2": 1, "3": 1, "missed": 1}
    assert rep["insights"] and "Only 2 studio videos" in rep["insights"][0]

    text = youtube.share_text()
    assert "# Soccer Brain — YouTube report" in text and "1: 2, 2: 1, 3: 1, missed: 1" in text
    assert "“My holiday vlog”" in text and "not matched to a studio render" in text
    assert "comments: 3! | got it on the second clue" in text


def test_manual_links_win_and_survive_resync(connected):
    api = youtube.Api(http=httpx.Client(transport=httpx.MockTransport(connected)))
    youtube.sync(api=api, today=date(2026, 10, 30))
    youtube.set_link("vC", "r-aaa")  # moving a render to another upload unlinks the old one
    links = youtube.load_data()["links"]
    assert links["vC"] == "r-aaa" and links["vA"] is None
    youtube.sync(api=api, today=date(2026, 10, 30))
    links = youtube.load_data()["links"]
    assert links["vC"] == "r-aaa" and links["vA"] is None
    youtube.set_link("vA", "")  # forget -> rematched automatically on next sync (r-aaa is taken)
    assert "vA" not in youtube.load_data()["links"]


def test_oauth_url_and_code_exchange(connected, tmp_data):
    url = youtube.auth_url("http://localhost:8000/api/youtube/oauth/callback")
    q = parse_qs(urlparse(url).query)
    assert q["code_challenge_method"] == ["S256"] and q["access_type"] == ["offline"]
    assert "yt-analytics.readonly" in q["scope"][0] and "youtube.readonly" in q["scope"][0]
    tok = youtube.finish_auth("the-code", q["state"][0], http=httpx.Client(transport=httpx.MockTransport(connected)))
    assert tok["refresh_token"] == "r1"
    with pytest.raises(youtube.YouTubeError):
        youtube.finish_auth("again", q["state"][0])  # state is single-use


def test_not_connected_is_clear(tmp_data):
    (tmp_data / "youtube-token.json").unlink(missing_ok=True)
    with pytest.raises(youtube.NotConnected):
        youtube.Api(http=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))).get("https://x", {})


@pytest.mark.parametrize(
    "text,want",
    [
        ("3!", 3),
        ("got it on the second clue", 2),
        ("1st clue easy", 1),
        ("Four", 4),
        ("no idea", "missed"),
        ("I didn't get it", "missed"),
        ("Messi scored in 2022", None),
        ("Ronaldo is number 7", None),
        ("10/10 video", None),
    ],
)
def test_clues_needed(text, want):
    assert youtube.clues_needed(text) == want
