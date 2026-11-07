import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { Item, Project, Track, TrackKind } from "../../src/project/types";
import { itemEnd, itemSpeed, TRACK_ACCEPTS } from "../../src/project/types";

export const uid = () => Math.random().toString(36).slice(2, 10);

// The playhead changes 30 times a second while playing. It lives outside React state so a
// frame tick re-renders only the few components that read it (playhead line, time readout,
// preview boxes, keyframe panel), not the whole editor.
let playheadFrame = 0;
const playheadListeners = new Set<() => void>();
export const playhead = {
  get: () => playheadFrame,
  set: (f: number) => {
    if (f === playheadFrame) return;
    playheadFrame = f;
    for (const l of playheadListeners) l();
  },
  subscribe: (l: () => void) => {
    playheadListeners.add(l);
    return () => void playheadListeners.delete(l);
  },
};
export const usePlayhead = () => useSyncExternalStore(playhead.subscribe, playhead.get);
// Re-renders only when `select(frame)` changes; `select` must return a primitive (or a stable string key).
export const usePlayheadSelect = <T extends string | number | boolean>(select: (frame: number) => T) =>
  useSyncExternalStore(playhead.subscribe, () => select(playhead.get()));

type History = { past: Project[]; present: Project; future: Project[] };

const LIMIT = 200;

// Project state with undo/redo. Gestures (drags) update live but count as one undo step;
// `merge` lets rapid edits of one field (typing) collapse into one step too.
export const useProjectHistory = (initial: Project) => {
  const [h, setH] = useState<History>({ past: [], present: initial, future: [] });
  const gesture = useRef<Project | null>(null);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);

  const reset = useCallback((p: Project) => {
    gesture.current = null;
    setH({ past: [], present: p, future: [] });
  }, []);

  const mutate = useCallback((fn: (draft: Project) => void, opts: { merge?: string } = {}) => {
    setH((cur) => {
      const next = structuredClone(cur.present);
      fn(next);
      const now = Date.now();
      const merging = opts.merge && lastMerge.current?.key === opts.merge && now - lastMerge.current.at < 1500;
      lastMerge.current = opts.merge ? { key: opts.merge, at: now } : null;
      return {
        past: merging ? cur.past : [...cur.past, cur.present].slice(-LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const beginGesture = useCallback(() => {
    setH((cur) => {
      gesture.current = cur.present;
      return cur;
    });
  }, []);

  const updateGesture = useCallback((fn: (draft: Project) => void) => {
    setH((cur) => {
      if (!gesture.current) return cur;
      const next = structuredClone(gesture.current);
      fn(next);
      return { ...cur, present: next };
    });
  }, []);

  const endGesture = useCallback(() => {
    setH((cur) => {
      const base = gesture.current;
      gesture.current = null;
      if (!base || JSON.stringify(base) === JSON.stringify(cur.present)) return cur;
      lastMerge.current = null;
      return { past: [...cur.past, base].slice(-LIMIT), present: cur.present, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setH((cur) => (cur.past.length ? { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1], future: [cur.present, ...cur.future] } : cur));
  }, []);
  const redo = useCallback(() => {
    setH((cur) => (cur.future.length ? { past: [...cur.past, cur.present], present: cur.future[0], future: cur.future.slice(1) } : cur));
  }, []);

  return {
    project: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    reset,
    mutate,
    beginGesture,
    updateGesture,
    endGesture,
    undo,
    redo,
  };
};

export type ProjectApi = ReturnType<typeof useProjectHistory>;

export const findItem = (p: Project, id: string | null): { track: Track; item: Item; index: number } | null => {
  if (!id) return null;
  for (const track of p.tracks) {
    const index = track.items.findIndex((i) => i.id === id);
    if (index !== -1) return { track, item: track.items[index], index };
  }
  return null;
};

export const kindForItem = (type: Item["type"]): TrackKind =>
  (Object.keys(TRACK_ACCEPTS) as TrackKind[]).find((k) => TRACK_ACCEPTS[k].includes(type))!;

export const TRACK_LABEL: Record<TrackKind, string> = { visual: "Hình", text: "Chữ", audio: "Âm thanh" };

// Returns the track to put a new item of `type` on, creating one if needed. Mutates the draft.
export const trackFor = (p: Project, type: Item["type"], preferredId?: string): Track => {
  const kind = kindForItem(type);
  const preferred = p.tracks.find((t) => t.id === preferredId && t.kind === kind);
  if (preferred) return preferred;
  const existing = p.tracks.find((t) => t.kind === kind);
  if (existing) return existing;
  const count = p.tracks.filter((t) => t.kind === kind).length + 1;
  const track: Track = { id: uid(), kind, name: `${TRACK_LABEL[kind]} ${count}`, items: [] };
  // Text above pictures, sound at the bottom, like CapCut.
  if (kind === "audio") p.tracks.push(track);
  else if (kind === "text") p.tracks.unshift(track);
  else {
    const firstAudio = p.tracks.findIndex((t) => t.kind === "audio");
    p.tracks.splice(firstAudio === -1 ? p.tracks.length : firstAudio, 0, track);
  }
  return track;
};

// Length of the source media behind an item, if it has one (for trimming limits).
export const sourceLength = (p: Project, item: Item, compositionLength: (id: string) => number | undefined) => {
  if (item.type === "composition") return compositionLength(item.compositionId);
  if (item.type === "video" || item.type === "audio") return p.assets.find((a) => a.id === item.assetId)?.durationInFrames;
  return undefined;
};

// Splits an item (in the draft) at each timeline frame in `cuts`. Returns the ids of all pieces.
export const splitItemAt = (p: Project, id: string, cuts: number[]): string[] => {
  const ids = [id];
  let currentId = id;
  for (const at of [...cuts].sort((a, b) => a - b)) {
    const f = findItem(p, currentId);
    if (!f) break;
    const { track, item, index } = f;
    if (at <= item.from || at >= itemEnd(item)) continue;
    const cut = at - item.from;
    const right = { ...structuredClone(item), id: uid(), from: at, durationInFrames: item.durationInFrames - cut };
    if ("trimStart" in right && "trimStart" in item) right.trimStart = item.trimStart + Math.round(cut * itemSpeed(item));
    // Keyframes belong to whichever piece they fall in.
    if (item.keyframes) {
      const left: NonNullable<Item["keyframes"]> = {};
      const rk: NonNullable<Item["keyframes"]> = {};
      for (const [prop, kfs] of Object.entries(item.keyframes) as [keyof typeof left, { frame: number; value: number }[]][]) {
        left[prop] = kfs.filter((k) => k.frame < cut);
        rk[prop] = kfs.filter((k) => k.frame >= cut).map((k) => ({ ...k, frame: k.frame - cut }));
      }
      item.keyframes = left;
      right.keyframes = rk;
    }
    item.transitionOut = undefined;
    right.transitionIn = undefined;
    item.durationInFrames = cut;
    track.items.splice(index + 1, 0, right);
    ids.push(right.id);
    currentId = right.id;
  }
  return ids;
};

export const fmtTime = (frame: number, fps: number, withFrames = false) => {
  const total = Math.max(0, frame) / fps;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const base = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return withFrames ? `${base}:${String(Math.floor(Math.max(0, frame) % fps)).padStart(2, "0")}` : base;
};
