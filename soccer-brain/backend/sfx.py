"""Procedurally synthesized sound effects and music bed.

Everything here is generated from math (sine waves, filtered noise, envelopes), so the
resulting audio is original, royalty-free, and reproducible bit-for-bit. Regenerate with:

    python -m backend.cli assets
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

SR = 44100
RNG_SEED = 1234


def _t(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def _env(n: int, attack: float, decay: float) -> np.ndarray:
    """Attack/exponential-decay envelope (times in seconds)."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-4))


def _lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """One-pole low-pass filter."""
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def _lowpass_fast(x: np.ndarray, cutoff: float) -> np.ndarray:
    """FFT brick-ish low-pass with a soft roll-off; fast for long buffers."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / (1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec, len(x))


def _highpass_fast(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - _lowpass_fast(x, cutoff)


def _norm(x: np.ndarray, peak: float = 0.89) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return x * (peak / m)


def _stereo(x: np.ndarray, width: float = 0.0, seed: int = 0) -> np.ndarray:
    if width <= 0:
        return np.stack([x, x], axis=1)
    d = int(0.011 * SR)
    r = np.concatenate([np.zeros(d), x[:-d]])
    return np.stack([x * (1 - width * 0.3) + r * width * 0.3, x * (1 - width * 0.3) + np.roll(r, d // 2) * width * 0.3], axis=1)


def _write_wav(path: Path, x: np.ndarray) -> None:
    import soundfile as sf

    path.parent.mkdir(parents=True, exist_ok=True)
    if x.ndim == 1:
        x = _stereo(x)
    sf.write(str(path), np.clip(x, -1, 1).astype(np.float32), SR, subtype="PCM_16")


# --------------------------------------------------------------------------- SFX


def tick(high: bool = False) -> np.ndarray:
    """Electronic countdown beep: a clean sine blip with a click transient."""
    f = 1320 if high else 880
    t = _t(0.32)
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) + 0.15 * np.sin(2 * np.pi * f * 3 * t)
    tone *= _env(len(t), 0.003, 0.09)
    click = np.random.default_rng(RNG_SEED).normal(0, 1, len(t)) * _env(len(t), 0.0005, 0.004)
    sub = np.sin(2 * np.pi * (f / 4) * t) * _env(len(t), 0.002, 0.05) * 0.6
    return _norm(tone + click * 0.5 + sub, 0.8)


def whoosh(seconds: float = 0.45) -> np.ndarray:
    """Filtered-noise swoosh for clue cards sliding in."""
    rng = np.random.default_rng(RNG_SEED + 1)
    n = int(seconds * SR)
    noise = rng.normal(0, 1, n)
    t = np.arange(n) / n
    # Sweep a band-pass by mixing progressively brighter low-passes.
    lo = _lowpass_fast(noise, 900)
    hi = _lowpass_fast(noise, 5200)
    sweep = lo * (1 - t) + hi * t
    sweep = _highpass_fast(sweep, 250)
    env = np.sin(np.pi * np.clip(t * 1.1, 0, 1)) ** 2
    return _norm(sweep * env, 0.55)


def riser(seconds: float = 3.0) -> np.ndarray:
    """Tension riser under the countdown: rising tone + swelling noise."""
    t = _t(seconds)
    f = 180 * (2 ** (t / seconds * 1.6))
    phase = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(phase) * 0.5 + np.sin(phase * 1.5) * 0.25 + np.sin(phase * 2) * 0.15
    noise = _highpass_fast(np.random.default_rng(RNG_SEED + 2).normal(0, 1, len(t)), 2500) * 0.25
    env = (t / seconds) ** 1.8
    return _norm((tone + noise) * env, 0.5)


def heartbeat_pulse() -> np.ndarray:
    """Low thump used on each countdown second (felt more than heard)."""
    t = _t(0.35)
    f = 70 * np.exp(-t * 6) + 45
    phase = 2 * np.pi * np.cumsum(f) / SR
    return _norm(np.sin(phase) * _env(len(t), 0.003, 0.11), 0.9)


def reveal_stinger() -> np.ndarray:
    """Big answer-reveal hit: boom + bright major chord + sparkle tail."""
    seconds = 2.4
    t = _t(seconds)
    rng = np.random.default_rng(RNG_SEED + 3)
    # Boom
    fb = 110 * np.exp(-t * 9) + 42
    boom = np.sin(2 * np.pi * np.cumsum(fb) / SR) * _env(len(t), 0.002, 0.35)
    crack = _highpass_fast(rng.normal(0, 1, len(t)), 1800) * _env(len(t), 0.001, 0.06)
    # Brass-like major chord (A major: A3 C#4 E4 A4 E5) with detuned saws
    chord = np.zeros_like(t)
    for i, f in enumerate([220.0, 277.18, 329.63, 440.0, 659.25]):
        for det in (-0.004, 0.0, 0.004):
            ff = f * (1 + det)
            saw = 2 * ((ff * t + i * 0.13) % 1) - 1
            chord += saw
    chord = _lowpass_fast(chord, 3200) / 15
    chord *= _env(len(t), 0.02, 0.9)
    # Sparkle: random high bell pings
    sparkle = np.zeros_like(t)
    for k in range(18):
        start = int((0.08 + k * 0.07 + rng.uniform(0, 0.04)) * SR)
        if start >= len(t):
            break
        f = rng.choice([1760, 2217.46, 2637.02, 3520])
        n = len(t) - start
        tt = np.arange(n) / SR
        sparkle[start:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) * (0.5 - k * 0.02)
    mix = boom * 1.0 + crack * 0.4 + chord * 0.9 + sparkle * 0.25
    return _stereo(_norm(mix, 0.92), width=0.8)


def pop() -> np.ndarray:
    """Friendly 'pop' for the outro."""
    t = _t(0.25)
    f = 500 + 900 * np.exp(-t * 30)
    return _norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.002, 0.05), 0.6)


# ------------------------------------------------------------------------- Music


def _kick(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 28) + 48
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)


def _hat(n: int, rng: np.random.Generator, open_: bool = False) -> np.ndarray:
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    return noise * np.exp(-t * (14 if open_ else 55))


def _clap(n: int, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    env = np.exp(-t * 22) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 30) * (t > 0.012)
    return noise * env


def music_bed(bars: int = 16, bpm: float = 124.0) -> np.ndarray:
    """Upbeat, light electronic sports bed (A major: A - E - F#m - D).

    Kept deliberately sparse so it sits under narration.
    """
    rng = np.random.default_rng(RNG_SEED + 10)
    beat = 60.0 / bpm
    total = int(bars * 4 * beat * SR)
    drums = np.zeros(total)
    hats = np.zeros(total)
    bass = np.zeros(total)
    keys = np.zeros(total)
    pluck = np.zeros(total)

    prog = [  # (bass root Hz, chord tones Hz)
        (110.00, [220.00, 277.18, 329.63]),  # A
        (82.41, [207.65, 246.94, 329.63]),  # E
        (92.50, [220.00, 277.18, 369.99]),  # F#m
        (73.42, [220.00, 293.66, 369.99]),  # D
    ]
    arp_pattern = [0, 1, 2, 1, 2, 1, 0, 2]

    kick_n = int(0.35 * SR)
    kick = _kick(kick_n)
    for b in range(bars * 4):
        bar = b // 4
        pos = int(b * beat * SR)
        # Intro bar: no kick for first half-bar to avoid a hard start under narration.
        if pos + kick_n <= total:
            drums[pos : pos + kick_n] += kick * 0.9
        # Off-beat hats
        hpos = int((b + 0.5) * beat * SR)
        hn = int(0.12 * SR)
        if hpos + hn <= total:
            hats[hpos : hpos + hn] += _hat(hn, rng, open_=(b % 4 == 3)) * 0.35
        # 16th ghost hats
        for q in (0.25, 0.75):
            gpos = int((b + q) * beat * SR)
            gn = int(0.05 * SR)
            if gpos + gn <= total:
                hats[gpos : gpos + gn] += _hat(gn, rng) * 0.12
        # Claps on 2 & 4
        if b % 4 in (1, 3):
            cn = int(0.25 * SR)
            if pos + cn <= total:
                drums[pos : pos + cn] += _clap(cn, rng) * 0.28
        # Bass: root on 8ths with octave bounce
        root, chord = prog[bar % 4]
        for e in range(2):
            bpos = int((b + e * 0.5) * beat * SR)
            bn = int(0.5 * beat * SR * 0.92)
            if bpos + bn > total:
                continue
            tt = np.arange(bn) / SR
            f = root * (2 if e == 1 else 1)
            wave = np.tanh(2.2 * np.sin(2 * np.pi * f * tt)) * 0.7 + np.sin(2 * np.pi * f / 2 * tt) * 0.5
            bass[bpos : bpos + bn] += wave * _env(bn, 0.004, 0.16)
        # Pluck arpeggio on 8ths
        for e in range(2):
            idx = arp_pattern[(b * 2 + e) % len(arp_pattern)]
            f = chord[idx] * 2
            ppos = int((b + e * 0.5) * beat * SR)
            pn = int(0.4 * SR)
            if ppos + pn > total:
                continue
            tt = np.arange(pn) / SR
            saw = 2 * ((f * tt) % 1) - 1
            pluck[ppos : ppos + pn] += (saw * 0.5 + np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 11)
        # Pad chords at the start of each bar
        if b % 4 == 0:
            pn = int(4 * beat * SR)
            end = min(pos + pn, total)
            tt = np.arange(end - pos) / SR
            pad = np.zeros(end - pos)
            for f in chord:
                for det in (-0.003, 0.003):
                    pad += np.sin(2 * np.pi * f * (1 + det) * tt)
            a = np.clip(tt / 0.25, 0, 1) * np.clip((tt[-1] - tt) / 0.2 + 0.0, 0, 1)
            keys[pos:end] += pad * a

    drums = np.tanh(drums * 1.2)
    hats = _highpass_fast(hats, 6000)
    bass = _lowpass_fast(bass, 700)
    pluck = _lowpass_fast(pluck, 2800)
    keys = _lowpass_fast(keys, 1500)

    mix_l = drums * 0.85 + hats * 0.9 + bass * 0.55 + pluck * 0.16 + keys * 0.06
    mix_r = drums * 0.85 + np.roll(hats, int(0.004 * SR)) * 0.9 + bass * 0.55 + np.roll(pluck, int(0.009 * SR)) * 0.16 + keys * 0.06
    stereo = np.stack([mix_l, mix_r], axis=1)
    # Short fades so loops are click-free.
    fade = int(0.01 * SR)
    stereo[:fade] *= np.linspace(0, 1, fade)[:, None]
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return np.tanh(stereo / np.max(np.abs(stereo)) * 1.1) * 0.85


# ------------------------------------------------------------------------- Build


SFX_BUILDERS = {
    "tick": lambda: tick(False),
    "tick-final": lambda: tick(True),
    "whoosh": whoosh,
    "riser": riser,
    "thump": heartbeat_pulse,
    "reveal": reveal_stinger,
    "pop": pop,
}


def build_all(public_dir: Path, force: bool = False) -> list[Path]:
    """Generate every SFX and the music bed into public/audio/."""
    out: list[Path] = []
    sfx_dir = public_dir / "audio" / "sfx"
    for name, fn in SFX_BUILDERS.items():
        p = sfx_dir / f"{name}.wav"
        if force or not p.exists():
            _write_wav(p, fn())
            log.info("generated sfx %s", p)
        out.append(p)
    music = public_dir / "audio" / "music" / "stadium-pulse.mp3"
    if force or not music.exists():
        wav = music.with_suffix(".wav")
        _write_wav(wav, music_bed())
        music.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "160k", str(music)],
            check=True,
        )
        wav.unlink()
        log.info("generated music %s", music)
    out.append(music)
    return out
