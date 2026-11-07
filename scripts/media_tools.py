"""Media analysis for the timeline editor. Each command writes its result as JSON to <out.json>.

  python scripts/media_tools.py scenes     <media> <out.json>
  python scripts/media_tools.py transcribe <media> <out.json> [model]
  python scripts/media_tools.py separate   <media> <out.json>

Uses the full ffmpeg build from imageio-ffmpeg (Remotion's bundled one lacks raw muxers);
falls back to $FFMPEG or ffmpeg on PATH.
"""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8")
try:
    import imageio_ffmpeg

    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
ROOT = pathlib.Path(__file__).resolve().parent.parent
UPLOADS = ROOT / "public" / "uploads"


def log(msg: str) -> None:
    print(msg, flush=True)


def scenes(media: str) -> dict:
    """Finds hard cuts: frames whose picture differs sharply from the previous one."""
    import numpy as np

    w, h, fps = 64, 36, 15
    log("Đang đọc khung hình…")
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", media, "-vf", f"fps={fps},scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
        capture_output=True,
        check=True,
    ).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32) / 255
    if len(frames) < 3:
        return {"cuts": []}
    diff = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    threshold = max(0.1, float(diff.mean() + 4 * diff.std()))
    cuts, last = [], -1e9
    for i, d in enumerate(diff):
        t = (i + 1) / fps
        if d > threshold and t - last >= 0.6:
            cuts.append(round(t, 3))
            last = t
    log(f"Tìm thấy {len(cuts)} chỗ chuyển cảnh")
    return {"cuts": cuts}


def transcribe(media: str, model: str = "small") -> dict:
    from faster_whisper import WhisperModel

    log(f"Đang nạp mô hình Whisper ({model}), lần đầu sẽ tải về…")
    m = WhisperModel(model, device="cpu", compute_type="int8")
    import numpy as np

    # Decode with ffmpeg ourselves (16 kHz mono float) instead of faster-whisper's PyAV reader.
    pcm = subprocess.run(
        [FFMPEG, "-v", "error", "-i", media, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    log("Đang nhận dạng giọng nói…")
    segments, info = m.transcribe(audio, language="vi", vad_filter=True, beam_size=5)
    out = []
    for s in segments:
        text = s.text.strip()
        if text:
            out.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": text})
            log(f"[{s.start:6.1f}s] {text}")
    return {"segments": out, "duration": info.duration}


def separate(media: str) -> dict:
    """Splits the sound into voice and background with Demucs (htdemucs, two stems)."""
    import demucs.separate

    work = pathlib.Path(tempfile.mkdtemp(prefix="tach-tieng-"))
    try:
        wav = work / "input.wav"
        log("Đang lấy âm thanh…")
        subprocess.run([FFMPEG, "-v", "error", "-y", "-i", media, "-vn", "-ac", "2", "-ar", "44100", str(wav)], check=True)
        log("Đang tách giọng khỏi nhạc nền (Demucs)… việc này mất vài phút")
        demucs.separate.main(["--two-stems", "vocals", "-n", "htdemucs", "-o", str(work), str(wav)])
        stem_dir = work / "htdemucs" / "input"
        UPLOADS.mkdir(parents=True, exist_ok=True)
        base = pathlib.Path(media).stem
        result = {}
        for stem, suffix in (("vocals", "giong"), ("no_vocals", "nhac-nen")):
            name = f"{base}-{suffix}.wav"
            i = 2
            while (UPLOADS / name).exists():
                name = f"{base}-{suffix}-{i}.wav"
                i += 1
            shutil.copy(stem_dir / f"{stem}.wav", UPLOADS / name)
            result[stem] = f"uploads/{name}"
        log("Đã tách xong")
        return result
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> None:
    cmd, media, out = sys.argv[1:4]
    extra = sys.argv[4:]
    if cmd == "scenes":
        result = scenes(media)
    elif cmd == "transcribe":
        result = transcribe(media, *extra)
    elif cmd == "separate":
        result = separate(media)
    else:
        raise SystemExit(f"unknown command {cmd}")
    pathlib.Path(out).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
