"""Voices every line of src/geneva/script.json and lays out the episode timeline.

Writes public/geneva/voice/*.mp3 and src/geneva/timing.json (all times in seconds).
Lines whose text and voice settings are unchanged are not regenerated.

Run: python scripts/geneva_voice.py
"""

import asyncio
import hashlib
import json
import pathlib
import re
import sys

import edge_tts

sys.stdout.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "src" / "geneva" / "script.json"
TIMING = ROOT / "src" / "geneva" / "timing.json"
VOICE_DIR = ROOT / "public" / "geneva" / "voice"
CACHE = VOICE_DIR / "cache.json"

SCENE_LEAD = 0.5  # silence before the first line of a scene
LINE_GAP = 0.3  # silence between lines
SCENE_TAIL = 0.7  # silence after the last line of a scene
MP3_BYTES_PER_SECOND = 48000 / 8  # edge-tts default: 24 kHz, 48 kbit/s CBR mono
MAX_SUB_CHARS = 72


async def synth(text: str, cfg: dict, out: pathlib.Path) -> list[dict]:
    """Returns sentence boundaries [{start, end, text}] in seconds."""
    for attempt in range(10):
        try:
            comm = edge_tts.Communicate(
                text, cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"], boundary="SentenceBoundary"
            )
            sentences = []
            with open(out, "wb") as f:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "SentenceBoundary":
                        start = chunk["offset"] / 1e7
                        sentences.append(
                            {"start": start, "end": start + chunk["duration"] / 1e7, "text": chunk["text"]}
                        )
            return sentences
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 9:
                raise
            print("  retry", out.name)
            await asyncio.sleep(3)
    return []


def split_long(sub: dict) -> list[dict]:
    """Breaks a long subtitle at commas or spaces, sharing its time by length."""
    text = sub["text"]
    if len(text) <= MAX_SUB_CHARS:
        return [sub]
    pieces: list[str] = []
    rest = text
    while len(rest) > MAX_SUB_CHARS:
        window = rest[:MAX_SUB_CHARS]
        cut = max(window.rfind(", "), window.rfind(": "))
        cut = cut + 1 if cut > MAX_SUB_CHARS * 0.4 else window.rfind(" ")
        pieces.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    pieces.append(rest)
    total = sum(len(p) for p in pieces)
    out, t = [], sub["start"]
    for p in pieces:
        d = (sub["end"] - sub["start"]) * len(p) / total
        out.append({"start": t, "end": t + d, "text": p})
        t += d
    return out


def subtitles_for(line: dict, sentences: list[dict], duration: float) -> list[dict]:
    shown = line.get("subtitle")
    if not sentences:
        sentences = [{"start": 0, "end": duration, "text": line["text"]}]
    if shown:
        parts = [p.strip() for p in re.split(r"(?<=[.!?…])\s+", shown) if p.strip()]
        if len(parts) == len(sentences):
            sentences = [{**s, "text": p} for s, p in zip(sentences, parts)]
        else:
            sentences = [{"start": sentences[0]["start"], "end": sentences[-1]["end"], "text": shown}]
    # Keep each subtitle up until the next one starts so they don't flicker.
    for a, b in zip(sentences, sentences[1:]):
        a["end"] = b["start"]
    sentences[-1]["end"] = max(sentences[-1]["end"], duration - 0.05)
    return [piece for s in sentences for piece in split_long(s)]


async def main() -> None:
    script = json.loads(SCRIPT.read_text(encoding="utf-8"))
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}

    scenes_out = []
    t = 0.0
    for si, scene in enumerate(script["scenes"]):
        lines_out = []
        cursor = SCENE_LEAD
        for li, line in enumerate(scene["lines"]):
            cfg = script["voices"][line["who"]]
            name = f"{si:02d}-{li:02d}.mp3"
            out = VOICE_DIR / name
            key = hashlib.sha1(json.dumps([line["text"], cfg], ensure_ascii=False).encode()).hexdigest()
            if cache.get(name, {}).get("key") == key and out.exists():
                sentences = cache[name]["sentences"]
            else:
                print("voicing", name, line["text"][:50])
                sentences = await synth(line["text"], cfg, out)
                cache[name] = {"key": key, "sentences": sentences}
                CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
            duration = out.stat().st_size / MP3_BYTES_PER_SECOND
            lines_out.append(
                {
                    "file": f"geneva/voice/{name}",
                    "who": line["who"],
                    "start": round(cursor, 3),
                    "duration": round(duration, 3),
                    "subs": [
                        {"start": round(s["start"], 3), "end": round(s["end"], 3), "text": s["text"]}
                        for s in subtitles_for(line, [dict(s) for s in sentences], duration)
                    ],
                }
            )
            cursor += duration + line.get("pause", 0) + LINE_GAP
        scene_duration = cursor - LINE_GAP + SCENE_TAIL
        scenes_out.append(
            {"id": scene["id"], "mood": scene["mood"], "start": round(t, 3), "duration": round(scene_duration, 3), "lines": lines_out}
        )
        t += scene_duration

    TIMING.write_text(
        json.dumps({"total": round(t, 3), "scenes": scenes_out}, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"total {t:.1f}s across {len(scenes_out)} scenes")
    for s in scenes_out:
        print(f"  {s['id']:<16} {s['start']:7.1f}  {s['duration']:5.1f}s  {s['mood']}")


asyncio.run(main())
