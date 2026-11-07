"""Builds projects/tap-1-doc-phan-N.json: 9:16 TikTok clips (under 60 s each) cut from episode 1,
plus out/tap-1-doc-captions.json with a suggested caption per part.

Layout for a 1080x1920 phone frame, keeping clear of TikTok's own UI
(top tabs, the right-hand buttons and the caption area at the bottom):
  - hook title at the top
  - the 16:9 episode, slightly zoomed, in the middle
  - large burned-in captions under it, 2-4 words at a time
  - "part N" tag, a teaser for the next part near the end, then a silent hold

Text stays inside the safe box measured by shorts-kit for 1080x1920: below y=212, above y=1726,
and left of x=927 from y=803 down (TikTok's button column), so centred panels are <= 774 px wide.

Usage: python scripts/make_vertical_clip.py [part numbers...]   (default: all parts)
"""

import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FPS = 30
W, H = 1080, 1920
VIDEO_Y = 900  # centre of the episode picture
VIDEO_SCALE = 1.12  # zoom past "contain" so the picture fills more of the width
CAPTION_Y = 1380
CAPTION_MAX_WORDS = 4
CAPTION_MAX_CHARS = 20  # ~64 px bold Arial: keeps a chunk inside the 774 px panel
CAPTION_SIZE = 64
HOLD = 3.5  # seconds of silent hold after the last line, so the viewer has a beat to share

TAGS = "#lichsuvietnam #hiepdinhgeneva #hoclichsu #lichsu"
# Each part: hook shown at the top, (start, end) segments in episode-1 seconds played back to back,
# the teaser shown over the last seconds, and a suggested caption.
PARTS = {
    1: dict(
        hook="Thắng trận mà lại\nbị chia đôi?",
        segments=[
            (14.95, 19.95),  # "Thắng trận mà lại bị chia đôi? Nghe có gì đó sai sai…"
            (152.9, 190.3),  # the 13th vs 18th parallel tug-of-war, settled at the 17th
            (203.1, 209.6),  # "the 17th parallel was only a temporary military line"
        ],
        teaser="Phần 2: lời hứa 1956\n👉 Theo dõi để xem tiếp",
        caption=f"Thắng trận mà lại bị chia đôi? 🤔 Phần 1: cuộc giằng co vĩ tuyến 13 hay 18 ở Giơnevơ 1954. {TAGS}",
    ),
    2: dict(
        hook="Hiệp định Giơnevơ\nđã hứa những gì?",
        segments=[(191.0, 238.6)],  # the four main points, and who refused the final declaration
        teaser="Phần 3: cuộc chia ly\n👉 Theo dõi để xem tiếp",
        caption=f"Hiệp định Giơnevơ 1954 hứa gì với Việt Nam? Và ai không chịu tán thành? 📜 Phần 2. {TAGS}",
    ),
    3: dict(
        hook="Hẹn nhau 2 năm,\nchờ hơn 20 năm",
        segments=[(243.9, 300.4)],  # the 300 days of regrouping, then Ngô Đình Diệm and the 98.2% referendum
        teaser="Phần 4: bầu cử 1956\n👉 Theo dõi để xem tiếp",
        caption=f"Gần một triệu người di cư, những cuộc chia ly hẹn 2 năm mà kéo dài hơn 20 năm 💔 Phần 3. {TAGS}",
    ),
    4: dict(
        hook="Vì sao tổng tuyển cử\n1956 không diễn ra?",
        segments=[(301.0, 333.4)],  # 1956: the refusal, and Eisenhower's 80% estimate
        teaser="Phần 5: Mỹ vào cuộc\n👉 Theo dõi để xem tiếp",
        caption=f"Theo hiệp định, năm 1956 phải tổng tuyển cử thống nhất đất nước. Vì sao nó không bao giờ diễn ra? 🗳️ Phần 4. {TAGS}",
    ),
    5: dict(
        hook="Từ “chỉ ngồi xem”\nđến đổ quân",
        segments=[(361.2, 391.9), (392.5, 407.5)],  # US advisers to the Da Nang landing, then the summary
        teaser="Tập 2: Chiến tranh cục bộ\n👉 Theo dõi kênh để xem",
        caption=f"Từ “chỉ ngồi xem” ở Giơnevơ đến đổ quân vào Đà Nẵng năm 1965. Phần 5, hết tập 1. {TAGS}",
    ),
}

