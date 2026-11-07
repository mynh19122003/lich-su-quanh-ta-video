import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useIsSpeaking } from "./SceneContext";
import type { Speaker } from "./timeline";

export type Look =
  | "vm"
  | "phap"
  | "my"
  | "lienxo"
  | "tq"
  | "anh"
  | "diem"
  | "baodai"
  | "teacher"
  | "dan"
  | "suit"
  // Historical figures: the same stick figure, with the few features that make them recognisable.
  | "nixon"
  | "kissinger"
  | "letho"
  | "hcm"
  | "mao"
  | "brezhnev";

export type Mood = "neutral" | "happy" | "angry" | "worried" | "smug" | "shock" | "sad";
export type Pose = "down" | "wave" | "point" | "up" | "cross" | "hips" | "hold" | "shrug";

type Props = {
  readonly look: Look;
  // Which voice makes this character's mouth move.
  readonly speaker?: Speaker;
  readonly x: number;
  readonly y: number; // feet position in scene pixels
  readonly scale?: number;
  readonly mood?: Mood;
  readonly pose?: Pose;
  readonly facing?: "left" | "right" | "front";
  readonly label?: string;
  readonly enterAt?: number;
  readonly enterFrom?: "left" | "right" | "bottom";
  readonly exitAt?: number;
  readonly suitColor?: string;
  readonly prop?: React.ReactNode; // drawn at the right hand
  readonly flip?: boolean;
  // Overrides the scene's voice timing, e.g. for character stickers in the editor.
  readonly talking?: boolean;
};

const STROKE = "#111";
const SW = 5;

const OUTFIT: Record<Look, string> = {
  vm: "#6b8e3d",
  phap: "#2c4a9a",
  my: "#2e3440",
  lienxo: "#6d5a45",
  tq: "#7a8577",
  anh: "#3a3a3a",
  diem: "#f4f1ea",
  baodai: "#e3b23c",
  teacher: "#e88ca5",
  dan: "#efe9da",
  suit: "#4a4f5c",
  nixon: "#25324f",
  kissinger: "#55585f",
  letho: "#8d9089",
  hcm: "#c9b98a",
  mao: "#7d8278",
  brezhnev: "#2b2b30",
};

// Suits with a shirt and tie, and high-collared tunics with buttons.
const TIE: Partial<Record<Look, string>> = { my: "#c62828", anh: "#222", suit: "#222", diem: "#222", nixon: "#b71c1c", kissinger: "#2f3d5c", brezhnev: "#5b1d1d" };
const TUNIC: Look[] = ["letho", "hcm", "mao"];

const Star: React.FC<{ x: number; y: number; r: number; fill: string }> = ({ x, y, r, fill }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} />;
};

