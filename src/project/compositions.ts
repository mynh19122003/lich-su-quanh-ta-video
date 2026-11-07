import type React from "react";
import { GENEVA_MUSIC_VOLUME, GenevaVideo } from "../geneva/GenevaVideo";
import { SCENES as GENEVA_SCENES, TOTAL_FRAMES as GENEVA_FRAMES } from "../geneva/timeline";
import { HistoryVideo } from "../HistoryVideo";
import { SCENE_FRAMES, TOTAL_FRAMES as HISTORY_FRAMES, TRANSITION_FRAMES } from "../timeline";

export type AudioPart = { name: string; src: string; from: number; durationInFrames: number; volume: number; track: "voice" | "music" };
export type SubtitlePart = { from: number; to: number; text: string };

type Embeddable = {
  name: string;
  component: React.FC<{ showSubtitles?: boolean; audio?: boolean }>;
  durationInFrames: number;
  width: number;
  height: number;
  // Frames where a new scene begins (used by "auto split by scene").
  sceneStarts: number[];
  // Present when the editor can take the composition's sound / subtitles apart.
  audioParts?: () => AudioPart[];
  subtitles?: () => SubtitlePart[];
};

const historyStarts = SCENE_FRAMES.reduce<number[]>((acc, f, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SCENE_FRAMES[i - 1] - TRANSITION_FRAMES], []);

// Compositions from this project that can be dropped onto a timeline as clips.
export const EMBEDDABLE: Record<string, Embeddable> = {
  HiepDinhGiongevo: {
    name: "Tập 1: Hiệp định Giơnevơ",
    component: GenevaVideo,
    durationInFrames: GENEVA_FRAMES,
    width: 1920,
    height: 1080,
    sceneStarts: GENEVA_SCENES.map((s) => s.from),
    audioParts: () => [
      ...GENEVA_SCENES.flatMap((s) =>
        s.lines.map((l, i) => ({
          name: `${s.id} · câu ${i + 1}`,
          src: l.file,
          from: s.from + l.from,
          durationInFrames: l.to - l.from + 5,
          volume: 1,
          track: "voice" as const,
        })),
      ),
      { name: "Nhạc nền tập 1", src: "geneva/music.wav", from: 0, durationInFrames: GENEVA_FRAMES, volume: GENEVA_MUSIC_VOLUME, track: "music" as const },
    ],
    subtitles: () => GENEVA_SCENES.flatMap((s) => s.lines.flatMap((l) => l.subs.map((sub) => ({ from: s.from + sub.from, to: s.from + sub.to, text: sub.text })))),
  },
  KhangChienChongMy: {
    name: "Kháng chiến chống Mỹ (chữ viết tay)",
    component: HistoryVideo,
    durationInFrames: HISTORY_FRAMES,
    width: 1920,
    height: 1080,
    sceneStarts: historyStarts,
  },
};
