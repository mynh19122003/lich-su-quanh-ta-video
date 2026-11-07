"""Voices every line of an episode script through the editor's /api/tts (one at a time),
so the editor's episode generator then finds every line already in the voice cache.

Usage: python scripts/voice_script.py kich-ban/<script>.txt   (the editor must be running)
"""

import json
import pathlib
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "http://localhost:3100/api/tts"


def main(path):
    sys.stdout.reconfigure(encoding="utf-8")
    chars = json.loads((ROOT / "editor/app/characters.json").read_text(encoding="utf-8"))["characters"]
    voice_for = lambda who: next((c for c in chars if who.strip().lower() in c["names"]), chars[0])["voice"]
    lines = []
    for raw in pathlib.Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([^:]{1,30}):\s*(.+)$", line)
        if m and m.group(1).strip().lower() == "ảnh":
            continue  # an archive photo cue, not a spoken line
        lines.append((m.group(1).strip(), m.group(2).strip()) if m else ("Người dẫn", line))
    failed = []
    for i, (who, text) in enumerate(lines, 1):
        body = json.dumps({"text": text, **voice_for(who)}).encode()
        for attempt in range(4):
            try:
                req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json"})
                res = json.load(urllib.request.urlopen(req, timeout=120))
                print(f"{i}/{len(lines)} {res['seconds']:.1f}s {who}: {text[:50]}", flush=True)
                break
            except Exception as e:  # the TTS service drops requests now and then
                if attempt == 3:
                    failed.append(f"{who}: {text}")
                    print(f"{i}/{len(lines)} FAILED {who}: {text[:50]} ({e})", flush=True)
                time.sleep(3 * (attempt + 1))
    print(f"done, {len(failed)} failed")
    for f in failed:
        print("  " + f)


if __name__ == "__main__":
    main(sys.argv[1])
