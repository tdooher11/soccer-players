import json

import pytest
from pydantic import ValidationError

from backend import players as ps
from backend.config import settings
from backend.models import Player


def test_store_loaded_from_master_list():
    pool = ps.load_players()
    master = json.loads(settings.master_list.read_text())
    assert len(pool) == len(master)
    r = ps.get_player("ronaldinho")
    assert r.country_code == "BR" and r.retired
    assert r.career_clubs[:3] == ["Grêmio", "PSG", "Barcelona"]
    assert r.primary_club == "Barcelona" and r.provenance["primary_club"].source == "derived"


def test_verified_years_applied_only_when_counts_match():
    r = ps.get_player("ronaldinho")
    bo = r.achievement("ballon_dor")
    assert bo.years == [2005] and bo.provenance.source == "verified"
    messi = ps.get_player("lionel-messi")
    assert len(messi.achievement("ballon_dor").years) == messi.achievement("ballon_dor").count == 8
    # The Uruguayan Luis Suárez must NOT inherit the Spanish Luis Suárez's 1960 Ballon d'Or.
    assert ps.get_player("luis-suarez").achievement("ballon_dor") is None


def test_image_paths_never_contain_names():
    for p in ps.load_players():
        if p.image_path:
            stem = p.image_path.split("/")[-1]
            assert p.id.split("-")[0] not in stem


def test_reimport_preserves_manual_edits_and_reports_conflicts():
    p = ps.get_player("pele")
    p.career_clubs = ["Santos", "New York Cosmos", "Made-up FC"]
    ps.upsert_player(p, manual_fields=["career_clubs"])
    report = ps.import_master_list(download_images=False, fetch_credits=False)
    again = ps.get_player("pele")
    assert again.career_clubs[-1] == "Made-up FC"
    assert any(c["player"] == "pele" and c["field"] == "career_clubs" for c in report.conflicts)
    # restore
    again.provenance.pop("career_clubs")
    ps.upsert_player(again)
    ps.import_master_list(download_images=False, fetch_credits=False)
    assert "Made-up FC" not in ps.get_player("pele").career_clubs


def test_validation_rejects_bad_records():
    with pytest.raises(ValidationError):
        Player.model_validate({"id": "x", "name": "X", "country": "Y"})  # missing countryCode
    with pytest.raises(ValidationError):
        Player.model_validate({"id": "x", "name": "X", "country": "Y", "countryCode": "YY", "position": "GOALIE"})
    assert Player.model_validate({"id": "x", "name": "X", "country": "Y", "countryCode": "br"}).country_code == "BR"


def test_slugify_and_display_name():
    assert ps.slugify("Martin Ødegaard") == "martin-odegaard"
    assert ps.slugify("Ronaldo Nazário (R9)") == "ronaldo-nazario"
    assert ps.display_name("Ronaldo Nazário (R9)") == "Ronaldo Nazário"


def test_current_club_requires_confirmation():
    p = ps.get_player("kylian-mbappe")
    assert not ps.current_club_is_fresh(p)
    ps.confirm_current_club(p.id, None)
    assert ps.current_club_is_fresh(ps.get_player(p.id))


def test_trophy_years_derived_only_when_unambiguous():
    r = ps.get_player("ronaldinho")
    assert r.achievement("world_cup").years == [2002]
    assert r.achievement("champions_league").years == [2006]
    assert r.achievement("champions_league").provenance.source == "derived"
    assert ps.get_player("cristiano-ronaldo").achievement("champions_league").years == [2008, 2014, 2016, 2017, 2018]
    # Spain won in 2010 and 2026 and Ramos was young enough for both: count 1 vs 2 candidates -> no year.
    assert ps.get_player("sergio-ramos").achievement("world_cup").years == []
    # West Germany counts for Germany.
    assert ps.get_player("franz-beckenbauer").achievement("world_cup").years == [1974]
