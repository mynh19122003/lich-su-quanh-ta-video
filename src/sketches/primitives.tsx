import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const useProgress = (start: number, frames: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + frames], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
};

type DrawPathProps = {
  readonly d: string;
  readonly start: number;
  readonly frames: number;
  readonly color: string;
  readonly width?: number;
  readonly fill?: string;
};

// A pen stroke that draws itself along the path, optionally washed with a fill afterwards.
export const DrawPath: React.FC<DrawPathProps> = ({
  d,
  start,
  frames,
  color,
  width = 4,
  fill,
}) => {
  const p = useProgress(start, frames);
  const f = useProgress(start + frames, 10);
  return (
    <>
      {fill ? <path d={d} fill={fill} fillOpacity={f} /> : null}
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
        opacity={p === 0 ? 0 : 1}
      />
    </>
  );
};

// Radiating strokes, like an explosion or a firework.
export const Burst: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly start: number;
  readonly color: string;
  readonly rays?: number;
}> = ({ x, y, r, start, color, rays = 12 }) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [start, start + 10], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const fade = interpolate(frame, [start + 14, start + 34], [1, 0.25], clamp);
  if (grow === 0) {
    return null;
  }
  return (
    <g opacity={fade}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.12;
        const len = i % 2 === 0 ? 1 : 0.7;
        return (
          <line
            key={i}
            x1={x + Math.cos(a) * r * 0.3 * grow}
            y1={y + Math.sin(a) * r * 0.3 * grow}
            x2={x + Math.cos(a) * r * len * grow}
            y2={y + Math.sin(a) * r * len * grow}
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};
