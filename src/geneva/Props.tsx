import React from "react";
import { INK } from "./Common";

export const StarShape: React.FC<{ x?: number; y?: number; r: number; fill: string }> = ({ x = 0, y = 0, r, fill }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.4;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} />;
};

// Flag on a pole; the pole's foot is at (0, 0). `wave` is a phase in radians.
export const Flag: React.FC<{
  kind: "vn" | "mt" | "white" | "fr" | "us";
  wave?: number;
  size?: number;
}> = ({ kind, wave = 0, size = 1 }) => {
  const w = 150 * size;
  const h = 100 * size;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * w;
    const dy = Math.sin(wave + i * 0.5) * 6 * size * (i / 12);
    top.push(`${x} ${dy}`);
    bottom.unshift(`${x} ${h + dy}`);
  }
  const shape = `M${top.join(" L")} L${bottom.join(" L")} Z`;
  const poleH = 260 * size;
  return (
    <g>
      <line x1={0} y1={0} x2={0} y2={-poleH} stroke="#5a3a1a" strokeWidth={7 * size} strokeLinecap="round" />
      <g transform={`translate(3 ${-poleH})`}>
        <clipPath id={`flag-${kind}`}>
          <path d={shape} />
        </clipPath>
        <g clipPath={`url(#flag-${kind})`}>
          {kind === "vn" ? <rect x={-5} y={-20} width={w + 10} height={h + 40} fill="#d32f2f" /> : null}
          {kind === "mt" ? (
            <>
              <rect x={-5} y={-20} width={w + 10} height={20 + h / 2} fill="#d32f2f" />
              <rect x={-5} y={h / 2} width={w + 10} height={h / 2 + 20} fill="#1e5bb8" />
            </>
          ) : null}
          {kind === "white" ? <rect x={-5} y={-20} width={w + 10} height={h + 40} fill="#fff" /> : null}
          {kind === "fr" ? (
            <>
              <rect x={-5} y={-20} width={w / 3 + 5} height={h + 40} fill="#1f3c88" />
              <rect x={w / 3} y={-20} width={w / 3} height={h + 40} fill="#fff" />
              <rect x={(2 * w) / 3} y={-20} width={w / 3 + 5} height={h + 40} fill="#d32f2f" />
            </>
          ) : null}
          {kind === "us" ? (
            <>
              {Array.from({ length: 7 }, (_, i) => (
                <rect key={i} x={-5} y={-20 + i * (h / 6.5) + 10} width={w + 10} height={h / 13} fill="#c62828" />
              ))}
              <rect x={-5} y={-20} width={w / 2.2} height={h / 1.9 + 20} fill="#1f3c88" />
            </>
          ) : null}
        </g>
        {kind === "vn" || kind === "mt" ? (
          <StarShape x={w / 2} y={h / 2 + Math.sin(wave + 3) * 3 * size} r={30 * size} fill="#ffd600" />
        ) : null}
        <path d={shape} fill="none" stroke={INK} strokeWidth={3} />
      </g>
    </g>
  );
};

export const MoneyBag: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <g transform={`scale(${size})`}>
    <path d="M-50 0 Q-70 -70 -20 -90 L-28 -112 L28 -112 L20 -90 Q70 -70 50 0 Z" fill="#c9a86a" stroke={INK} strokeWidth={4} />
    <text x={0} y={-30} textAnchor="middle" fontFamily="Patrick Hand" fontSize={60} fill="#2e7d32">
      $
    </text>
  </g>
);

export const BallotBox: React.FC<{ fill?: number }> = ({ fill = 0 }) => (
  <g>
    {Array.from({ length: Math.round(fill * 14) }, (_, i) => (
      <rect
        key={i}
        x={-70 + ((i * 37) % 120)}
        y={-160 - Math.floor(i / 4) * 22}
        width={46}
        height={30}
        fill="#fff"
        stroke={INK}
        strokeWidth={2}
        transform={`rotate(${((i * 53) % 40) - 20} ${-47 + ((i * 37) % 120)} ${-145 - Math.floor(i / 4) * 22})`}
      />
    ))}
    <rect x={-110} y={-150} width={220} height={150} fill="#c98b4b" stroke={INK} strokeWidth={5} />
    <rect x={-60} y={-156} width={120} height={14} fill="#333" />
    <text x={0} y={-60} textAnchor="middle" fontFamily="Patrick Hand" fontSize={40} fill={INK}>
      PHIẾU BẦU
    </text>
  </g>
);

export const Domino: React.FC<{ label: string; tilt: number }> = ({ label, tilt }) => (
  <g transform={`rotate(${tilt} 40 0)`}>
    <rect x={0} y={-220} width={80} height={220} rx={10} fill="#fafafa" stroke={INK} strokeWidth={5} />
    <line x1={8} y1={-110} x2={72} y2={-110} stroke={INK} strokeWidth={3} />
    <circle cx={40} cy={-165} r={9} fill={INK} />
    <circle cx={25} cy={-55} r={8} fill={INK} />
    <circle cx={55} cy={-55} r={8} fill={INK} />
    <text x={40} y={34} textAnchor="middle" fontFamily="Patrick Hand" fontSize={30} fill={INK} transform={`rotate(${-tilt} 40 20)`}>
      {label}
    </text>
  </g>
);

