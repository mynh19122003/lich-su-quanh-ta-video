import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { HandwrittenText } from "../handwriting/HandwrittenText";
import { Burst, clamp, DrawPath, useProgress } from "./primitives";

const INK = "#1f2a44";
const RED = "#b3261e";
const GOLD = "#d9a21b";
const HAND = "fonts/PatrickHand-Regular.ttf";

// Every sketch draws into an 840 x 340 box.
const Box: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={840} height={340} viewBox="0 0 840 340" style={{ overflow: "visible" }}>
    {children}
  </svg>
);

// Rough outline of Vietnam as [lon, lat], clockwise from the north-west.
const VIETNAM: [number, number][] = [
  [102.15, 22.4], [103.0, 22.6], [103.9, 22.6], [104.6, 22.9], [105.3, 23.3],
  [106.0, 22.9], [106.7, 22.8], [107.5, 22.0], [107.0, 21.4], [106.6, 20.6],
  [106.0, 19.9], [105.7, 19.1], [105.9, 18.5], [106.5, 17.7], [107.1, 16.9],
  [108.2, 16.1], [108.8, 15.3], [109.2, 13.8], [109.4, 12.6], [109.1, 11.6],
  [108.4, 11.0], [107.4, 10.5], [106.7, 10.1], [106.4, 9.6], [105.4, 8.9],
  [104.8, 8.6], [104.9, 9.6], [104.5, 10.4], [105.1, 10.9], [106.1, 11.6],
  [106.8, 12.0], [107.6, 12.4], [107.5, 13.6], [107.6, 14.6], [107.2, 15.6],
  [106.6, 16.4], [105.9, 17.4], [105.2, 18.4], [104.1, 19.2], [104.6, 20.0],
  [103.7, 20.6], [103.0, 20.9], [102.2, 21.6],
];
const K = 21;
const proj = (lon: number, lat: number) => ({ x: (lon - 102) * K, y: (23.6 - lat) * K });
const MAP_D =
  VIETNAM.map(([lon, lat], i) => {
    const p = proj(lon, lat);
    return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ") + " Z";

export const Sketch1954: React.FC<{ start: number }> = ({ start }) => {
  const { fps } = useVideoConfig();
  const line = useProgress(start + 2.3 * fps, 0.9 * fps);
  const y17 = proj(0, 17).y;
  const hanoi = proj(105.85, 21.03);
  const saigon = proj(106.7, 10.8);
  const hanoiDot = useProgress(start + 1.2 * fps, 6);
  const saigonDot = useProgress(start + 1.8 * fps, 6);
  return (
    <Box>
      <g transform="translate(40 2)">
        <DrawPath d={MAP_D} start={start} frames={2.2 * fps} color={INK} width={3.5} fill="rgba(179,38,30,0.12)" />
        <clipPath id="parallel-clip">
          <rect x={-40} y={y17 - 10} width={line * 520} height={20} />
        </clipPath>
        <line
          x1={-30} y1={y17} x2={470} y2={y17}
          stroke={RED} strokeWidth={5} strokeDasharray="16 12" strokeLinecap="round"
          clipPath="url(#parallel-clip)"
        />
        <circle cx={hanoi.x} cy={hanoi.y} r={7 * hanoiDot} fill={RED} />
        <circle cx={saigon.x} cy={saigon.y} r={7 * saigonDot} fill={INK} />
      </g>
      <foreignObject x={250} y={y17 - 62} width={520} height={90}>
        <HandwrittenText text="vĩ tuyến 17" fontFile={HAND} fontSize={52} color={RED} startFrame={start + 3.1 * fps} writeFrames={1 * fps} showPen={false} />
      </foreignObject>
      <foreignObject x={hanoi.x + 60} y={hanoi.y - 25} width={300} height={60}>
        <HandwrittenText text="Hà Nội" fontFile={HAND} fontSize={36} color={INK} startFrame={start + 1.3 * fps} writeFrames={0.5 * fps} showPen={false} />
      </foreignObject>
      <foreignObject x={saigon.x + 60} y={saigon.y - 25} width={300} height={60}>
        <HandwrittenText text="Sài Gòn" fontFile={HAND} fontSize={36} color={INK} startFrame={start + 1.9 * fps} writeFrames={0.5 * fps} showPen={false} />
      </foreignObject>
    </Box>
  );
};

const arrow = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) => {
  const a = Math.atan2(y2 - cy, x2 - cx);
  const h = 34;
  const l = { x: x2 - h * Math.cos(a - 0.45), y: y2 - h * Math.sin(a - 0.45) };
  const r = { x: x2 - h * Math.cos(a + 0.45), y: y2 - h * Math.sin(a + 0.45) };
  return {
    shaft: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`,
    head: `M${l.x} ${l.y} L${x2} ${y2} L${r.x} ${r.y}`,
  };
};

export const Sketch1968: React.FC<{ start: number }> = ({ start }) => {
  const { fps } = useVideoConfig();
  const arrows = [
    arrow(40, 300, 220, 300, 330, 120),
    arrow(200, 320, 420, 290, 560, 90),
    arrow(400, 330, 640, 300, 780, 140),
  ];
  return (
    <Box>
      {arrows.map((a, i) => {
        const s = start + i * 0.7 * fps;
        return (
          <g key={i}>
            <DrawPath d={a.shaft} start={s} frames={0.9 * fps} color={RED} width={11} />
            <DrawPath d={a.head} start={s + 0.9 * fps} frames={0.25 * fps} color={RED} width={11} />
          </g>
        );
      })}
      <Burst x={330} y={95} r={60} start={start + 1.2 * fps} color={GOLD} />
      <Burst x={565} y={60} r={70} start={start + 1.9 * fps} color={RED} />
      <Burst x={785} y={110} r={60} start={start + 2.6 * fps} color={GOLD} />
    </Box>
  );
};

const B52 = [
  "M0 40 Q20 30 60 32 L230 34 Q258 36 264 42 Q258 48 230 48 L60 50 Q20 52 0 46 Z",
  "M150 44 L92 96 L114 96 L188 46",
  "M12 38 L-4 0 L16 0 L44 33",
  "M14 47 L0 64 L14 64 L38 49",
  "M110 74 L136 74 M126 62 L152 62",
];

export const Sketch1972: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = start + 3.0 * fps;
  const t = frame - hit;

  // Cruise to the right, then fall away trailing smoke after the hit.
  const planeAt = (f: number) => {
    const cruise = interpolate(f, [start + 1.2 * fps, hit], [0, 260], clamp);
    const after = Math.max(0, f - hit) / fps;
    return {
      x: 30 + cruise + after * 120,
      y: 40 + after * after * 70,
      rot: Math.min(40, after * 22),
    };
  };
  const plane = planeAt(frame);
  const hitPoint = { x: 30 + 260 + 150, y: 40 + 42 };

  const smoke: string[] = [];
  for (let f = hit; f <= frame; f += 2) {
    const p = planeAt(f);
    smoke.push(`${p.x + 150} ${p.y + 42}`);
  }

  return (
    <Box>
      <DrawPath
        d={`M640 340 Q600 200 ${hitPoint.x} ${hitPoint.y}`}
        start={hit - 0.9 * fps}
        frames={0.9 * fps}
        color="#7a7368"
        width={4}
      />
      {smoke.length > 1 ? (
        <polyline
          points={smoke.join(", ")}
          fill="none"
          stroke="#55504a"
          strokeOpacity={0.55}
          strokeWidth={interpolate(t, [0, 2 * fps], [8, 26], clamp)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.rot} 130 42)`}>
        {B52.map((d, i) => (
          <DrawPath key={i} d={d} start={start + i * 0.2 * fps} frames={0.6 * fps} color={INK} width={3.5} fill={i === 0 ? "rgba(31,42,68,0.18)" : undefined} />
        ))}
      </g>
      <Burst x={hitPoint.x} y={hitPoint.y} r={90} start={hit} color={RED} rays={16} />
      <Burst x={hitPoint.x} y={hitPoint.y} r={55} start={hit + 4} color={GOLD} rays={10} />
    </Box>
  );
};