// Head is an ellipse centred at (0, -345), rx 68, ry 78.
const Hat: React.FC<{ look: Look }> = ({ look }) => {
  switch (look) {
    case "vm":
      return (
        <g>
          <path d="M-74 -378 Q-70 -462 0 -464 Q70 -462 74 -378 Z" fill="#7d9b4c" stroke={STROKE} strokeWidth={SW} />
          <path d="M-92 -376 Q0 -392 92 -376 Q0 -362 -92 -376 Z" fill="#6f8c40" stroke={STROKE} strokeWidth={SW} />
          <circle cx={0} cy={-415} r={17} fill="#d32f2f" stroke={STROKE} strokeWidth={3} />
          <Star x={0} y={-414} r={11} fill="#ffd600" />
        </g>
      );
    case "phap":
      return (
        <g>
          <path d="M-46 -470 L46 -470 L52 -392 L-52 -392 Z" fill="#c62828" stroke={STROKE} strokeWidth={SW} />
          <rect x={-53} y={-416} width={106} height={24} fill="#1e3577" stroke={STROKE} strokeWidth={SW} />
          <path d="M-56 -392 Q0 -372 70 -386" fill="none" stroke={STROKE} strokeWidth={9} strokeLinecap="round" />
        </g>
      );
    case "my":
      return (
        <g>
          <rect x={-46} y={-500} width={92} height={110} fill="#fafafa" stroke={STROKE} strokeWidth={SW} />
          {[-480, -460, -440].map((y) => (
            <rect key={y} x={-44} y={y} width={88} height={9} fill="#d32f2f" />
          ))}
          <rect x={-46} y={-422} width={92} height={26} fill="#1f3c88" stroke={STROKE} strokeWidth={4} />
          <Star x={-22} y={-409} r={8} fill="#fff" />
          <Star x={0} y={-409} r={8} fill="#fff" />
          <Star x={22} y={-409} r={8} fill="#fff" />
          <ellipse cx={0} cy={-392} rx={82} ry={12} fill="#fafafa" stroke={STROKE} strokeWidth={SW} />
        </g>
      );
    case "lienxo":
      return (
        <g>
          <path d="M-80 -380 Q-82 -470 0 -472 Q82 -470 80 -380 Z" fill="#7b5e3b" stroke={STROKE} strokeWidth={SW} />
          <path d="M-84 -392 L-84 -330 Q-92 -322 -76 -320 L-66 -392 Z" fill="#7b5e3b" stroke={STROKE} strokeWidth={4} />
          <path d="M84 -392 L84 -330 Q92 -322 76 -320 L66 -392 Z" fill="#7b5e3b" stroke={STROKE} strokeWidth={4} />
          <rect x={-82} y={-420} width={164} height={34} rx={14} fill="#8d6e46" stroke={STROKE} strokeWidth={SW} />
          <Star x={0} y={-404} r={13} fill="#d32f2f" />
        </g>
      );
    case "tq":
      return (
        <g>
          <path d="M-66 -392 Q-66 -458 0 -460 Q66 -458 66 -392 Z" fill="#7a8577" stroke={STROKE} strokeWidth={SW} />
          <path d="M-40 -392 Q20 -376 72 -388" fill="none" stroke={STROKE} strokeWidth={10} strokeLinecap="round" />
          <Star x={0} y={-422} r={13} fill="#d32f2f" />
        </g>
      );
    case "anh":
      return (
        <g>
          <path d="M-52 -392 Q-56 -470 0 -472 Q56 -470 52 -392 Z" fill="#222" stroke={STROKE} strokeWidth={SW} />
          <ellipse cx={0} cy={-392} rx={84} ry={11} fill="#222" stroke={STROKE} strokeWidth={4} />
        </g>
      );
    case "diem":
      return (
        <path
          d="M-66 -360 Q-74 -436 -10 -426 Q40 -440 66 -370 Q60 -396 30 -404 Q0 -390 -24 -404 Q-56 -400 -66 -360 Z"
          fill="#1b1b1b"
          stroke={STROKE}
          strokeWidth={4}
        />
      );
    case "baodai":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M-70 ${-384 - i * 18} Q0 ${-404 - i * 18} 70 ${-384 - i * 18} L66 ${-366 - i * 18} Q0 ${-386 - i * 18} -66 ${-366 - i * 18} Z`}
              fill={i % 2 ? "#d9a21b" : "#efc23f"}
              stroke={STROKE}
              strokeWidth={4}
            />
          ))}
        </g>
      );
    case "teacher":
      return (
        <path
          d="M-70 -350 Q-80 -440 0 -432 Q80 -440 70 -350 Q60 -300 74 -230 L46 -230 Q60 -330 30 -398 Q-10 -380 -48 -392 Q-60 -330 -46 -230 L-74 -230 Q-60 -300 -70 -350 Z"
          fill="#1b1b1b"
          stroke={STROKE}
          strokeWidth={4}
        />
      );
    case "dan":
      return (
        <g>
          <path d="M-96 -372 L0 -470 L96 -372 Z" fill="#e8d7a3" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M-50 -400 L50 -400 M-28 -428 L28 -428" stroke="#b99d55" strokeWidth={3} />
        </g>
      );
    // Hair for the historical figures, drawn over the top of the head ellipse.
    case "nixon":
      // Dark wavy hair with the widow's peak, swept back.
      return (
        <path
          d="M-70 -350 Q-80 -420 -40 -432 Q-20 -444 0 -418 Q20 -446 46 -432 Q80 -418 70 -350 Q62 -384 40 -400 Q18 -386 0 -400 Q-22 -386 -40 -400 Q-62 -386 -70 -350 Z"
          fill="#2a2420"
          stroke={STROKE}
          strokeWidth={4}
        />
      );
    case "kissinger":
      // Short, tight curls, greying.
      return (
        <g fill="#6b6660" stroke={STROKE} strokeWidth={3}>
          <path d="M-70 -356 Q-78 -414 -36 -428 Q0 -440 36 -428 Q78 -414 70 -356 Q60 -394 0 -400 Q-60 -394 -70 -356 Z" />
          {[-52, -30, -8, 14, 36, 54].map((cx, i) => (
            <circle key={cx} cx={cx} cy={-418 + (i % 2) * 8} r={11} />
          ))}
        </g>
      );
    case "letho":
      // Grey-white hair combed straight back.
      return (
        <g>
          <path d="M-68 -360 Q-74 -428 0 -432 Q74 -428 68 -360 Q58 -400 0 -404 Q-58 -400 -68 -360 Z" fill="#d9d9d4" stroke={STROKE} strokeWidth={4} />
          <path d="M-40 -420 Q0 -428 40 -420 M-48 -406 Q0 -416 48 -406" fill="none" stroke="#9a9a94" strokeWidth={3} />
        </g>
      );
    case "hcm":
      // Thin white hair, receding at the temples.
      return (
        <path d="M-66 -366 Q-70 -420 -30 -428 Q0 -434 30 -428 Q70 -420 66 -366 Q56 -400 30 -406 Q0 -398 -30 -406 Q-56 -400 -66 -366 Z" fill="#f2f2ee" stroke={STROKE} strokeWidth={4} />
      );
    case "mao":
      // High receding hairline, hair swept back at the sides.
      return (
        <g fill="#1f1d1b" stroke={STROKE} strokeWidth={4}>
          <path d="M-70 -350 Q-76 -402 -46 -420 Q-40 -394 -58 -350 Z" />
          <path d="M70 -350 Q76 -402 46 -420 Q40 -394 58 -350 Z" />
          <path d="M-46 -420 Q0 -444 46 -420 Q24 -428 0 -428 Q-24 -428 -46 -420 Z" />
        </g>
      );
    case "brezhnev":
      // Dark hair slicked back.
      return (
        <path d="M-70 -352 Q-78 -424 0 -432 Q78 -424 70 -352 Q60 -396 0 -404 Q-60 -396 -70 -352 Z" fill="#33302c" stroke={STROKE} strokeWidth={4} />
      );
    default:
      return null;
  }
};

// Faces of the historical figures: noses, jowls, glasses, beard, mole.
const FaceDetails: React.FC<{ look: Look; dx: number }> = ({ look, dx }) => {
  switch (look) {
    case "nixon":
      return (
        <g fill="none" stroke={STROKE} strokeWidth={4} strokeLinecap="round">
          {/* the ski-jump nose and heavy jowls the cartoonists loved */}
          <path d={`M${dx} -348 Q${dx + 6} -322 ${dx + 22} -318 Q${dx + 10} -308 ${dx - 6} -316`} fill="#fff" />
          <path d={`M${-52 + dx} -320 Q${-50 + dx} -290 ${-34 + dx} -282`} />
          <path d={`M${52 + dx} -320 Q${50 + dx} -290 ${34 + dx} -282`} />
          <path d={`M${-30 + dx} -380 Q${dx} -386 ${30 + dx} -380`} strokeWidth={3} opacity={0.6} />
        </g>
      );
    case "kissinger":
      return (
        <g fill="none" stroke={STROKE}>
          <rect x={-46 + dx} y={-368} width={40} height={30} rx={8} strokeWidth={8} />
          <rect x={6 + dx} y={-368} width={40} height={30} rx={8} strokeWidth={8} />
          <line x1={-6 + dx} y1={-356} x2={6 + dx} y2={-356} strokeWidth={6} />
          <path d={`M${-4 + dx} -334 Q${dx + 6} -324 ${dx - 2} -318`} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case "letho":
      return <path d={`M${-2 + dx} -340 Q${dx + 6} -326 ${dx - 2} -322`} fill="none" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />;
    case "hcm":
      // White goatee and a light moustache.
      return (
        <g stroke={STROKE} strokeWidth={3} strokeLinejoin="round">
          <path d={`M${-22 + dx} -318 Q${dx} -326 ${22 + dx} -318 Q${dx} -312 ${-22 + dx} -318 Z`} fill="#f4f4f0" />
          <path d={`M${-14 + dx} -292 Q${dx} -288 ${14 + dx} -292 L${8 + dx} -236 L${dx} -222 L${-8 + dx} -236 Z`} fill="#f4f4f0" />
        </g>
      );
    case "mao":
      return <circle cx={10 + dx} cy={-284} r={6} fill="#3a2a1a" />;
    case "brezhnev":
      // The famous eyebrows.
      return (
        <g stroke="#2a2622" strokeWidth={14} strokeLinecap="round">
          <line x1={-44 + dx} y1={-382} x2={-10 + dx} y2={-386} />
          <line x1={10 + dx} y1={-386} x2={44 + dx} y2={-382} />
        </g>
      );
    default:
      return null;
  }
};

const Brows: React.FC<{ mood: Mood; dx: number }> = ({ mood, dx }) => {
  const y = -378;
  const shapes: Record<Mood, [number, number, number, number]> = {
    // [left outer y, left inner y, right inner y, right outer y] offsets
    neutral: [0, 0, 0, 0],
    happy: [2, -4, -4, 2],
    angry: [-8, 8, 8, -8],
    worried: [6, -10, -10, 6],
    sad: [8, -8, -8, 8],
    smug: [0, 0, -10, -12],
    shock: [-12, -12, -12, -12],
  };
  const [lo, li, ri, ro] = shapes[mood];
  return (
    <g stroke={STROKE} strokeWidth={6} strokeLinecap="round">
      <line x1={-38 + dx} y1={y + lo} x2={-12 + dx} y2={y + li} />
      <line x1={12 + dx} y1={y + ri} x2={38 + dx} y2={y + ro} />
    </g>
  );
};

const Mouth: React.FC<{ mood: Mood; open: number; dx: number }> = ({ mood, open, dx }) => {
  const y = -305;
  if (open > 0.05) {
    return <ellipse cx={dx} cy={y} rx={13} ry={3 + open * 12} fill="#3a1010" stroke={STROKE} strokeWidth={4} />;
  }
  switch (mood) {
    case "happy":
    case "smug":
      return <path d={`M${-20 + dx} ${y - 4} Q${dx} ${y + 14} ${20 + dx} ${y - 4}`} fill="none" stroke={STROKE} strokeWidth={5} strokeLinecap="round" />;
    case "worried":
    case "sad":
      return <path d={`M${-18 + dx} ${y + 6} Q${dx} ${y - 8} ${18 + dx} ${y + 6}`} fill="none" stroke={STROKE} strokeWidth={5} strokeLinecap="round" />;
    case "shock":
      return <ellipse cx={dx} cy={y} rx={11} ry={14} fill="#3a1010" stroke={STROKE} strokeWidth={4} />;
    default:
      return <line x1={-16 + dx} y1={y} x2={16 + dx} y2={y} stroke={STROKE} strokeWidth={5} strokeLinecap="round" />;
  }
};

const ARMS: Record<Pose, { l: number[]; r: number[] }> = {
  // shoulder, elbow, hand as x,y triples
  down: { l: [-56, -258, -76, -200, -82, -150], r: [56, -258, 76, -200, 82, -150] },
  wave: { l: [-56, -258, -76, -200, -82, -150], r: [56, -258, 110, -300, 100, -380] },
  point: { l: [-56, -258, -76, -200, -82, -150], r: [56, -258, 120, -262, 180, -268] },
  up: { l: [-56, -258, -100, -320, -100, -400], r: [56, -258, 100, -320, 100, -400] },
  cross: { l: [-56, -258, -30, -200, 40, -220], r: [56, -258, 30, -205, -40, -225] },
  hips: { l: [-56, -258, -110, -210, -62, -170], r: [56, -258, 110, -210, 62, -170] },
  hold: { l: [-56, -258, -76, -200, -82, -150], r: [56, -258, 96, -210, 130, -230] },
  shrug: { l: [-56, -258, -110, -230, -130, -290], r: [56, -258, 110, -230, 130, -290] },
};

export const Character: React.FC<Props> = ({
  look,
  speaker,
  x,
  y,
  scale = 1,
  mood = "neutral",
  pose = "down",
  facing = "front",
  label,
  enterAt,
  enterFrom = "left",
  exitAt,
  suitColor,
  prop,
  flip = false,
  talking: talkingOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const sceneTalking = useIsSpeaking(speaker);
  const talking = talkingOverride ?? sceneTalking;

  const enter =
    enterAt === undefined ? 1 : spring({ frame: frame - enterAt, fps, config: { damping: 16, mass: 0.7 } });
  const exit =
    exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
  const offX =
    enterFrom === "left" ? -(x + 300) : enterFrom === "right" ? width - x + 300 : 0;
  const offY = enterFrom === "bottom" ? 700 : 0;
  const tx = x + offX * (1 - enter) + offX * exit;
  const ty = y + offY * (1 - enter) + offY * exit;

  // Little hop while walking in, gentle breathing otherwise.
  const hop = enter < 0.98 ? -Math.abs(Math.sin(frame / 3)) * 18 : 0;
  const breathe = Math.sin(frame / 18) * 2;
  const open = talking ? Math.max(0, Math.sin(frame * 1.1) * 0.6 + Math.sin(frame * 0.53) * 0.4) : 0;
  const blink = frame % 97 < 3 ? 0.15 : 1;
  const dx = facing === "left" ? -10 : facing === "right" ? 10 : 0;

  const arms = ARMS[pose];
  const waveAngle = pose === "wave" ? Math.sin(frame / 4) * 12 : 0;
  const outfit = suitColor ?? OUTFIT[look];
  const arm = (pts: number[]) => `M${pts[0]} ${pts[1]} L${pts[2]} ${pts[3]} L${pts[4]} ${pts[5]}`;

  return (
    <g transform={`translate(${tx} ${ty + hop}) scale(${flip ? -scale : scale} ${scale})`}>
      {/* legs */}
      <g stroke={STROKE} strokeWidth={8} strokeLinecap="round" fill="none">
        <path d="M-22 -112 L-28 -4 L-48 -2" />
        <path d="M22 -112 L28 -4 L48 -2" />
      </g>
      {/* body */}
      <g transform={`translate(0 ${breathe})`}>
        {look === "teacher" ? <Hat look={look} /> : null}
        <path
          d={
            look === "baodai" || look === "teacher"
              ? "M-54 -272 Q-60 -272 -62 -262 L-74 -102 L74 -102 L62 -262 Q60 -272 54 -272 Z"
              : "M-54 -272 Q-60 -272 -62 -262 L-66 -116 Q-66 -108 -58 -108 L58 -108 Q66 -108 66 -116 L62 -262 Q60 -272 54 -272 Z"
          }
          fill={outfit}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
        {TIE[look] ? (
          <g>
            <path d="M-26 -270 L0 -200 L26 -270 Z" fill="#fff" stroke={STROKE} strokeWidth={3} />
            <path d="M-8 -262 L8 -262 L5 -205 L0 -196 L-5 -205 Z" fill={TIE[look]} />
          </g>
        ) : null}
        {look === "nixon" ? <rect x={30} y={-246} width={16} height={10} fill="#1f3c88" stroke="#c62828" strokeWidth={2} /> : null}
        {look === "brezhnev" ? (
          <g>
            {[-40, -24].map((cx) => (
              <Star key={cx} x={cx} y={-232} r={10} fill="#f2c230" />
            ))}
          </g>
        ) : null}
        {TUNIC.includes(look) ? (
          // High standing collar of the tunic.
          <path d="M-30 -272 L-26 -252 L0 -244 L26 -252 L30 -272" fill="none" stroke={STROKE} strokeWidth={4} strokeLinejoin="round" />
        ) : null}
        {look === "phap" || look === "vm" || look === "tq" || TUNIC.includes(look) ? (
          <g fill={look === "phap" ? "#e0b13a" : "#333"}>
            <circle cx={0} cy={-235} r={5} />
            <circle cx={0} cy={-200} r={5} />
            <circle cx={0} cy={-165} r={5} />
          </g>
        ) : null}
        {TUNIC.includes(look) ? (
          // Four pockets.
          <g fill="none" stroke={STROKE} strokeWidth={3}>
            <rect x={-46} y={-240} width={28} height={22} />
            <rect x={18} y={-240} width={28} height={22} />
            <rect x={-48} y={-170} width={32} height={30} />
            <rect x={16} y={-170} width={32} height={30} />
          </g>
        ) : null}
        {look === "vm" ? <line x1={-64} y1={-150} x2={64} y2={-150} stroke="#3e2a14" strokeWidth={10} /> : null}

        {/* arms */}
        <g transform={pose === "wave" ? `rotate(${waveAngle} 56 -258)` : undefined}>
          <path d={arm(arms.r)} fill="none" stroke={STROKE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          {prop ? <g transform={`translate(${arms.r[4]} ${arms.r[5]})`}>{prop}</g> : null}
        </g>
        <path d={arm(arms.l)} fill="none" stroke={STROKE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />

        {/* head */}
        <ellipse cx={0} cy={-345} rx={68} ry={78} fill="#fff" stroke={STROKE} strokeWidth={SW} />
        <g transform={`translate(0 ${-352}) scale(1 ${blink}) translate(0 ${352})`}>
          <circle cx={-24 + dx} cy={-352} r={7} fill={STROKE} />
          <circle cx={24 + dx} cy={-352} r={7} fill={STROKE} />
        </g>
        {look === "teacher" ? (
          <g fill="none" stroke={STROKE} strokeWidth={4}>
            <circle cx={-24 + dx} cy={-352} r={17} />
            <circle cx={24 + dx} cy={-352} r={17} />
            <line x1={-7 + dx} y1={-352} x2={7 + dx} y2={-352} />
          </g>
        ) : null}
        {look === "anh" ? (
          <g fill="none" stroke={STROKE} strokeWidth={3}>
            <circle cx={24 + dx} cy={-352} r={18} />
            <path d={`M${42 + dx} -352 Q60 -300 50 -260`} />
          </g>
        ) : null}
        {look !== "brezhnev" ? <Brows mood={mood} dx={dx} /> : null}
        <Mouth mood={mood} open={open} dx={dx} />
        <FaceDetails look={look} dx={dx} />
        {look === "phap" ? (
          <path d={`M${-30 + dx} -322 Q${dx} -334 ${30 + dx} -322 Q${dx} -318 ${-30 + dx} -322 Z`} fill="#3b2a1a" stroke={STROKE} strokeWidth={3} />
        ) : null}
        {look === "my" ? (
          <path d={`M${-16 + dx} -288 Q${dx} -250 ${16 + dx} -288`} fill="#f2f2f2" stroke={STROKE} strokeWidth={3} />
        ) : null}
        {look !== "teacher" ? <Hat look={look} /> : null}
        {label ? (
          <text
            x={0}
            y={look === "my" ? -530 : -485}
            textAnchor="middle"
            fontFamily="Patrick Hand"
            fontSize={30}
            fill="#222"
            transform={flip ? "scale(-1 1)" : undefined}
          >
            ({label})
          </text>
        ) : null}
      </g>
    </g>
  );
};
