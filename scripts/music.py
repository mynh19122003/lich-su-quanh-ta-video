"""Synthesizes the background score into public/music.wav.

A slow, solemn D-minor piece (pads + soft piano arpeggios) with a timpani hit at
each scene start, resolving to D major for the final scene.

Run: python scripts/music.py
"""

import pathlib
import wave

import numpy as np

SR = 44100
DURATION = 52.0
# Scene start times in seconds (see src/timeline.ts).
SCENE_STARTS = [0.0, 7.57, 16.20, 23.63, 32.17, 40.30]
FINALE = SCENE_STARTS[-1]

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "music.wav"

t_all = np.arange(int(SR * DURATION)) / SR
left = np.zeros_like(t_all)
right = np.zeros_like(t_all)


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig: np.ndarray, start: float, pan: float = 0.0) -> None:
    i = int(start * SR)
    end = min(len(t_all), i + len(sig))
    sig = sig[: end - i]
    left[i:end] += sig * (1 - pan) / 2
    right[i:end] += sig * (1 + pan) / 2


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n)
    a = min(int(attack * SR), n // 2)
    r = min(int(release * SR), n // 2)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] *= np.linspace(1, 0, r)
    return env


def pad(notes: list[int], start: float, length: float, gain: float) -> None:
    t = np.arange(int(length * SR)) / SR
    sig = np.zeros_like(t)
    for n in notes:
        f = midi(n)
        for detune in (-0.12, 0.0, 0.12):
            ff = f * 2 ** (detune / 12)
            # A few soft harmonics: warm string-like pad.
            sig += np.sin(2 * np.pi * ff * t) + 0.35 * np.sin(4 * np.pi * ff * t) + 0.12 * np.sin(6 * np.pi * ff * t)
    sig *= envelope(len(t), 1.2, 1.5) * gain / (len(notes) * 3)
    sig *= 1 + 0.08 * np.sin(2 * np.pi * 0.25 * t)
    add(sig, start, pan=-0.2)
    add(sig * 0.9, start + 0.015, pan=0.2)


def piano(note: int, start: float, gain: float) -> None:
    length = 2.5
    t = np.arange(int(length * SR)) / SR
    f = midi(note)
    sig = (
        np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
        + 0.5 * np.sin(4 * np.pi * f * t) * np.exp(-t * 3.5)
        + 0.25 * np.sin(6 * np.pi * f * t) * np.exp(-t * 5)
        + 0.1 * np.sin(8 * np.pi * f * t) * np.exp(-t * 7)
    )
    sig *= envelope(len(t), 0.004, 0.3) * gain
    add(sig, start, pan=0.3 if note > 64 else -0.1)


def timpani(start: float, gain: float) -> None:
    length = 2.8
    t = np.arange(int(length * SR)) / SR
    f = midi(38) * (1 + 0.04 * np.exp(-t * 12))
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = (np.sin(phase) + 0.4 * np.sin(1.5 * phase)) * np.exp(-t * 1.6)
    rng = np.random.default_rng(int(start * 100))
    sig += rng.standard_normal(len(t)) * np.exp(-t * 30) * 0.15
    add(sig * envelope(len(t), 0.002, 0.4) * gain, start)


# Chords as MIDI notes: i - VI - III - VII in D minor, 4 seconds each.
MINOR = [
    [50, 57, 62, 65],  # Dm
    [46, 53, 58, 62],  # Bb
    [41, 53, 57, 60],  # F
    [48, 55, 60, 64],  # C
]
# Finale: Bb - C - D major.
FINALE_CHORDS = [
    ([46, 53, 58, 62], 2.6),
    ([48, 55, 60, 64], 2.6),
    ([50, 57, 62, 66, 69], DURATION - FINALE - 5.2),
]

CHORD_LEN = 4.0
t = 0.0
i = 0
while t < FINALE - 0.01:
    length = min(CHORD_LEN, FINALE - t)
    chord = MINOR[i % 4]
    pad(chord, t, length + 1.2, 0.5)
    # Arpeggio enters after the title scene, rising a little in intensity.
    if t >= SCENE_STARTS[1] - 0.5:
        intensity = 0.16 + 0.08 * (t / FINALE)
        arp = [chord[1] + 12, chord[2] + 12, chord[3] + 12, chord[2] + 12]
        for k in range(int(length / 0.5)):
            piano(arp[k % 4], t + k * 0.5, intensity)
    t += length
    i += 1

ft = FINALE
for chord, length in FINALE_CHORDS:
    pad(chord, ft, length + 1.2, 0.6)
    arp = [chord[1] + 12, chord[2] + 12, chord[3] + 12, chord[-1] + 12]
    for k in range(int(min(length, 6) / 0.5)):
        piano(arp[k % len(arp)], ft + k * 0.5, 0.26)
    ft += length

for s in SCENE_STARTS[1:]:
    timpani(s, 0.55)
timpani(FINALE + 5.2, 0.8)

# Simple room: a few decaying echoes.
for delay, g in ((0.11, 0.25), (0.23, 0.15), (0.37, 0.08)):
    d = int(delay * SR)
    left[d:] += left[:-d] * g
    right[d:] += right[:-d] * g * 0.9

stereo = np.stack([left, right], axis=1)
fade = int(2.5 * SR)
stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
stereo /= np.max(np.abs(stereo)) / 0.89

OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print("wrote", OUT)
