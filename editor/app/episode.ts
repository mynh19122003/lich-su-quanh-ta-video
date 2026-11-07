// Builds a whole timeline project from a plain-text script (see EXAMPLE_SCRIPT for the format).
import type { AudioItem, EpisodeScript, ImageItem, Item, Project, SolidItem, StickerItem, TextItem, Track } from "../../src/project/types";
import { TEXT_PRESETS } from "./Library";
import shared from "./characters.json";
import { uid } from "./store";

export type Voice = { voice: string; rate: string; pitch: string };

type Character = { sticker?: string; voice: Voice };

// Speaker names -> sticker and voice, and scene backgrounds. Shared with the script page (/script).
const CHARACTERS = shared.characters as { label: string; names: string[]; sticker?: string; voice: Voice }[];
const BACKGROUNDS = shared.backgrounds as unknown as Record<string, [string, string, string]>; // colour, gradient colour, caption ink

export const characterFor = (name: string): Character => {
  const key = name.trim().toLowerCase();
  return CHARACTERS.find((c) => c.names.includes(key)) ?? CHARACTERS[0];
};

// An archive photo shown while a line is spoken: `Ảnh: photos/tap3/nixon.jpg | Richard Nixon, 1972`
// on the line before it. `src` is a path inside public/.
export type ScriptPhoto = { src: string; caption: string };
export type ScriptLine = { who: string; text: string; photo?: ScriptPhoto };
export type ScriptScene = { title: string; background: string; characters: string[]; lines: ScriptLine[] };

export const EXAMPLE_SCRIPT = `# Hà Nội, 2/9/1945 | nền: bầu trời | nhân vật: Việt Minh, Người dân
Người dẫn: Ngày 2 tháng 9 năm 1945, tại Quảng trường Ba Đình, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn độc lập.
Người dân: Độc lập rồi! Độc lập rồi!
Việt Minh: Từ hôm nay, nước Việt Nam Dân chủ Cộng hòa ra đời.

# Pháp quay lại | nền: giấy | nhân vật: Việt Minh, Pháp
Người dẫn: Nhưng chỉ ít lâu sau, người Pháp lại quay trở lại.
Pháp: Bông-giua! Tôi về rồi đây.
Việt Minh: Ai mời anh về vậy?

# Bản đồ Đông Dương | nền: bản đồ
Người dẫn: Và thế là cuộc kháng chiến chống Pháp kéo dài suốt chín năm bắt đầu.`;

export const parseScript = (src: string): ScriptScene[] => {
  const scenes: ScriptScene[] = [];
  let photo: ScriptPhoto | undefined; // waits for the next spoken line
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const [title, ...opts] = line.replace(/^#+\s*/, "").split("|").map((s) => s.trim());
      const scene: ScriptScene = { title, background: "giấy", characters: [], lines: [] };
      for (const o of opts) {
        const [k, v = ""] = o.split(":").map((s) => s.trim());
        const key = k.toLowerCase();
        if (key === "nền") scene.background = v.toLowerCase();
        if (key === "nhân vật") scene.characters = v.split(",").map((s) => s.trim()).filter(Boolean);
      }
      scenes.push(scene);
      continue;
    }
    const m = line.match(/^([^:]{1,30}):\s*(.+)$/);
    if (m && m[1].trim().toLowerCase() === "ảnh") {
      const [path, ...caption] = m[2].split("|");
      photo = { src: path.trim(), caption: caption.join("|").trim() };
      continue;
    }
    if (!scenes.length) scenes.push({ title: "", background: "giấy", characters: [], lines: [] });
    scenes[scenes.length - 1].lines.push({ ...(m ? { who: m[1].trim(), text: m[2].trim() } : { who: "Người dẫn", text: line }), ...(photo ? { photo } : {}) });
    photo = undefined;
  }
  return scenes.filter((s) => s.lines.length);
};

// Spoken text -> on-screen subtitle (undo the phonetic spellings people write for the TTS).
const SUBTITLE_FIXES: [RegExp, string][] = [
  [/Bông-giua/g, "Bonjour"],
  [/Mẹc-xi/g, "Merci"],
  [/Niu Oóc Thai/g, "New York Times"],
  [/Lainơbếch Hai/g, "Linebacker II"],
  [/Hanđơman/g, "Haldeman"],
  [/Ohaiô/g, "Ohio"],
];
const subtitleText = (t: string) => SUBTITLE_FIXES.reduce((s, [re, to]) => s.replace(re, to), t);

