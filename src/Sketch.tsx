import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

type DrawProps = {
  readonly startFrame: number;
  readonly drawFrames: number;
  readonly color: string;
};

const useDrawProgress = (startFrame: number, drawFrames: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + drawFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

// A slightly wobbly marker underline, drawn left to right.
export const Underline: React.FC<DrawProps & { readonly width: number }> = ({
  startFrame,
  drawFrames,
  color,
  width,
}) => {
  const p = useDrawProgress(startFrame, drawFrames);
  const w = width;
  return (
    <svg width={w + 20} height={40} style={{ overflow: "visible", display: "block" }}>
      <path
        d={`M10 22 C ${w * 0.25} 12, ${w * 0.55} 30, ${w * 0.8} 18 S ${w + 5} 20, ${w + 10} 14
            M${w * 0.12} 32 C ${w * 0.4} 24, ${w * 0.7} 34, ${w * 0.92} 26`}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
      />
    </svg>
  );
};

// A five-pointed star traced in one continuous pen stroke, then washed with colour.
export const Star: React.FC<DrawProps & { readonly size: number }> = ({
  startFrame,
  drawFrames,
  color,
  size,
}) => {
  const p = useDrawProgress(startFrame, drawFrames);
  const fill = useDrawProgress(startFrame + drawFrames, 12);
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 48 : 19;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${50 + r * Math.cos(a)} ${52 + r * Math.sin(a)}`;
  });
  const d = `M${pts.join(" L")} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <path d={d} fill={color} fillOpacity={fill * 0.9} />
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - p}
      />
    </svg>
  );
};