f = lambda s: round(s * FPS)
timing = json.loads((ROOT / "src/geneva/timing.json").read_text(encoding="utf-8"))
subs = [
    (sc["start"] + ln["start"] + sb["start"], sc["start"] + ln["start"] + sb["end"], sb["text"])
    for sc in timing["scenes"]
    for ln in sc["lines"]
    for sb in ln["subs"]
]


# Vietnamese words are written syllable by syllable, so "cố vấn" looks like two words.
# Syllable pairs that recur across the episode scripts are most likely compound words:
# the caption split avoids cutting between them.
_corpus = " ".join(t for _, _, t in subs)
for script in (ROOT / "kich-ban").glob("*.txt"):
    _corpus += " " + script.read_text(encoding="utf-8")
_syl = re.findall(r"\w+", _corpus.lower())
PAIRS = {}
for a, b in zip(_syl, _syl[1:]):
    PAIRS[(a, b)] = PAIRS.get((a, b), 0) + 1


def split_phrase(words):
    """Cheapest cut of a phrase into 2-4 word chunks: avoid cutting inside a recurring
    syllable pair, avoid one-word chunks, never exceed the width limit."""
    key = [re.sub(r"\W", "", w.lower()) for w in words]
    n = len(words)
    best = [0.0] + [math.inf] * n
    back = [0] * (n + 1)
    for j in range(1, n + 1):
        for i in range(max(0, j - CAPTION_MAX_WORDS - 1), j):
            size = j - i
            if size > CAPTION_MAX_WORDS + 1 or (size > 1 and len(" ".join(words[i:j])) > CAPTION_MAX_CHARS):
                continue
            cost = best[i] + (4 if size == 1 and n > 1 else 0) + (1.5 if size == CAPTION_MAX_WORDS + 1 else 0)
            if j < n:
                cost += PAIRS.get((key[j - 1], key[j]), 0) ** 0.5
            if cost < best[j]:
                best[j], back[j] = cost, i
    pieces, j = [], n
    while j > 0:
        pieces.append(words[back[j]:j])
        j = back[j]
    return pieces[::-1]


def chunks(text, start, end):
    """Splits one subtitle line into 2-4 word captions that follow the ear.

    The voice has sentence timings only, so each chunk gets a share of the line's time
    in proportion to its syllables (one Vietnamese word is one syllable), plus a little
    extra after punctuation, where the voice pauses."""
    # Break at punctuation first, then cut each phrase where it does not split a compound word.
    groups = []
    # Punctuation only ends a phrase before a space, so "98,2%" stays whole.
    for phrase in re.split(r"(?<=[,.?!;:…])\s+", text):
        words = phrase.split()
        if words:
            groups += split_phrase(words)
    # A one-word phrase ("Khoan đã." is two) joins its neighbour when that still fits.
    merged = []
    for g in groups:
        if merged and (len(g) == 1 or len(merged[-1]) == 1) and len(" ".join(merged[-1] + g)) <= CAPTION_MAX_CHARS:
            merged[-1] = merged[-1] + g
        else:
            merged.append(g)
    groups = merged
    weight = [len(g) + (0.6 if g[-1][-1] in ",.?!;:…" else 0) for g in groups]
    total, at, out = sum(weight), start, []
    for g, wt in zip(groups, weight):
        nxt = at + (end - start) * wt / total
        out.append((at, nxt, " ".join(g)))
        at = nxt
    return out