export const Sketch1973: React.FC<{ start: number }> = ({ start }) => {
  const { fps } = useVideoConfig();
  const stamp = useProgress(start + 2.9 * fps, 0.3 * fps);
  return (
    <Box>
      <g transform="translate(120 10) rotate(-4)">
        <DrawPath d="M0 0 L240 4 L236 320 L-4 316 Z" start={start} frames={0.9 * fps} color={INK} width={3.5} fill="rgba(255,255,255,0.55)" />
        {[50, 85, 120, 155, 190].map((y, i) => (
          <DrawPath key={y} d={`M30 ${y} L${i === 4 ? 140 : 205} ${y + 2}`} start={start + (0.9 + i * 0.15) * fps} frames={0.2 * fps} color="#8a7a60" width={3} />
        ))}
        <DrawPath
          d="M40 262 C60 220 70 290 90 250 S120 230 130 262 S165 240 175 258 L205 250"
          start={start + 1.8 * fps}
          frames={1 * fps}
          color={INK}
          width={4}
        />
        <g opacity={stamp} transform={`translate(170 120) scale(${1.6 - 0.6 * stamp}) rotate(-14)`}>
          <circle r={58} fill="none" stroke={RED} strokeWidth={6} />
          <circle r={46} fill="none" stroke={RED} strokeWidth={2} />
          <text textAnchor="middle" y={12} fontFamily="Patrick Hand" fontSize={34} fill={RED}>
            PARIS
          </text>
        </g>
      </g>
      <foreignObject x={420} y={110} width={420} height={120}>
        <HandwrittenText text="27 - 1 - 1973" fontFile={HAND} fontSize={64} color={RED} startFrame={start + 3.2 * fps} writeFrames={1 * fps} />
      </foreignObject>
    </Box>
  );
};

