import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SCENES } from "./timeline";

export const HAND_FONT = "fonts/PatrickHand-Regular.ttf";
export const INK = "#1d1d1d";

// YouTube-style burned-in subtitles for whatever line is playing.
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = SCENES.find((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  if (!scene) {
    return null;
  }
  const local = frame - scene.from;
  const sub = scene.lines.flatMap((l) => l.subs).find((s) => local >= s.from && local < s.to);
  if (!sub) {
    return null;
  }
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46 }}>
      <div
        style={{
          maxWidth: 1700,
          padding: "6px 18px",
          background: "rgba(8,8,8,0.78)",
          color: "#fff",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 42,
          lineHeight: 1.3,
          textAlign: "center",
          borderRadius: 4,
        }}
      >
        {sub.text}
      </div>
    </AbsoluteFill>
  );
};

// A small italic note at the top of the frame, e.g. "(Giơnevơ, Thụy Sĩ, 1954)".
export const Caption: React.FC<{ text: string; at?: number; color?: string }> = ({ text, at = 0, color = INK }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        width: "100%",
        textAlign: "center",
        fontFamily: "Patrick Hand",
        fontSize: 46,
        color,
        opacity,
      }}
    >
      {text}
    </div>
  );
};

// Pops a child in with a springy scale from frame `at`.
export const Pop: React.FC<{
  at: number;
  x: number;
  y: number;
  children: React.ReactNode;
  until?: number;
}> = ({ at, x, y, children, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 11, mass: 0.6 } });
  const gone = until !== undefined && frame >= until;
  if (frame < at || gone) {
    return null;
  }
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{children}</g>;
};

// Comic speech bubble anchored with its tail at (x, y).
export const Bubble: React.FC<{
  at: number;
  until?: number;
  x: number;
  y: number;
  text: string;
  width?: number;
  side?: "left" | "right";
}> = ({ at, until, x, y, text, width = 360, side = "right" }) => {
  const h = 110;
  const bx = side === "right" ? 20 : -width - 20;
  return (
    <Pop at={at} until={until} x={x} y={y}>
      <path
        d={`M0 0 L${side === "right" ? 40 : -40} -50 L${side === "right" ? 90 : -90} -50 Z`}
        fill="#fff"
        stroke={INK}
        strokeWidth={4}
      />
      <rect x={bx} y={-50 - h} width={width} height={h} rx={40} fill="#fff" stroke={INK} strokeWidth={4} />
      <path d={`M${side === "right" ? 42 : -42} -52 L${side === "right" ? 88 : -88} -52`} stroke="#fff" strokeWidth={6} />
      <text x={bx + width / 2} y={-50 - h / 2 + 14} textAnchor="middle" fontFamily="Patrick Hand" fontSize={42} fill={INK}>
        {text}
      </text>
    </Pop>
  );
};

export const Sky: React.FC<{ ground?: string; sky?: string; horizon?: number }> = ({
  ground = "#8fc46a",
  sky = "#a9dcf5",
  horizon = 760,
}) => (
  <svg width={1920} height={1080} style={{ position: "absolute" }}>
    <rect width={1920} height={1080} fill={sky} />
    <path d={`M0 ${horizon} Q480 ${horizon - 40} 960 ${horizon} T1920 ${horizon} V1080 H0 Z`} fill={ground} stroke={INK} strokeWidth={4} />
    <circle cx={1700} cy={150} r={70} fill="#ffd54a" stroke={INK} strokeWidth={4} />
  </svg>
);

// Generic stage: the scene draws everything in one 1920x1080 svg.
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
    {children}
  </svg>
);
