"""Synthesizes the episode's background music into public/geneva/music.wav.

Follows the scene moods in src/geneva/timing.json:
  light - bouncy pizzicato in C major
  tense - low pulsing D minor with timpani
  sad   - slow piano in A minor
Each scene's section is crossfaded into the next.

Run: python scripts/geneva_music.py   (after scripts/geneva_voice.py)
"""

import json
import pathlib
import wave

import numpy as np

SR = 44100
ROOT = pathlib.Path(__file__).resolve().parent.parent
TIMING = ROOT / "src" / "geneva" / "timing.json"
OUT = ROOT / "public" / "geneva" / "music.wav"
XFADE = 0.8

timing = json.loads(TIMING.read_text(encoding="utf-8"))
total = timing["total"] + 2.0
mix = np.zeros((int(total * SR), 2))


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def tone(note: float, length: float, decay: float, harmonics=(1, 0.4, 0.15)) -> np.ndarray:
    t = np.arange(int(length * SR)) / SR
    f = midi(note)
    sig = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harmonics))
    env = np.exp(-t * decay)
    att = min(len(t), int(0.006 * SR))
    env[:att] *= np.linspace(0, 1, att)
    return sig * env


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float, pan: float = 0.0) -> None:
    i = int(at * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i] * gain
    buf[i : i + len(sig), 0] += sig * (1 - pan) / 2
    buf[i : i + len(sig), 1] += sig * (1 + pan) / 2


def light(length: float) -> np.ndarray:
    buf = np.zeros((int(length * SR), 2))
    beat = 60 / 112
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]  # C Am F G
    bass = [36, 33, 29, 31]
    melody = [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 72, 71, 67, 69, 71]
    n = 0
    t = 0.0
    while t < length:
        bar = int(t / (beat * 4)) % 4
        place(buf, tone(bass[bar], 0.5, 6), t, 0.55, -0.1)
        if n % 2 == 1:
            for k, note in enumerate(chords[bar]):
                place(buf, tone(note, 0.3, 14), t, 0.16, -0.4 + k * 0.4)
        place(buf, tone(melody[n % 16], 0.35, 9, (1, 0.25, 0.1)), t, 0.2 if n % 4 != 3 else 0.0, 0.35)
        t += beat
        n += 1
    return buf


def tense(length: float) -> np.ndarray:
    buf = np.zeros((int(length * SR), 2))
    t_all = np.arange(len(buf)) / SR
    drone = sum(np.sin(2 * np.pi * midi(n) * t_all) for n in (38, 45, 50)) / 3
    drone *= 0.18 * (1 + 0.3 * np.sin(2 * np.pi * 0.2 * t_all))
    buf[:, 0] += drone
    buf[:, 1] += drone
    beat = 60 / 96
    t = 0.0
    n = 0
    while t < length:
        place(buf, tone(38 if n % 8 < 6 else 41, 0.4, 8, (1, 0.5, 0.2)), t, 0.35)
        if n % 8 == 0:
            p = np.arange(int(1.8 * SR)) / SR
            boom = np.sin(2 * np.pi * np.cumsum(midi(33) * (1 + 0.05 * np.exp(-p * 10))) / SR) * np.exp(-p * 2.2)
            place(buf, boom, t, 0.45)
        if n % 4 == 2:
            place(buf, tone(62 + (n // 8) % 2 * 3, 0.6, 5), t, 0.1, 0.4)
        t += beat
        n += 1
    return buf


def sad(length: float) -> np.ndarray:
    buf = np.zeros((int(length * SR), 2))
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59]]  # Am F C E
    t = 0.0
    bar = 0
    while t < length:
        chord = chords[bar % 4]
        place(buf, tone(chord[0] - 12, 3.2, 0.9), t, 0.4, -0.2)
        for k, note in enumerate([chord[0], chord[1], chord[2], chord[1] + 12]):
            place(buf, tone(note + 12, 2.0, 1.6, (1, 0.3, 0.1)), t + k * 0.55, 0.2, 0.3)
        t += 2.4
        bar += 1
    return buf


MAKERS = {"light": light, "tense": tense, "sad": sad}

# Merge consecutive scenes with the same mood so the music doesn't restart.
sections = []
for s in timing["scenes"]:
    if sections and sections[-1]["mood"] == s["mood"]:
        sections[-1]["end"] = s["start"] + s["duration"]
    else:
        sections.append({"mood": s["mood"], "start": s["start"], "end": s["start"] + s["duration"]})
sections[-1]["end"] = total

for sec in sections:
    start = max(0.0, sec["start"] - XFADE / 2)
    length = sec["end"] - start + XFADE / 2
    part = MAKERS[sec["mood"]](length)
    fade = int(XFADE * SR)
    part[:fade] *= np.linspace(0, 1, fade)[:, None]
    part[-fade:] *= np.linspace(1, 0, fade)[:, None]
    i = int(start * SR)
    end = min(len(mix), i + len(part))
    mix[i:end] += part[: end - i]

for delay, g in ((0.09, 0.2), (0.21, 0.12)):
    d = int(delay * SR)
    mix[d:] += mix[:-d] * g

mix /= np.max(np.abs(mix)) / 0.89
OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", OUT, f"{total:.1f}s", [s["mood"] for s in sections])