const StarShape: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.4;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
  });
  return <polygon points={pts.join(" ")} fill="#f6d03b" stroke="#c9a21b" strokeWidth={1.5} />;
};

export const Sketch1975: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = useProgress(start + 0.6 * fps, 1.4 * fps);
  const w = 260;
  const h = 170;
  const wave = (frame - start) / 6;

  // The free edge of the flag ripples; the edge on the pole stays put.
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * w;
    const dy = Math.sin(wave + i * 0.45) * 10 * (i / 20);
    top.push(`${x} ${dy}`);
    bottom.unshift(`${x} ${h + dy}`);
  }
  const flagY = interpolate(rise, [0, 1], [230, 20]);

  return (
    <Box>
      <DrawPath d="M150 335 L150 10" start={start} frames={0.6 * fps} color={INK} width={7} />
      <g transform={`translate(154 ${flagY})`} opacity={rise > 0 ? 1 : 0}>
        <path d={`M${top.join(" L")} L${bottom.join(" L")} Z`} fill={RED} stroke="#7a1712" strokeWidth={2} />
        <StarShape cx={w / 2} cy={h / 2 + Math.sin(wave + 4.5) * 5} r={52} />
      </g>
      <Burst x={560} y={80} r={80} start={start + 2.0 * fps} color={RED} rays={16} />
      <Burst x={720} y={170} r={70} start={start + 2.5 * fps} color={GOLD} rays={14} />
      <Burst x={500} y={230} r={60} start={start + 3.0 * fps} color={GOLD} rays={12} />
      <Burst x={760} y={50} r={55} start={start + 3.4 * fps} color={RED} rays={12} />
    </Box>
  );
};
