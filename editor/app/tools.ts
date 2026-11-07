// Automatic editing tools: scene split, detaching sound, voice/music separation, subtitles.
// Each returns a draft mutation for the project history; long work happens on the server first.
import { EMBEDDABLE } from "../../src/project/compositions";
import { itemEnd, itemSpeed, type AudioItem, type Item, type Project, type TextItem, type Track } from "../../src/project/types";
import { TEXT_PRESETS } from "./Library";
import { findItem, splitItemAt, uid } from "./store";

type Mutation = (p: Project) => void;

// Timeline frame at which a given source frame of `item` plays.
const sourceToTimeline = (item: Item, sourceFrame: number) => {
  const trim = "trimStart" in item ? item.trimStart : 0;
  return Math.round(item.from + (sourceFrame - trim) / itemSpeed(item));
};

const insideItem = (item: Item, frame: number) => frame > item.from + 1 && frame < itemEnd(item) - 1;

const newTrack = (p: Project, kind: Track["kind"], name: string, position: "below" | "top" | "bottom", near?: Track): Track => {
  const t: Track = { id: uid(), kind, name, items: [] };
  if (position === "top") p.tracks.unshift(t);
  else if (position === "bottom" || !near) p.tracks.push(t);
  else p.tracks.splice(p.tracks.indexOf(near) + 1, 0, t);
  return t;
};

export const splitAtScenes = (item: Item, cutsInSourceFrames: number[]): { mutation: Mutation; count: number } => {
  const cuts = cutsInSourceFrames.map((f) => sourceToTimeline(item, f)).filter((f) => insideItem(item, f));
  return { count: cuts.length, mutation: (p) => void splitItemAt(p, item.id, cuts) };
};

export const compositionSceneCuts = (item: Item) => (item.type === "composition" ? EMBEDDABLE[item.compositionId]?.sceneStarts ?? [] : []);

// Moves a video's sound onto its own audio clip (same timing) and silences the video.
export const detachVideoAudio = (item: Item): Mutation => (p) => {
  const f = findItem(p, item.id);
  if (!f || f.item.type !== "video") return;
  const v = f.item;
  const track = newTrack(p, "audio", "Âm thanh tách", "bottom");
  track.items.push({ id: uid(), type: "audio", assetId: v.assetId, from: v.from, durationInFrames: v.durationInFrames, trimStart: v.trimStart, volume: v.volume, speed: v.speed });
  v.muted = true;
};

// Lays an episode's voice lines and music out as separate audio clips, trimmed to the clip's range.
export const detachCompositionAudio = (item: Item): Mutation => (p) => {
  const f = findItem(p, item.id);
  if (!f || f.item.type !== "composition") return;
  const c = f.item;
  const parts = EMBEDDABLE[c.compositionId]?.audioParts?.() ?? [];
  const start = c.trimStart;
  const end = c.trimStart + c.durationInFrames;
  const voice = newTrack(p, "audio", "Giọng đọc", "bottom");
  const music = newTrack(p, "audio", "Nhạc nền", "bottom");
  for (const part of parts) {
    const a = Math.max(part.from, start);
    const b = Math.min(part.from + part.durationInFrames, end);
    if (b <= a) continue;
    let asset = p.assets.find((x) => x.src === part.src);
    if (!asset) {
      asset = { id: uid(), kind: "audio", name: part.name, src: part.src, durationInFrames: part.durationInFrames, hidden: part.track === "voice" };
      p.assets.push(asset);
    }
    const clip: AudioItem = {
      id: uid(),
      type: "audio",
      assetId: asset.id,
      from: c.from + (a - start),
      durationInFrames: b - a,
      trimStart: a - part.from,
      volume: part.volume,
    };
    (part.track === "voice" ? voice : music).items.push(clip);
  }
  c.muteAudio = true;
};

// Text clips on a new "Phụ đề" track, one per segment (times in timeline frames).
const subtitleTrack = (p: Project, segments: { from: number; to: number; text: string }[]) => {
  const preset = TEXT_PRESETS[1].preset;
  const track = newTrack(p, "text", "Phụ đề", "top");
  for (const s of segments) {
    if (s.to - s.from < 2) continue;
    const text: TextItem = {
      id: uid(),
      type: "text",
      from: s.from,
      durationInFrames: s.to - s.from,
      x: p.width / 2,
      y: p.height - 90,
      ...structuredClone(preset),
      text: s.text,
      fontSize: 46,
    };
    track.items.push(text);
  }
};

export const compositionSubtitles = (item: Item): { mutation: Mutation; count: number } => {
  if (item.type !== "composition") return { mutation: () => undefined, count: 0 };
  const subs = EMBEDDABLE[item.compositionId]?.subtitles?.() ?? [];
  const start = item.trimStart;
  const end = item.trimStart + item.durationInFrames;
  const segments = subs
    .filter((s) => s.to > start && s.from < end)
    .map((s) => ({ from: item.from + Math.max(s.from, start) - start, to: item.from + Math.min(s.to, end) - start, text: s.text }));
  return {
    count: segments.length,
    mutation: (p) => {
      subtitleTrack(p, segments);
      const f = findItem(p, item.id);
      if (f?.item.type === "composition") f.item.hideSubtitles = true;
    },
  };
};

// Whisper segments are in seconds of the source file.
export const transcriptSubtitles = (item: Item, segments: { start: number; end: number; text: string }[], fps: number) => {
  const mapped = segments
    .map((s) => ({ from: sourceToTimeline(item, s.start * fps), to: sourceToTimeline(item, s.end * fps), text: s.text }))
    .map((s) => ({ ...s, from: Math.max(s.from, item.from), to: Math.min(s.to, itemEnd(item)) }))
    .filter((s) => s.to > s.from);
  return { count: mapped.length, mutation: (p: Project) => subtitleTrack(p, mapped) };
};

// Replaces a clip's sound with two clips: the isolated voice and the background music.
export const applySeparation = (item: Item, result: { vocals: string; no_vocals: string }, sourceName: string): Mutation => (p) => {
  const f = findItem(p, item.id);
  if (!f || (f.item.type !== "video" && f.item.type !== "audio")) return;
  const src = f.item;
  const original = p.assets.find((a) => a.id === src.assetId);
  const mk = (name: string, path: string) => {
    const asset = { id: uid(), kind: "audio" as const, name, src: path, durationInFrames: original?.durationInFrames };
    p.assets.push(asset);
    return asset;
  };
  const voice = mk(`Giọng - ${sourceName}`, result.vocals);
  const music = mk(`Nhạc nền - ${sourceName}`, result.no_vocals);
  const base = { from: src.from, durationInFrames: src.durationInFrames, trimStart: src.trimStart, volume: src.volume, speed: src.speed };
  newTrack(p, "audio", "Giọng (tách)", "bottom").items.push({ id: uid(), type: "audio", assetId: voice.id, ...base });
  newTrack(p, "audio", "Nhạc nền (tách)", "bottom").items.push({ id: uid(), type: "audio", assetId: music.id, ...base });
  if (src.type === "video") src.muted = true;
  else f.track.items.splice(f.index, 1);
};