export type VoicedLine = { src: string; seconds: number };

// Breaks a line into subtitle-sized pieces at sentence ends, commas, then spaces.
const chunk = (text: string, max: number): string[] => {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    if (cut < max * 0.4) cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf(": "));
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
};

const LEAD = 0.5;
const GAP = 0.3;
const TAIL = 0.8;

export const buildEpisode = (
  opts: { id: string; name: string; width: number; height: number; music: boolean; script: EpisodeScript },
  scenes: ScriptScene[],
  voiced: VoicedLine[][],
): Project => {
  const fps = 30;
  const { width: W, height: H } = opts;
  const p: Project = { id: opts.id, name: opts.name, fps, width: W, height: H, assets: [], tracks: [], script: opts.script };
  const bgTrack: Track = { id: uid(), kind: "visual", name: "Nền cảnh", items: [] };
  const mapTrack: Track = { id: uid(), kind: "visual", name: "Bản đồ", items: [] };
  const photoTrack: Track = { id: uid(), kind: "visual", name: "Ảnh tư liệu", items: [] };
  const photoAssets = new Map<string, string>();
  // One track per position on stage, so characters standing side by side don't overlap on the timeline.
  const castTracks: Track[] = [];
  const castTrack = (i: number) => (castTracks[i] ??= { id: uid(), kind: "visual", name: `Nhân vật ${i + 1}`, items: [] });
  const captions: Track = { id: uid(), kind: "text", name: "Tên cảnh", items: [] };
  const subs: Track = { id: uid(), kind: "text", name: "Phụ đề", items: [] };
  const voice: Track = { id: uid(), kind: "audio", name: "Giọng đọc", items: [] };
  const music: Track = { id: uid(), kind: "audio", name: "Nhạc nền", items: [] };

  let t = 0;
  scenes.forEach((scene, si) => {
    const start = t;
    let cursor = start + Math.round(LEAD * fps);
    const lineTimes: { from: number; to: number; who: string; photo?: ScriptPhoto }[] = [];
    scene.lines.forEach((line, li) => {
      const v = voiced[si][li];
      const dur = Math.max(1, Math.round(v.seconds * fps));
      const asset = { id: uid(), kind: "audio" as const, name: `${scene.title || `Cảnh ${si + 1}`} · ${line.who}`, src: v.src, durationInFrames: dur, hidden: true };
      p.assets.push(asset);
      const clip: AudioItem = { id: uid(), type: "audio", assetId: asset.id, from: cursor, durationInFrames: dur, trimStart: 0, volume: 1 };
      voice.items.push(clip);
      const pieces = chunk(subtitleText(line.text), W < H ? 34 : 62);
      const chars = pieces.reduce((n, x) => n + x.length, 0);
      let at = cursor;
      pieces.forEach((piece, pi) => {
        const len = pi === pieces.length - 1 ? cursor + dur - at : Math.round((dur * piece.length) / chars);
        const sub: TextItem = {
          id: uid(),
          type: "text",
          from: at,
          durationInFrames: Math.max(1, len),
          x: W / 2,
          y: H - (W < H ? 260 : 90),
          ...structuredClone(TEXT_PRESETS[1].preset),
          text: piece,
          fontSize: W < H ? 44 : 46,
        };
        subs.items.push(sub);
        at += len;
      });
      lineTimes.push({ from: cursor, to: cursor + dur, who: line.who, photo: line.photo });
      cursor += dur + Math.round(GAP * fps);
    });
    const end = cursor - Math.round(GAP * fps) + Math.round(TAIL * fps);

    // Archive photos: pinned over the stage from their line's start, for at least 5 s
    // (a frame shown for less reads as "flashing by"), never past the end of the scene.
    lineTimes.forEach((l, li) => {
      if (!l.photo) return;
      let assetId = photoAssets.get(l.photo.src);
      if (!assetId) {
        assetId = uid();
        photoAssets.set(l.photo.src, assetId);
        p.assets.push({ id: assetId, kind: "image", name: l.photo.caption || l.photo.src, src: l.photo.src, hidden: true });
      }
      // Vertical: stay left of TikTok's button column (shorts-kit safe panel width, 774 px).
      const w = W < H ? Math.min(W * 0.7, 774) : W * 0.42;
      const h = w * 0.68;
      const from = l.from;
      const dur = Math.min(end - from, Math.max(l.to - from, 5 * fps));
      const photo: ImageItem = {
        id: uid(),
        type: "image",
        assetId,
        from,
        durationInFrames: dur,
        x: (W - w) / 2,
        y: W < H ? H * 0.3 : H * 0.12,
        width: w,
        height: h,
        opacity: 1,
        card: { caption: l.photo.caption, tilt: li % 2 ? 1.5 : -1.5 },
        transitionIn: { type: "pop", durationInFrames: 10 },
        transitionOut: { type: "fade", durationInFrames: 8 },
      };
      photoTrack.items.push(photo);
    });
    const len = end - start;
    const [c1, c2, ink] = BACKGROUNDS[scene.background] ?? (scene.background.startsWith("#") ? [scene.background, "", "#ffffff"] : BACKGROUNDS["giấy"]);

    const bg: SolidItem = { id: uid(), type: "solid", from: start, durationInFrames: len, color: c1, color2: c2, opacity: 1 };
    if (si > 0) bg.transitionIn = { type: "fade", durationInFrames: 10 };
    bgTrack.items.push(bg);

    if (scene.background === "bản đồ") {
      const map: StickerItem = { id: uid(), type: "sticker", sticker: "map-vn", from: start, durationInFrames: len, x: W / 2, y: H / 2, size: H * 0.92, flip: false, opacity: 1, transitionIn: { type: "fade", durationInFrames: 10 } };
      mapTrack.items.push(map);
    }

    // Characters on stage: the ones listed, plus anyone with a sticker who speaks.
    const names = [...scene.characters];
    for (const l of scene.lines) if (characterFor(l.who).sticker && !names.some((n) => characterFor(n).sticker === characterFor(l.who).sticker)) names.push(l.who);
    const cast = names.filter((n) => characterFor(n).sticker);
    cast.forEach((name, ci) => {
      const ch = characterFor(name);
      const x = (W * (ci + 1)) / (cast.length + 1);
      const s: StickerItem = {
        id: uid(),
        type: "sticker",
        sticker: ch.sticker!,
        from: start,
        durationInFrames: len,
        x,
        y: H * (W < H ? 0.55 : 0.6),
        size: Math.min(H * 0.55, (W / Math.max(2, cast.length)) * 1.1),
        flip: x > W / 2,
        opacity: 1,
        transitionIn: { type: "pop", durationInFrames: 12 },
        talkRanges: lineTimes.filter((l) => characterFor(l.who).sticker === ch.sticker).map((l) => [l.from - start, l.to - start]),
      };
      castTrack(ci).items.push(s);
    });

    if (scene.title) {
      const cap: TextItem = {
        id: uid(),
        type: "text",
        from: start,
        durationInFrames: Math.min(len, 3 * fps),
        text: `(${scene.title})`,
        fontFamily: "Patrick Hand",
        fontSize: W < H ? 50 : 56,
        color: ink,
        strokeColor: "#000000",
        strokeWidth: 0,
        bold: false,
        background: "",
        x: W / 2,
        y: 70,
        opacity: 1,
        transitionIn: { type: "fade", durationInFrames: 10 },
        transitionOut: { type: "fade", durationInFrames: 10 },
      };
      captions.items.push(cap);
    }
    t = end;
  });

  if (opts.music) {
    const asset = { id: uid(), kind: "audio" as const, name: "Nhạc nền mẫu", src: "geneva/music.wav", durationInFrames: Math.round(416 * fps) };
    p.assets.push(asset);
    let from = 0;
    // Loop the sample music if the episode is longer than it.
    while (from < t) {
      const dur = Math.min(asset.durationInFrames, t - from);
      const clip: Item = { id: uid(), type: "audio", assetId: asset.id, from, durationInFrames: dur, trimStart: 0, volume: 0.14, fadeOut: from + dur >= t ? 45 : 0 };
      music.items.push(clip);
      from += dur;
    }
  }

  p.tracks = [subs, captions, ...(photoTrack.items.length ? [photoTrack] : []), ...castTracks.filter(Boolean), ...(mapTrack.items.length ? [mapTrack] : []), bgTrack, voice, ...(opts.music ? [music] : [])];
  return p;
};
