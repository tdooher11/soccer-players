"""Interchangeable text-to-speech providers with a content-addressed cache.

Free/local (no key needed):
  kokoro  – Kokoro-82M (Apache-2.0) via kokoro-onnx. Natural, expressive. Default.
  piper   – Piper (MIT engine; voice licences vary, see models/piper/*.json). Light & fast.
Optional paid (only used when explicitly selected AND a key is configured):
  openai, elevenlabs, google

Every clip is trimmed of edge silence, peak-normalised, and cached as
public/tts/<sha1>.wav — the hash name means filenames never leak an answer.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
import re
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

from .config import settings

log = logging.getLogger(__name__)
logging.getLogger("phonemizer").setLevel(logging.ERROR)

CACHE_VERSION = "v2"


class TTSError(RuntimeError):
    pass


@dataclass
class Voice:
    id: str
    label: str
    provider: str


@dataclass
class Clip:
    path: Path  # absolute path
    public_src: str  # path relative to public/
    seconds: float
    cached: bool


class Provider:
    name = "base"
    paid = False
    # Approximate list price per 1M characters (USD). Shown as an estimate only.
    usd_per_million_chars = 0.0

    def available(self) -> tuple[bool, str]:
        return True, ""

    def voices(self) -> list[Voice]:
        return []

    def default_voice(self) -> str:
        return self.voices()[0].id

    def synthesize(self, text: str, voice: str, speed: float) -> tuple[np.ndarray, int]:
        raise NotImplementedError

    def estimate_cost(self, chars: int) -> float:
        return round(chars / 1_000_000 * self.usd_per_million_chars, 4)


# ------------------------------------------------------------------- local providers


class KokoroProvider(Provider):
    name = "kokoro"
    VOICES = {
        "am_michael": "Michael (US, warm presenter)",
        "am_puck": "Puck (US, upbeat)",
        "am_adam": "Adam (US)",
        "am_eric": "Eric (US)",
        "am_fenrir": "Fenrir (US, deep)",
        "bm_george": "George (UK)",
        "bm_lewis": "Lewis (UK)",
        "af_heart": "Heart (US, female)",
        "af_bella": "Bella (US, female)",
        "bf_emma": "Emma (UK, female)",
    }
    _lock = threading.Lock()
    _engine = None

    def _paths(self) -> tuple[Path, Path]:
        d = settings.models_dir / "kokoro"
        return d / "kokoro-v1.0.onnx", d / "voices-v1.0.bin"

    def available(self) -> tuple[bool, str]:
        m, v = self._paths()
        if not (m.exists() and v.exists()):
            return False, "Kokoro model files missing — run `./soccer-brain setup`"
        try:
            import kokoro_onnx  # noqa: F401
        except ImportError:
            return False, "kokoro-onnx not installed"
        return True, ""

    def voices(self) -> list[Voice]:
        return [Voice(k, v, self.name) for k, v in self.VOICES.items()]

    def _get(self):
        with self._lock:
            if KokoroProvider._engine is None:
                from kokoro_onnx import Kokoro

                m, v = self._paths()
                KokoroProvider._engine = Kokoro(str(m), str(v))
            return KokoroProvider._engine

    def synthesize(self, text, voice, speed):
        eng = self._get()
        lang = "en-gb" if voice.startswith("b") else "en-us"
        with self._lock:
            samples, sr = eng.create(text, voice=voice, speed=speed, lang=lang)
        return np.asarray(samples, dtype=np.float32), sr


class PiperProvider(Provider):
    name = "piper"
    _cache: dict = {}
    _lock = threading.Lock()

    def _dir(self) -> Path:
        return settings.models_dir / "piper"

    def available(self) -> tuple[bool, str]:
        if not list(self._dir().glob("*.onnx")):
            return False, "No Piper voices in models/piper — run `./soccer-brain setup`"
        try:
            import piper  # noqa: F401
        except ImportError:
            return False, "piper-tts not installed"
        return True, ""

    def voices(self) -> list[Voice]:
        return [Voice(p.stem, p.stem.replace("_", " "), self.name) for p in sorted(self._dir().glob("*.onnx"))]

    def default_voice(self) -> str:
        names = [v.id for v in self.voices()]
        return "en_US-ryan-high" if "en_US-ryan-high" in names else names[0]

    def synthesize(self, text, voice, speed):
        import wave

        from piper import PiperVoice, SynthesisConfig

        with self._lock:
            if voice not in self._cache:
                self._cache[voice] = PiperVoice.load(self._dir() / f"{voice}.onnx")
            pv = self._cache[voice]
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wf:
                pv.synthesize_wav(text, wf, syn_config=SynthesisConfig(length_scale=1.0 / speed))
        buf.seek(0)
        with wave.open(buf, "rb") as wf:
            sr = wf.getframerate()
            data = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        return data, sr


# -------------------------------------------------------------------- paid providers


def _http_post(url: str, *, headers: dict, payload: dict, timeout: float = 60) -> bytes:
    import httpx

    r = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    if r.status_code >= 400:
        raise TTSError(f"{url} -> HTTP {r.status_code}: {r.text[:300]}")
    return r.content


def _decode_audio(data: bytes) -> tuple[np.ndarray, int]:
    import soundfile as sf

    samples, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    return samples.mean(axis=1), sr


class OpenAIProvider(Provider):
    name = "openai"
    paid = True
    usd_per_million_chars = 15.0  # tts-1 list price at time of writing; verify before relying on it

    def available(self):
        return (bool(os.environ.get("OPENAI_API_KEY")), "Set OPENAI_API_KEY to enable")

    def voices(self):
        return [Voice(v, v.title(), self.name) for v in ["onyx", "echo", "fable", "alloy", "nova", "shimmer", "ash", "ballad", "coral", "sage"]]

    def synthesize(self, text, voice, speed):
        data = _http_post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            payload={
                "model": os.environ.get("OPENAI_TTS_MODEL", "tts-1-hd"),
                "voice": voice,
                "input": text,
                "response_format": "wav",
                "speed": speed,
            },
        )
        return _decode_audio(data)


class ElevenLabsProvider(Provider):
    name = "elevenlabs"
    paid = True
    usd_per_million_chars = 180.0  # rough pay-as-you-go equivalent; plans vary widely

    def available(self):
        return (bool(os.environ.get("ELEVENLABS_API_KEY")), "Set ELEVENLABS_API_KEY to enable")

    def voices(self):
        custom = os.environ.get("ELEVENLABS_VOICE_IDS", "")
        pairs = [p.split(":", 1) for p in custom.split(",") if ":" in p]
        return [Voice(i, n, self.name) for n, i in pairs] or [Voice("pNInz6obpgDQGcFmaJgB", "Adam (default)", self.name)]

    def synthesize(self, text, voice, speed):
        sr = 24000
        data = _http_post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_{sr}",
            headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
            payload={"text": text, "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"), "voice_settings": {"speed": speed}},
        )
        return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768, sr


class GoogleProvider(Provider):
    name = "google"
    paid = True
    usd_per_million_chars = 16.0  # Neural2/WaveNet list price at time of writing

    def available(self):
        return (bool(os.environ.get("GOOGLE_TTS_API_KEY")), "Set GOOGLE_TTS_API_KEY to enable")

    def voices(self):
        return [Voice(v, v, self.name) for v in ["en-US-Neural2-J", "en-US-Neural2-D", "en-GB-Neural2-B", "en-US-Neural2-F"]]

    def synthesize(self, text, voice, speed):
        raw = _http_post(
            f"https://texttospeech.googleapis.com/v1/text:synthesize?key={os.environ['GOOGLE_TTS_API_KEY']}",
            headers={},
            payload={
                "input": {"text": text},
                "voice": {"languageCode": "-".join(voice.split("-")[:2]), "name": voice},
                "audioConfig": {"audioEncoding": "LINEAR16", "speakingRate": speed},
            },
        )
        return _decode_audio(base64.b64decode(json.loads(raw)["audioContent"]))


PROVIDERS: dict[str, Provider] = {p.name: p for p in [KokoroProvider(), PiperProvider(), OpenAIProvider(), ElevenLabsProvider(), GoogleProvider()]}


def get_provider(name: str | None) -> Provider:
    name = name or settings.tts_provider
    if name not in PROVIDERS:
        raise TTSError(f"Unknown TTS provider '{name}'. Choose from: {', '.join(PROVIDERS)}")
    return PROVIDERS[name]


def resolve_provider(name: str | None) -> Provider:
    """Requested provider if usable, else fall back to the first free local one."""
    p = get_provider(name)
    ok, why = p.available()
    if ok:
        return p
    log.warning("TTS provider %s unavailable (%s); falling back", p.name, why)
    for fallback in ("kokoro", "piper"):
        fp = PROVIDERS[fallback]
        if fp.available()[0]:
            return fp
    raise TTSError(f"No TTS provider available: {why}")


def provider_status() -> list[dict]:
    out = []
    for p in PROVIDERS.values():
        ok, why = p.available()
        out.append(
            {
                "name": p.name,
                "paid": p.paid,
                "available": ok,
                "reason": why,
                "voices": [v.__dict__ for v in p.voices()] if ok else [],
                "defaultVoice": p.default_voice() if ok else None,
                "usdPerMillionChars": p.usd_per_million_chars,
            }
        )
    return out


# ------------------------------------------------------------------- pronunciation


@lru_cache(maxsize=1)
def _pron_table_cached(mtime: float) -> list[tuple[re.Pattern, str]]:
    path = settings.data_dir / "pronunciations.json"
    table = json.loads(path.read_text()) if path.exists() else {}
    items = sorted(((k, v) for k, v in table.items() if not k.startswith("_")), key=lambda kv: -len(kv[0]))
    return [(re.compile(rf"(?<![\w]){re.escape(k)}(?![\w])"), v) for k, v in items]


def apply_pronunciation(text: str) -> str:
    """Swap tricky names for phonetic spellings (data/pronunciations.json)."""
    path = settings.data_dir / "pronunciations.json"
    mtime = path.stat().st_mtime if path.exists() else 0
    for pat, rep in _pron_table_cached(mtime):
        text = pat.sub(rep, text)
    return text


# ------------------------------------------------------------------------- caching


def _postprocess(x: np.ndarray, sr: int) -> np.ndarray:
    """Trim edge silence (keeping a few ms), peak-normalise to -1 dBFS."""
    if x.size == 0:
        raise TTSError("TTS returned empty audio")
    env = np.abs(x)
    thr = max(0.01, env.max() * 0.02)
    idx = np.where(env > thr)[0]
    if idx.size:
        pad = int(0.03 * sr)
        x = x[max(0, idx[0] - pad) : min(len(x), idx[-1] + pad * 2)]
    peak = np.max(np.abs(x)) or 1.0
    x = x * (0.89 / peak)
    fade = min(len(x) // 4, int(0.008 * sr))
    if fade:
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
    return x


def cache_key(provider: str, voice: str, speed: float, text: str) -> str:
    return hashlib.sha1(f"{CACHE_VERSION}|{provider}|{voice}|{speed:.3f}|{text}".encode()).hexdigest()[:20]


def synthesize(text: str, *, provider: str | None = None, voice: str | None = None, speed: float = 1.0, allow_paid: bool = True) -> Clip:
    """Synthesize (or fetch from cache) one narration line."""
    import soundfile as sf

    p = resolve_provider(provider)
    if p.paid and not allow_paid:
        raise TTSError(f"Provider {p.name} is paid; pass allow_paid=True")
    voice = voice if voice and voice in {v.id for v in p.voices()} else (settings.tts_voice if settings.tts_voice and p.name == settings.tts_provider else p.default_voice())
    spoken = apply_pronunciation(text)
    key = cache_key(p.name, voice, speed, spoken)
    rel = f"tts/{key}.wav"
    path = settings.public_dir / rel
    if path.exists():
        info = sf.info(str(path))
        return Clip(path, rel, info.frames / info.samplerate, True)
    if p.paid:
        log.info("paid TTS call provider=%s chars=%d est_usd=%.4f", p.name, len(spoken), p.estimate_cost(len(spoken)))
    samples, sr = p.synthesize(spoken, voice, speed)
    samples = _postprocess(samples, sr)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.wav")
    sf.write(str(tmp), samples, sr, subtype="PCM_16")
    tmp.replace(path)
    log.info("tts provider=%s voice=%s secs=%.2f text=%r", p.name, voice, len(samples) / sr, spoken)
    return Clip(path, rel, len(samples) / sr, False)
