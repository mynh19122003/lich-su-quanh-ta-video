"""Voices one piece of text to an mp3, for the editor (trying lines, AI voice clips, generated episodes).

Run: python scripts/tts_once.py <out.mp3> <voice> <rate> <pitch>   (text on stdin)

The free Edge voice service sometimes returns nothing or drops the connection, so this retries
with a growing pause, and only moves a complete, non-empty file into place.
"""

import asyncio
import os
import sys

import edge_tts

sys.stdin.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ATTEMPTS = 6


async def main() -> None:
    out, voice, rate, pitch = sys.argv[1:5]
    text = sys.stdin.read().strip()
    tmp = out + ".part"
    for attempt in range(ATTEMPTS):
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, connect_timeout=15, receive_timeout=40)
            await comm.save(tmp)
            if os.path.getsize(tmp) > 0:
                os.replace(tmp, out)
                return
            raise edge_tts.exceptions.NoAudioReceived("empty audio")
        except Exception as err:  # network errors as well as NoAudioReceived
            print(f"lần {attempt + 1}: {type(err).__name__}: {err}", file=sys.stderr, flush=True)
            if os.path.exists(tmp):
                os.remove(tmp)
            if attempt == ATTEMPTS - 1:
                raise SystemExit(1)
            await asyncio.sleep(min(2 + attempt * 2, 8))


asyncio.run(main())
