"""Normalizes an exported video's loudness in place, for TikTok / Reels / Shorts.

Raw renders sit around -20 LUFS and play noticeably quieter than the rest of the feed.
Two-pass EBU R128 loudnorm to -13 LUFS integrated, -1 dBTP true peak, 48 kHz audio;
the video stream is copied untouched and the file gets +faststart.

Usage: python scripts/normalize_loudness.py out/<id>.mp4
"""

import json
import os
import pathlib
import re
import subprocess
import sys

import imageio_ffmpeg

TARGET = dict(I=-13, TP=-1, LRA=11)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def main(path):
    sys.stdout.reconfigure(encoding="utf-8")  # the Windows console code page cannot print Vietnamese
    src = pathlib.Path(path)
    spec = ":".join(f"{k}={v}" for k, v in TARGET.items())
    # Pass 1: measure.
    probe = subprocess.run([FFMPEG, "-hide_banner", "-i", str(src), "-af", f"loudnorm={spec}:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", probe.stderr)
    if not m:
        sys.exit(f"Không đo được âm lượng:\n{probe.stderr[-800:]}")
    got = json.loads(m.group(0))
    print(f"Trước: {got['input_i']} LUFS, đỉnh {got['input_tp']} dBTP")
    # Pass 2: apply with the measured values, so the gain is linear rather than pumping.
    measured = f"measured_I={got['input_i']}:measured_TP={got['input_tp']}:measured_LRA={got['input_lra']}:measured_thresh={got['input_thresh']}:offset={got['target_offset']}:linear=true"
    tmp = src.with_suffix(".loud.mp4")
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-c:v", "copy",
                    "-af", f"loudnorm={spec}:{measured}", "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(tmp)], check=True)
    os.replace(tmp, src)
    check = subprocess.run([FFMPEG, "-hide_banner", "-i", str(src), "-af", f"loudnorm={spec}:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    after = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", check.stderr).group(0))
    print(f"Sau: {after['input_i']} LUFS, đỉnh {after['input_tp']} dBTP")


if __name__ == "__main__":
    main(sys.argv[1])
