"""Cuts a vertical (9:16) episode generated from a script into TikTok parts.

Each part is a run of whole scenes (scene boundaries come from the "Nền cảnh" track, one
background per scene). For every part this writes projects/<out_prefix>-<n>.json with:
  - the clips of those scenes, moved to start at 0 (audio and stickers trimmed correctly)
  - the scene-title captions removed, a hook title and a "part N" tag at the top instead
  - captions re-cut to 2-4 words at a time, below the picture
  - a teaser for the next part over the last seconds, then a silent hold
Text stays inside the safe box measured by shorts-kit for 1080x1920: below y=212, above
y=1726, and centred panels <= 774 px wide (TikTok's button column starts at x=927).

Usage: python scripts/cut_vertical_parts.py <parts.json>
parts.json: {"source": "<project id>", "out_prefix": "...", "series": "...",
             "parts": [{"scenes": [0, 3], "hook": "...", "teaser": "...", "caption": "..."}]}
  "scenes" is an inclusive range of scene indexes.
"""

import copy
import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOLD = 3.5  # seconds of silent hold after the last line
CAPTION_Y = 1470  # below the characters, which stand down to about y=1350
CAPTION_SIZE = 64
CAPTION_MAX_WORDS = 4
CAPTION_MAX_CHARS = 20


def split_words(text):
    """2-4 word captions, cut at punctuation first, with no word left alone."""
    groups = []
    for phrase in re.split(r"(?<=[,.?!;:…])\s+", text):
        words = phrase.split()
        if not words:
            continue
        k = math.ceil(len(words) / CAPTION_MAX_WORDS)
        while True:
            size = math.ceil(len(words) / k)
            pieces = [words[i:i + size] for i in range(0, len(words), size)]
            if k >= len(words) or all(len(" ".join(p)) <= CAPTION_MAX_CHARS for p in pieces):
                break
            k += 1
        groups += pieces
    merged = []
    for g in groups:
        if merged and (len(g) == 1 or len(merged[-1]) == 1) and len(" ".join(merged[-1] + g)) <= CAPTION_MAX_CHARS:
            merged[-1] = merged[-1] + g
        else:
            merged.append(g)
    return [" ".join(g) for g in merged]


