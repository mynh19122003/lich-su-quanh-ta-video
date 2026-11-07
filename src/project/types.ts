// A timeline project: tracks of clips, edited in the editor app and rendered by ProjectVideo.

export type AssetKind = "video" | "image" | "audio";

export type Asset = {
  id: string;
  kind: AssetKind;
  name: string;
  // Path inside public/, used with staticFile().
  src: string;
  durationInFrames?: number;
  width?: number;
  height?: number;
  hidden?: boolean; // e.g. voice lines detached from an episode: used on the timeline, not listed in the library
};

export type TransitionType = "fade" | "slide-left" | "slide-right" | "slide-up" | "zoom" | "wipe" | "blur" | "typewriter" | "pop";

export type Transition = { type: TransitionType; durationInFrames: number };

// Properties that can be animated with keyframes; applied on top of the item's own layout.
export type AnimProp = "offsetX" | "offsetY" | "scale" | "rotate" | "opacity";
export type Keyframe = { frame: number; value: number }; // frame is relative to the item start

// Colour adjustments for anything visual; 1 / 0 are neutral.
export type Filters = {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number; // degrees
  sepia: number;
  grayscale: number;
  blur: number; // px
  vignette: number; // 0..1
};

export const NEUTRAL_FILTERS: Filters = { brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, grayscale: 0, blur: 0, vignette: 0 };

export type ChromaKey = { color: string; similarity: number; smoothness: number };

export const ANIM_DEFAULTS: Record<AnimProp, number> = { offsetX: 0, offsetY: 0, scale: 1, rotate: 0, opacity: 1 };

type ItemBase = {
  id: string;
  from: number;
  durationInFrames: number;
  transitionIn?: Transition;
  transitionOut?: Transition;
  keyframes?: Partial<Record<AnimProp, Keyframe[]>>;
  filters?: Filters;
};

export type VideoItem = ItemBase & {
  type: "video";
  assetId: string;
  trimStart: number; // in source frames
  volume: number;
  speed?: number;
  muted?: boolean; // set when its sound was detached onto an audio track
  chromaKey?: ChromaKey;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

export type ImageItem = ItemBase & {
  type: "image";
  assetId: string;
  chromaKey?: ChromaKey;
  // Shown as an archive photo card (white border, shadow, tilt) with its provenance under it.
  card?: { caption: string; tilt?: number };
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

export type AudioItem = ItemBase & {
  type: "audio";
  assetId: string;
  trimStart: number; // in source frames
  volume: number;
  speed?: number;
  fadeIn?: number; // frames
  fadeOut?: number;
};

export type TextItem = ItemBase & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bold: boolean;
  background: string; // "" for none
  x: number; // centre, in composition pixels
  y: number;
  opacity: number;
};

// One of the project's own Remotion compositions (e.g. the Geneva episode) used as a clip.
export type CompositionItem = ItemBase & {
  type: "composition";
  compositionId: string;
  trimStart: number;
  hideSubtitles?: boolean; // when its subtitles were turned into editable text clips
  muteAudio?: boolean; // when its voice and music were detached onto audio tracks
  fit?: "contain" | "cover"; // how a 16:9 episode sits in a differently shaped frame
};

// One of the project's drawings (characters, flags, map) placed like an image.
export type StickerItem = ItemBase & {
  type: "sticker";
  sticker: string;
  x: number; // centre
  y: number;
  size: number; // height in composition pixels
  flip: boolean;
  opacity: number;
  // Frames (relative to the item start) when a character sticker should move its mouth.
  talkRanges?: [number, number][];
};

// A full-frame colour or two-colour gradient, e.g. a scene background.
export type SolidItem = ItemBase & {
  type: "solid";
  color: string;
  color2: string; // "" for a flat colour
  opacity: number;
};

export type Item = VideoItem | ImageItem | AudioItem | TextItem | CompositionItem | StickerItem | SolidItem;

export type TrackKind = "visual" | "text" | "audio";

export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  hidden?: boolean;
  muted?: boolean;
  items: Item[];
};

export type Project = {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  assets: Asset[];
  // Index 0 is drawn on top, like the top row of a CapCut timeline.
  tracks: Track[];
  // Present when the project was generated from a written script (editable at /script).
  script?: EpisodeScript;
};

export type EpisodeScript = { text: string; frame: "16:9" | "9:16"; music: boolean };

export const TRACK_ACCEPTS: Record<TrackKind, Item["type"][]> = {
  visual: ["video", "image", "composition", "sticker", "solid"],
  text: ["text"],
  audio: ["audio"],
};

export const itemEnd = (item: Item) => item.from + item.durationInFrames;

export const itemSpeed = (item: Item) => ("speed" in item && item.speed ? item.speed : 1);

export const projectDuration = (p: Project) =>
  Math.max(1, ...p.tracks.flatMap((t) => t.items.map(itemEnd)));

export const emptyProject = (): Project => ({
  id: "empty",
  name: "Dự án trống",
  fps: 30,
  width: 1920,
  height: 1080,
  assets: [],
  tracks: [],
});

export const FRAME_PRESETS: { id: string; name: string; width: number; height: number }[] = [
  { id: "16:9", name: "16:9 ngang (YouTube)", width: 1920, height: 1080 },
  { id: "9:16", name: "9:16 dọc (TikTok, Reels, Shorts)", width: 1080, height: 1920 },
  { id: "1:1", name: "1:1 vuông", width: 1080, height: 1080 },
  { id: "4:5", name: "4:5 (Facebook, Instagram)", width: 1080, height: 1350 },
];