def build(part):
    cfg = PARTS[part]
    n = 0

    def uid():
        nonlocal n
        n += 1
        return f"v{part}x{n:03d}"

    def text(t, start, dur, y, size, **kw):
        item = {
            "id": uid(), "type": "text", "from": start, "durationInFrames": dur, "x": W // 2, "y": y, "text": t,
            "fontFamily": "Arial", "fontSize": size, "color": "#ffffff", "strokeColor": "#000000", "strokeWidth": 0,
            "bold": False, "background": "", "opacity": 1,
        }
        item.update(kw)
        return item

    clips, sub_items = [], []
    at = 0
    for i, (a, b) in enumerate(cfg["segments"]):
        dur = f(b) - f(a)
        clip = {
            "id": uid(), "type": "composition", "compositionId": "HiepDinhGiongevo", "from": at, "durationInFrames": dur,
            "trimStart": f(a), "hideSubtitles": True,
            "keyframes": {"scale": [{"frame": 0, "value": VIDEO_SCALE}], "offsetY": [{"frame": 0, "value": VIDEO_Y - H / 2}]},
        }
        if i > 0:
            clip["transitionIn"] = {"type": "fade", "durationInFrames": 8}
        clips.append(clip)
        for s0, s1, t in subs:
            if min(s1, b) - max(s0, a) < 0.3:
                continue
            for c0, c1, words in chunks(t, s0, s1):
                lo, hi = max(c0, a), min(c1, b)
                if hi - lo < 0.15:
                    continue
                sub_items.append(text(words, at + f(lo) - f(a), f(hi) - f(lo), CAPTION_Y, CAPTION_SIZE, bold=True, strokeWidth=12))
        at += dur
    speech = at

    # Silent hold: the episode keeps moving under a dimming veil, with no sound.
    last_end = cfg["segments"][-1][1]
    clips.append({
        "id": uid(), "type": "composition", "compositionId": "HiepDinhGiongevo", "from": speech, "durationInFrames": f(HOLD),
        "trimStart": f(last_end), "hideSubtitles": True, "muteAudio": True,
        "keyframes": {"scale": [{"frame": 0, "value": VIDEO_SCALE}], "offsetY": [{"frame": 0, "value": VIDEO_Y - H / 2}],
                      "opacity": [{"frame": 0, "value": 1}, {"frame": 20, "value": 0.35}]},
    })
    total = speech + f(HOLD)

    overlays = [
        text(cfg["hook"], 0, total, 330, 92, fontFamily="Patrick Hand", color="#ffd54a", strokeWidth=10,
             transitionIn={"type": "pop", "durationInFrames": 12}),
        text(f"Hiệp định Giơnevơ 1954 · Phần {part}", 0, total, 510, 44, fontFamily="Patrick Hand", color="#ffffff",
             strokeWidth=6),
        text(cfg["teaser"], speech - f(3), total - speech + f(3), 1590, 48, bold=True, color="#1d1d1d",
             background="#ffd54a", transitionIn={"type": "pop", "durationInFrames": 12}),
    ]

    project = {
        "id": f"tap-1-doc-phan-{part}",
        "name": f"Tập 1 - Giơnevơ (dọc 9:16, phần {part})",
        "fps": FPS,
        "width": W,
        "height": H,
        "assets": [],
        "tracks": [
            {"id": "t-cta", "kind": "text", "name": "Tiêu đề", "items": overlays},
            {"id": "t-sub", "kind": "text", "name": "Phụ đề", "items": sub_items},
            {"id": "t-ep", "kind": "visual", "name": "Tập 1", "items": clips},
            {"id": "t-bg", "kind": "visual", "name": "Nền", "items": [
                {"id": uid(), "type": "solid", "from": 0, "durationInFrames": total, "color": "#1b2a3a",
                 "color2": "#0d141c", "opacity": 1},
            ]},
            {"id": "t-audio", "kind": "audio", "name": "Âm thanh", "items": []},
        ],
    }
    out = ROOT / f"projects/{project['id']}.json"
    out.write_text(json.dumps(project, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{out.name}: {total / FPS:.1f}s, {len(sub_items)} subtitles")


for part in [int(a) for a in sys.argv[1:]] or PARTS:
    build(part)
captions = {f"tap-1-doc-phan-{k}": v["caption"] for k, v in PARTS.items()}
(ROOT / "out/tap-1-doc-captions.json").write_text(json.dumps(captions, ensure_ascii=False, indent=1), encoding="utf-8")
