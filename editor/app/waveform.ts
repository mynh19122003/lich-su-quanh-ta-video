import { useEffect, useState } from "react";

// Peak amplitude per 1/PEAKS_PER_SECOND of a media file, decoded in the browser and cached.
export const PEAKS_PER_SECOND = 50;
const cache = new Map<string, Promise<Float32Array | null>>();

const decode = (src: string) => {
  let p = cache.get(src);
  if (!p) {
    p = (async () => {
      try {
        const buf = await fetch("/" + src).then((r) => r.arrayBuffer());
        const ctx = new OfflineAudioContext(1, 1, 44100);
        const audio = await ctx.decodeAudioData(buf);
        const data = audio.getChannelData(0);
        const step = Math.max(1, Math.floor(audio.sampleRate / PEAKS_PER_SECOND));
        const peaks = new Float32Array(Math.ceil(data.length / step));
        let max = 0;
        for (let i = 0; i < peaks.length; i++) {
          let m = 0;
          for (let j = i * step, end = Math.min(data.length, j + step); j < end; j++) {
            const v = Math.abs(data[j]);
            if (v > m) m = v;
          }
          peaks[i] = m;
          if (m > max) max = m;
        }
        if (max > 0) for (let i = 0; i < peaks.length; i++) peaks[i] /= max;
        return peaks;
      } catch {
        return null; // e.g. a video without sound
      }
    })();
    cache.set(src, p);
  }
  return p;
};

export const usePeaks = (src: string | undefined) => {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    decode(src).then((p) => alive && setPeaks(p));
    return () => {
      alive = false;
    };
  }, [src]);
  return peaks;
};
