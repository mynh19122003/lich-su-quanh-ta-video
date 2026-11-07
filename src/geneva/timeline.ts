import timing from "./timing.json";

export const FPS = 30;

export type Speaker = "narrator" | "teacher" | "vm" | "phap" | "my" | "tq" | "diem";

export type LineTiming = {
  file: string;
  who: Speaker;
  // Frames, relative to the start of the scene.
  from: number;
  to: number;
  subs: { from: number; to: number; text: string }[];
};

export type SceneTiming = {
  id: string;
  mood: "light" | "tense" | "sad";
  from: number;
  durationInFrames: number;
  lines: LineTiming[];
};

const f = (seconds: number) => Math.round(seconds * FPS);

export const SCENES: SceneTiming[] = timing.scenes.map((s) => ({
  id: s.id,
  mood: s.mood as SceneTiming["mood"],
  from: f(s.start),
  durationInFrames: f(s.start + s.duration) - f(s.start),
  lines: s.lines.map((l) => ({
    file: l.file,
    who: l.who as Speaker,
    from: f(l.start),
    to: f(l.start + l.duration),
    subs: l.subs.map((sub) => ({
      from: f(l.start + sub.start),
      to: f(l.start + sub.end),
      text: sub.text,
    })),
  })),
}));

export const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);

export const sceneById = (id: string) => {
  const scene = SCENES.find((s) => s.id === id);
  if (!scene) {
    throw new Error(`No timing for scene ${id}`);
  }
  return scene;
};