def main(cfg_path):
    cfg = json.loads(pathlib.Path(cfg_path).read_text(encoding="utf-8"))
    src = json.loads((ROOT / f"projects/{cfg['source']}.json").read_text(encoding="utf-8"))
    fps, W, H = src["fps"], src["width"], src["height"]
    track = {t["name"]: t for t in src["tracks"]}
    scenes = sorted(track["Nền cảnh"]["items"], key=lambda i: i["from"])
    n_parts = len(cfg["parts"])
    summary = []

    for n, part in enumerate(cfg["parts"], 1):
        s0, s1 = part["scenes"]
        a = scenes[s0]["from"]
        b = scenes[s1]["from"] + scenes[s1]["durationInFrames"]
        hold = round(HOLD * fps)
        total = b - a + hold
        ids = 0

        def uid():
            nonlocal ids
            ids += 1
            return f"p{n}x{ids:04d}"

        def text(t, start, dur, y, size, **kw):
            item = {"id": uid(), "type": "text", "from": start, "durationInFrames": dur, "x": W // 2, "y": y, "text": t,
                    "fontFamily": "Arial", "fontSize": size, "color": "#ffffff", "strokeColor": "#000000",
                    "strokeWidth": 0, "bold": False, "background": "", "opacity": 1}
            item.update(kw)
            return item

        tracks = []
        for t in src["tracks"]:
            if t["name"] in ("Tên cảnh", "Phụ đề", "Nhạc nền"):
                continue
            items = []
            for it in t["items"]:
                lo, hi = max(it["from"], a), min(it["from"] + it["durationInFrames"], b)
                if hi <= lo:
                    continue
                c = copy.deepcopy(it)
                c["id"] = uid()
                cut_head = lo - it["from"]
                c["from"] = lo - a
                c["durationInFrames"] = hi - lo
                if cut_head and "trimStart" in c:
                    c["trimStart"] += cut_head
                if cut_head:
                    c.pop("transitionIn", None)
                if c.get("talkRanges"):
                    c["talkRanges"] = [[max(0, x - cut_head), y - cut_head] for x, y in c["talkRanges"] if y - cut_head > 0]
                if c["from"] == 0:
                    c.pop("transitionIn", None)
                items.append(c)
            # The background and the stage hold through the silent ending.
            if t["name"] in ("Nền cảnh", "Bản đồ") or t["name"].startswith("Nhân vật"):
                for c in items:
                    if c["from"] + c["durationInFrames"] == b - a:
                        c["durationInFrames"] += hold
            tracks.append({**t, "id": uid(), "items": items})

        # Music: the episode's music bed under the part, faded out before the silent hold.
        if "Nhạc nền" in track:
            m = []
            for it in track["Nhạc nền"]["items"]:
                lo, hi = max(it["from"], a), min(it["from"] + it["durationInFrames"], b)
                if hi <= lo:
                    continue
                c = copy.deepcopy(it)
                c.update(id=uid(), **{"from": lo - a, "durationInFrames": hi - lo, "trimStart": it.get("trimStart", 0) + lo - it["from"]})
                c["fadeOut"] = round(1.5 * fps) if hi == b else 0
                m.append(c)
            tracks.append({**track["Nhạc nền"], "id": uid(), "items": m})

        # Captions: re-cut every subtitle piece into 2-4 word chunks, timed by length.
        caps = []
        for sub in track["Phụ đề"]["items"]:
            lo, hi = max(sub["from"], a), min(sub["from"] + sub["durationInFrames"], b)
            if hi <= lo:
                continue
            chunks = split_words(sub["text"])
            weight = [len(c) + (3 if c[-1] in ",.?!;:…" else 0) for c in chunks]
            at = sub["from"]
            for c, w in zip(chunks, weight):
                d = sub["durationInFrames"] * w / sum(weight)
                c0, c1 = max(round(at), a), min(round(at + d), b)
                if c1 - c0 >= 3:
                    caps.append(text(c, c0 - a, c1 - c0, CAPTION_Y, CAPTION_SIZE, bold=True, strokeWidth=12))
                at += d

        series = cfg.get("series", "")
        overlays = [
            text(part["hook"], 0, total, 330, 88, fontFamily="Patrick Hand", color="#ffd54a", strokeWidth=10,
                 transitionIn={"type": "pop", "durationInFrames": 12}),
            text(f"{series} · Phần {n}/{n_parts}" if series else f"Phần {n}/{n_parts}", 0, total, 505, 42,
                 fontFamily="Patrick Hand", color="#ffffff", strokeWidth=6),
        ]
        if part.get("teaser"):
            overlays.append(text(part["teaser"], b - a - round(3 * fps), round(3 * fps) + hold, 1610, 48, bold=True,
                                 color="#1d1d1d", background="#ffd54a", transitionIn={"type": "pop", "durationInFrames": 12}))

        pid = f"{cfg['out_prefix']}-{n}"
        project = {"id": pid, "name": f"{cfg.get('name_prefix', pid)} · phần {n}", "fps": fps, "width": W, "height": H,
                   "assets": src["assets"],
                   "tracks": [{"id": uid(), "kind": "text", "name": "Tiêu đề", "items": overlays},
                              {"id": uid(), "kind": "text", "name": "Phụ đề", "items": caps}] + tracks}
        (ROOT / f"projects/{pid}.json").write_text(json.dumps(project, ensure_ascii=False, indent=1), encoding="utf-8")
        summary.append({"id": pid, "seconds": round(total / fps, 1), "scenes": [s0, s1], "caption": part.get("caption", "")})
        print(f"{pid}: {total / fps:.1f}s, scenes {s0}-{s1}, {len(caps)} captions")

    out = ROOT / f"out/{cfg['out_prefix']}-captions.json"
    out.write_text(json.dumps({s["id"]: s["caption"] for s in summary}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