export const Popcorn: React.FC = () => (
  <g>
    {[-50, -20, 10, 40, -35, 0, 30].map((x, i) => (
      <circle key={i} cx={x} cy={-150 - (i > 3 ? 25 : 0)} r={24} fill="#fff6d5" stroke={INK} strokeWidth={3} />
    ))}
    <path d="M-80 -150 L80 -150 L60 0 L-60 0 Z" fill="#fff" stroke={INK} strokeWidth={5} />
    {[-55, -15, 25].map((x) => (
      <path key={x} d={`M${x} -150 L${x + 20} -150 L${x + 15} 0 L${x - 2} 0 Z`} fill="#d32f2f" />
    ))}
    <path d="M-80 -150 L80 -150 L60 0 L-60 0 Z" fill="none" stroke={INK} strokeWidth={5} />
  </g>
);

export const Calendar: React.FC<{ month: string; year: string; mark?: number }> = ({ month, year, mark = 0 }) => (
  <g>
    <rect x={-170} y={-200} width={340} height={400} rx={14} fill="#fff" stroke={INK} strokeWidth={5} />
    <rect x={-170} y={-200} width={340} height={100} rx={14} fill="#d32f2f" stroke={INK} strokeWidth={5} />
    <text x={0} y={-130} textAnchor="middle" fontFamily="Patrick Hand" fontSize={56} fill="#fff">
      {month}
    </text>
    <text x={0} y={30} textAnchor="middle" fontFamily="Patrick Hand" fontSize={120} fill={INK}>
      {year}
    </text>
    <text x={0} y={130} textAnchor="middle" fontFamily="Patrick Hand" fontSize={40} fill={INK}>
      Tổng tuyển cử
    </text>
    {mark > 0 ? (
      <g stroke="#d32f2f" strokeWidth={14} strokeLinecap="round" opacity={mark}>
        <line x1={-140} y1={-80} x2={140} y2={180} />
        <line x1={140} y1={-80} x2={-140} y2={180} />
      </g>
    ) : null}
  </g>
);

export const Board: React.FC<{ kind: "chalk" | "white"; x: number; y: number; w: number; h: number }> = ({ kind, x, y, w, h }) => (
  <g>
    {kind === "white" ? (
      <g stroke="#6d4c2f" strokeWidth={10} strokeLinecap="round">
        <line x1={x + w * 0.25} y1={y + h} x2={x + w * 0.15} y2={y + h + 220} />
        <line x1={x + w * 0.75} y1={y + h} x2={x + w * 0.85} y2={y + h + 220} />
      </g>
    ) : null}
    <rect x={x - 18} y={y - 18} width={w + 36} height={h + 36} rx={10} fill="#a0703f" stroke={INK} strokeWidth={5} />
    <rect x={x} y={y} width={w} height={h} fill={kind === "chalk" ? "#2f4f43" : "#fbfbf8"} stroke={INK} strokeWidth={4} />
  </g>
);

// Wood-panelled conference room; the table is drawn separately so it can cover legs.
export const Room: React.FC = () => (
  <g>
    <rect width={1920} height={1080} fill="#d8b98c" />
    {Array.from({ length: 9 }, (_, i) => (
      <rect key={i} x={30 + i * 212} y={120} width={180} height={520} rx={6} fill="#cfae7e" stroke="#9b7b4f" strokeWidth={4} />
    ))}
    <rect x={0} y={0} width={1920} height={90} fill="#b8935f" stroke={INK} strokeWidth={4} />
    <rect x={0} y={680} width={1920} height={400} fill="#8a6a45" />
  </g>
);

export const Table: React.FC<{ y?: number }> = ({ y = 760 }) => (
  <g>
    <rect x={-20} y={y} width={1960} height={60} fill="#2f6b4f" stroke={INK} strokeWidth={5} />
    <rect x={-20} y={y + 60} width={1960} height={400} fill="#3c7d5e" stroke={INK} strokeWidth={5} />
  </g>
);

export const Placard: React.FC<{ text: string }> = ({ text }) => (
  <g>
    <path d={`M${-text.length * 9 - 20} 0 L${text.length * 9 + 20} 0 L${text.length * 9 + 10} -46 L${-text.length * 9 - 10} -46 Z`} fill="#fff" stroke={INK} strokeWidth={3} />
    <text x={0} y={-12} textAnchor="middle" fontFamily="Patrick Hand" fontSize={30} fill={INK}>
      {text}
    </text>
  </g>
);

export const StickyNote: React.FC<{ lines: string[] }> = ({ lines }) => (
  <g transform="rotate(-4)">
    <rect x={-170} y={-110} width={340} height={220} fill="#fff176" stroke={INK} strokeWidth={4} />
    {lines.map((l, i) => (
      <text key={i} x={0} y={-40 + i * 56} textAnchor="middle" fontFamily="Patrick Hand" fontSize={44} fill={INK}>
        {l}
      </text>
    ))}
  </g>
);

export const Flame: React.FC<{ s: number }> = ({ s }) => (
  <g transform={`scale(${s})`}>
    <path d="M0 0 Q-30 -10 -22 -45 Q-12 -70 0 -95 Q8 -60 22 -50 Q34 -20 0 0 Z" fill="#ff7a1a" stroke={INK} strokeWidth={3} />
    <path d="M0 -6 Q-14 -14 -8 -34 Q0 -50 4 -60 Q10 -36 14 -30 Q18 -12 0 -6 Z" fill="#ffd34d" />
  </g>
);
