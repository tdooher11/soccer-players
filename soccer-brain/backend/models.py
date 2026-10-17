"""Pydantic models. VideoProps mirrors src/shared/types.ts (the Remotion contract)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

FormatId = Literal["guess_player", "career_path", "who_won_more", "guess_club", "true_false"]
ThemeId = Literal["stadium-gold", "electric-blue", "night-match"]
Difficulty = Literal["easy", "medium", "hard"]
Position = Literal["GK", "DEF", "MID", "FWD"]
IconId = Literal["ballon", "trophy", "cup", "boot", "gloves", "shirt", "cake", "star", "whistle"]


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


# ----------------------------------------------------------------------------- players


class Provenance(CamelModel):
    """Where a value came from. `master-list` values are refreshed on re-import;
    `manual` and `verified` values are never silently overwritten."""

    source: Literal["master-list", "manual", "verified", "derived"]
    detail: str | None = None
    source_url: str | None = Field(default=None, alias="sourceUrl")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    verified_at: str | None = Field(default=None, alias="verifiedAt")


class Achievement(CamelModel):
    type: Literal["world_cup", "champions_league", "ballon_dor", "continental"]
    count: int = 0
    years: list[int] = Field(default_factory=list)
    label: str | None = None  # e.g. "Copa América", "Euros"
    provenance: Provenance


class CareerStint(CamelModel):
    club: str
    years: str | None = None


class ImageCredit(CamelModel):
    author: str | None = None
    license: str | None = None
    license_url: str | None = Field(default=None, alias="licenseUrl")
    source_url: str | None = Field(default=None, alias="sourceUrl")


class Player(CamelModel):
    id: str
    name: str
    spoken_name: str | None = Field(default=None, alias="spokenName")
    country: str
    country_code: str = Field(alias="countryCode")
    current_club: str | None = Field(default=None, alias="currentClub")
    current_club_verified_at: str | None = Field(default=None, alias="currentClubVerifiedAt")
    primary_club: str | None = Field(default=None, alias="primaryClub")
    career_clubs: list[str] = Field(default_factory=list, alias="careerClubs")
    career_timeline: list[CareerStint] = Field(default_factory=list, alias="careerTimeline")
    retired: bool = False
    category: Literal["men", "women"] = "men"
    position: Position | None = None
    dob: str | None = None
    died: str | None = None
    jersey_number: int | None = Field(default=None, alias="jerseyNumber")
    achievements: list[Achievement] = Field(default_factory=list)
    fun_fact: str | None = Field(default=None, alias="funFact")
    image_path: str | None = Field(default=None, alias="imagePath")
    image_credit: ImageCredit | None = Field(default=None, alias="imageCredit")
    provenance: dict[str, Provenance] = Field(default_factory=dict)
    notes: str | None = None

    @field_validator("country_code")
    @classmethod
    def _cc(cls, v: str) -> str:
        return v.upper()

    def achievement(self, kind: str) -> Achievement | None:
        return next((a for a in self.achievements if a.type == kind), None)


# --------------------------------------------------------------------------- visuals


class ClubBadge(CamelModel):
    name: str
    short: str
    c1: str
    c2: str
    ink: str


class FlagVisual(CamelModel):
    kind: Literal["flag"] = "flag"
    code: str


class ClubVisual(CamelModel):
    kind: Literal["club"] = "club"
    club: ClubBadge


class IconVisual(CamelModel):
    kind: Literal["icon"] = "icon"
    icon: IconId


class NoVisual(CamelModel):
    kind: Literal["none"] = "none"


ClueVisual = Annotated[Union[FlagVisual, ClubVisual, IconVisual, NoVisual], Field(discriminator="kind")]


# -------------------------------------------------------------------------- question


class Clue(CamelModel):
    text: str = Field(min_length=1, max_length=90)
    speech: str | None = Field(default=None, max_length=200, description="What the narrator says, if different from text")
    visual: ClueVisual = Field(default_factory=NoVisual)
    fact: str | None = Field(default=None, description="Machine id of the fact this clue is based on, e.g. club:PSG")
    source: str | None = Field(default=None, description="Provenance summary for this clue")


class PlayerChip(CamelModel):
    name: str
    flag_code: str | None = Field(default=None, alias="flagCode")
    image_src: str | None = Field(default=None, alias="imageSrc")
    club: ClubBadge | None = None
    value: str | None = None


class AnswerSpec(CamelModel):
    title: str
    spoken: str | None = None
    subtitle: str = ""
    flag_code: str | None = Field(default=None, alias="flagCode")
    image_src: str | None = Field(default=None, alias="imageSrc")
    club: ClubBadge | None = None
    jersey_number: int | None = Field(default=None, alias="jerseyNumber")
    details: list[str] = Field(default_factory=list)
    verdict: Literal["TRUE", "FALSE"] | None = None
    versus: list[PlayerChip] | None = None


class Question(CamelModel):
    id: str
    format: FormatId = "guess_player"
    difficulty: Difficulty = "medium"
    player_id: str | None = Field(default=None, alias="playerId")
    player_ids: list[str] = Field(default_factory=list, alias="playerIds")
    title: str = "GUESS THE PLAYER"
    question: str | None = None
    intro_speech: str | None = Field(default=None, alias="introSpeech")
    clues: list[Clue] = Field(default_factory=list)
    chips: list[PlayerChip] = Field(default_factory=list)
    answer: AnswerSpec
    reveal_speech: str | None = Field(default=None, alias="revealSpeech")
    outro_speech: str | None = Field(default=None, alias="outroSpeech", description="Default depends on format (asks viewers to comment)")
    outro_title: str | None = Field(default=None, max_length=24, alias="outroTitle")
    outro_subtitle: str | None = Field(default=None, max_length=40, alias="outroSubtitle")
    duration_seconds: float = Field(default=20.0, ge=8, le=60, alias="durationSeconds")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"), alias="createdAt")
    fingerprint: str | None = None
    warnings: list[str] = Field(default_factory=list)


# -------------------------------------------------------------------------- settings


class VideoSettings(CamelModel):
    theme: ThemeId = "stadium-gold"
    text_scale: float = Field(default=1.0, ge=0.8, le=1.3, alias="textScale")
    narration: bool = True
    tts_provider: str | None = Field(default=None, alias="ttsProvider")
    voice: str | None = None
    speech_speed: float = Field(default=1.0, ge=0.7, le=1.4, alias="speechSpeed")
    music: bool = True
    music_volume: float = Field(default=0.22, ge=0, le=1, alias="musicVolume")
    sfx_volume: float = Field(default=1.0, ge=0, le=1.5, alias="sfxVolume")
    show_answer_image: bool = Field(default=True, alias="showAnswerImage")
    countdown_seconds: int = Field(default=3, ge=2, le=5, alias="countdownSeconds")
    fps: int = 30


# ------------------------------------------------------------------------ video props


class Scene(CamelModel):
    id: str
    type: Literal["clue", "countdown", "reveal", "outro"]
    index: int = 0
    from_: int = Field(alias="from")
    duration_in_frames: int = Field(alias="durationInFrames")


class Timeline(CamelModel):
    total_frames: int = Field(alias="totalFrames")
    scenes: list[Scene]


class AudioCue(CamelModel):
    src: str
    from_: int = Field(alias="from")
    duration_in_frames: int = Field(alias="durationInFrames")
    volume: float = 1.0
    scene_id: str = Field(alias="sceneId")


class MusicSpec(CamelModel):
    src: str
    volume: float


class AudioSpec(CamelModel):
    narration: list[AudioCue]
    music: MusicSpec | None
    sfx_volume: float = Field(alias="sfxVolume")


class Branding(CamelModel):
    channel: str
    handle: str | None = None


class AnswerProps(CamelModel):
    title: str
    subtitle: str
    flag_code: str | None = Field(alias="flagCode")
    image_src: str | None = Field(alias="imageSrc")
    club: ClubBadge | None
    jersey_number: int | None = Field(alias="jerseyNumber")
    details: list[str]
    verdict: Literal["TRUE", "FALSE"] | None = None
    versus: list[PlayerChip] | None = None


class ClueProps(CamelModel):
    text: str
    visual: ClueVisual


class OutroProps(CamelModel):
    title: str
    subtitle: str


class VideoProps(CamelModel):
    format: FormatId
    fps: int
    width: int = 1080
    height: int = 1920
    theme: ThemeId
    text_scale: float = Field(alias="textScale")
    title: str
    question: str | None
    clues: list[ClueProps]
    chips: list[PlayerChip]
    answer: AnswerProps
    show_answer_image: bool = Field(alias="showAnswerImage")
    timeline: Timeline
    audio: AudioSpec
    branding: Branding
    outro: OutroProps

    def dump(self) -> dict:
        return self.model_dump(by_alias=True, mode="json")


def today() -> str:
    return date.today().isoformat()
