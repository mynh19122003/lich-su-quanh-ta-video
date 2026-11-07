import { Audio } from "@remotion/media";
import React, { createContext, useContext } from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { sceneById, type LineTiming, type Speaker } from "./timeline";

const Ctx = createContext<LineTiming[]>([]);

// Off when the episode's voice and music were detached onto separate audio tracks in the editor.
export const GenevaAudioCtx = createContext(true);

// Makes a scene's line timings available to the scene component and everything in it.
export const SceneProvider: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <Ctx.Provider value={sceneById(id).lines}>{children}</Ctx.Provider>
);

// Lays out a scene and plays its voice lines.
export const Scene: React.FC<{ id: string; children: React.ReactNode; background?: string }> = ({
  id,
  children,
  background = "#ffffff",
}) => {
  const lines = sceneById(id).lines;
  const audioOn = useContext(GenevaAudioCtx);
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: background, overflow: "hidden" }}>{children}</AbsoluteFill>
      {(audioOn ? lines : []).map((l, i) => (
        <Sequence key={i} name={`Thoại ${i + 1}`} from={l.from} durationInFrames={l.to - l.from + 5} layout="none">
          <Audio src={staticFile(l.file)} />
        </Sequence>
      ))}
    </>
  );
};

// A line that never starts, so animations tied to a deleted line simply don't play.
const MISSING_LINE: LineTiming = { file: "", who: "narrator", from: 1e9, to: 1e9, subs: [] };

// Frame (inside the scene) at which line `i` starts / ends.
export const useLine = (i: number) => {
  const lines = useContext(Ctx);
  return lines[i] ?? MISSING_LINE;
};

export const useIsSpeaking = (who: Speaker | undefined) => {
  const lines = useContext(Ctx);
  const frame = useCurrentFrame();
  if (!who) {
    return false;
  }
  return lines.some((l) => l.who === who && frame >= l.from && frame < l.to);
};
