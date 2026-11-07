import React from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { HandwrittenText } from "../../handwriting/HandwrittenText";
import { Burst, DrawPath } from "../../sketches/primitives";
import { Character } from "../Character";
import { Bubble, Caption, HAND_FONT, INK, Pop, Sky, Stage } from "../Common";
import { IndochinaMap } from "../IndochinaMap";
import { Board, Domino, Flag, MoneyBag, Popcorn } from "../Props";
import { Scene, useLine } from "../SceneContext";

const RED = "#d23a2c";
const YELLOW = "#f2c94c";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Write: React.FC<{
  text: string;
  x: number;
  y: number;
  at: number;
  frames: number;
  size?: number;
  color?: string;
  pen?: boolean;
}> = ({ text, x, y, at, frames, size = 64, color = INK, pen = false }) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <HandwrittenText text={text} fontFile={HAND_FONT} fontSize={size} color={color} startFrame={at} writeFrames={frames} showPen={pen} />
  </div>
);

export const MoDau: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const cut = l1 + 1.7 * fps;
  const line = interpolate(frame, [cut, cut + 0.6 * fps], [0, 1], clamp);
  const south = interpolateColors(frame, [cut + 0.4 * fps, cut + 0.9 * fps], [RED, YELLOW]);

  return (
    <Scene id="mo-dau">
      <div style={{ position: "absolute", inset: 0, scale: interpolate(frame, [0, l3 + 6 * fps], [1, 1.12]) }}>
        <IndochinaMap width={1920} height={1080} split={{ lat: 17, north: RED, south }}>
          {(p) => {
            const [dbx, dby] = p(103.02, 21.39);
            const [x0, y17] = p(105.5, 17);
            const [x1] = p(108.2, 17);
            return (
              <>
                <Burst x={dbx} y={dby} r={70} start={l0 + 1.2 * fps} color="#ffd600" rays={14} />
                <Pop at={l0 + 1.2 * fps} x={dbx - 130} y={dby - 40}>
                  <text fontFamily="Patrick Hand" fontSize={38} fill="#fff" stroke={INK} strokeWidth={5} paintOrder="stroke" textAnchor="middle">
                    Điện Biên Phủ
                  </text>
                </Pop>
                <clipPath id="cut-line">
                  <rect x={x0 - 40} y={y17 - 10} width={(x1 - x0 + 80) * line} height={20} />
                </clipPath>
                <line x1={x0 - 30} y1={y17} x2={x1 + 30} y2={y17} stroke="#fff" strokeWidth={7} strokeDasharray="18 12" clipPath="url(#cut-line)" />
              </>
            );
          }}
        </IndochinaMap>
      </div>
      <Stage>
        <Pop at={l2} x={1450} y={420}>
          <text fontFamily="Patrick Hand" fontSize={260} fill="#fff" stroke={INK} strokeWidth={8} paintOrder="stroke" textAnchor="middle">
            ?
          </text>
        </Pop>
        <Character look="dan" x={1640} y={1020} scale={0.75} mood="worried" pose="shrug" enterAt={l2 + 0.3 * fps} enterFrom="right" />
      </Stage>
      <Write text="Giơnevơ, 1954" x={140} y={80} at={l3 + 0.5 * fps} frames={1.2 * fps} size={90} color="#fff" pen />
    </Scene>
  );
};

export const BangDen: React.FC = () => {
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  return (
    <Scene id="bang-den" background="#e9e2cf">
      <Stage>
        <rect y={900} width={1920} height={180} fill="#b98c5a" />
        <Board kind="chalk" x={120} y={110} w={1180} h={640} />
        <Character
          look="teacher"
          speaker="teacher"
          x={1560}
          y={960}
          scale={1.05}
          mood="happy"
          pose="point"
          facing="left"
          flip
          prop={<line x1={0} y1={0} x2={150} y2={-60} stroke="#6d4c2f" strokeWidth={8} strokeLinecap="round" />}
        />
        <Pop at={l1 + 0.6 * fps} x={260} y={1040}>
          <Popcorn />
        </Pop>
      </Stage>
      <Write text="Lớp Học Lịch Sử" x={480} y={150} at={l0} frames={0.9 * fps} size={80} color="#f4f4ec" />
      <Write text="Tiết 1: Hiệp định Giơnevơ 1954" x={200} y={300} at={l0 + 1.4 * fps} frames={2.4 * fps} size={72} color="#f4f4ec" />
      <Write text="và vì sao chiến tranh với Mỹ xảy ra" x={200} y={420} at={l0 + 4.8 * fps} frames={2.6 * fps} size={64} color="#f4f4ec" />
    </Scene>
  );
};

export const PhapQuayLai: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  const l3 = useLine(3).from;
  const l4 = useLine(4).from;
  const fighting = frame >= l4;
  return (
    <Scene id="phap-quay-lai">
      <Sky />
      <Stage>
        <Character
          look="vm"
          speaker="vm"
          x={fighting ? 620 : 760}
          y={960}
          mood={frame >= l3 ? "angry" : "happy"}
          pose={frame >= l3 && !fighting ? "cross" : fighting ? "point" : "up"}
          facing="right"
          label="Việt Minh"
          prop={frame < l3 ? <Flag kind="vn" wave={frame / 5} size={0.6} /> : undefined}
        />
        <Character
          look="phap"
          speaker="phap"
          x={fighting ? 1300 : 1260}
          y={960}
          mood={frame >= l4 ? "angry" : frame >= l3 ? "shock" : "happy"}
          pose={frame >= l3 ? "hips" : "wave"}
          facing="left"
          label="Pháp"
          enterAt={l1 + 0.8 * fps}
          enterFrom="right"
        />
        {fighting ? (
          <>
            <Burst x={960} y={600} r={110} start={l4 + 0.3 * fps} color="#ff7a1a" rays={16} />
            <Burst x={1000} y={520} r={80} start={l4 + 1.1 * fps} color="#ffd600" rays={12} />
          </>
        ) : null}
        <Bubble at={l3} until={l4} x={830} y={420} text="Ai mời anh về?" width={330} />
      </Stage>
      <Caption text="(Hà Nội, 2/9/1945)" at={l0} />
      {fighting ? <Write text="1946 - 1954" x={760} y={140} at={l4 + 0.4 * fps} frames={1.2 * fps} size={90} color={INK} /> : null}
    </Scene>
  );
};

const DOMINOES = ["Việt Nam", "Lào", "Campuchia", "Thái Lan", "Miến Điện", "Malaysia", "Indonesia"];

export const DominoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const l4 = useLine(4).from;
  const handOff = interpolate(frame, [l2 + 2.2 * fps, l2 + 3.2 * fps], [0, 1], clamp);
  const pie = interpolate(frame, [l2 + 3.5 * fps, l2 + 5 * fps], [0, 0.8], clamp);
  const pieEnd = { x: 160 * Math.sin(pie * Math.PI * 2), y: -160 * Math.cos(pie * Math.PI * 2) };
  const showDominoes = frame < l2;

  return (
    <Scene id="domino" background="#f3ead6">
      <Stage>
        <rect y={900} width={1920} height={180} fill="#d9c7a1" />
        {showDominoes
          ? DOMINOES.map((d, i) => {
              const at = l1 + (1.5 + i * 0.35) * fps;
              const tilt = interpolate(frame, [at, at + 8], [0, 62], clamp);
              return (
                <g key={d} transform={`translate(${720 + i * 150} 860)`}>
                  <Domino label={d} tilt={tilt} />
                </g>
              );
            })
          : null}
        <Character look="my" speaker="my" x={330} y={960} mood={frame >= l2 ? "smug" : "worried"} pose={frame >= l2 ? "hold" : "point"} label="Mỹ" facing="right" />
        {frame >= l2 && handOff < 1 ? (
          <g transform={`translate(${interpolate(handOff, [0, 1], [470, 1380])} ${interpolate(handOff, [0, 1], [730, 720]) - Math.sin(handOff * Math.PI) * 160})`}>
            <MoneyBag size={0.9} />
          </g>
        ) : null}
        {frame >= l2 ? (
          <Character
            look="phap"
            speaker="phap"
            x={1440}
            y={960}
            mood="happy"
            pose={handOff >= 1 ? "hold" : "down"}
            facing="left"
            label="Pháp"
            enterAt={l2 + 0.3 * fps}
            enterFrom="right"
            flip
            prop={handOff >= 1 ? <MoneyBag size={0.9} /> : undefined}
          />
        ) : null}
        {pie > 0 && frame < l4 ? (
          <g transform="translate(900 380)">
            <circle r={160} fill="#fff" stroke={INK} strokeWidth={5} />
            <path d={`M0 0 L0 -160 A160 160 0 ${pie > 0.5 ? 1 : 0} 1 ${pieEnd.x} ${pieEnd.y} Z`} fill="#2e7d32" stroke={INK} strokeWidth={4} />
            <text y={235} textAnchor="middle" fontFamily="Patrick Hand" fontSize={56} fill={INK}>
              Mỹ trả ~80%
            </text>
          </g>
        ) : null}
        <Pop at={l4 + 0.4 * fps} x={960} y={330}>
          <text textAnchor="middle" fontFamily="Patrick Hand" fontSize={84} fill={INK}>
            Pháp đánh, Mỹ trả tiền
          </text>
        </Pop>
      </Stage>
    </Scene>
  );
};

// Positions in the 1920x1080 battle map.
const BLUE_POSTS = [
  [900, 520], [980, 470], [1040, 560], [940, 620], [860, 600], [1010, 650], [960, 760], [1080, 470],
];
const RED_UNITS = [
  [560, 300], [760, 200], [1060, 180], [1360, 260], [1500, 520], [1380, 800], [1060, 930], [700, 880], [480, 640],
];

export const DienBienPhu: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const squeeze = interpolate(frame, [l1 + 2.5 * fps, l2 + 1.5 * fps], [0, 0.55], clamp);

  return (
    <Scene id="dien-bien-phu" background="#5e9a43">
      <Stage>
        <rect width={1920} height={1080} fill="#6aa84f" />
        {/* hills ring the valley */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const x = 960 + Math.cos(a) * 760;
          const y = 540 + Math.sin(a) * 470;
          return <path key={i} d={`M${x - 150} ${y + 80} L${x} ${y - 90} L${x + 150} ${y + 80} Z`} fill="#3f7a32" stroke={INK} strokeWidth={4} />;
        })}
        <path d="M960 0 Q900 300 960 540 Q1020 800 940 1080" fill="none" stroke="#3a6fd0" strokeWidth={34} />
        <text x={1010} y={420} fontFamily="Patrick Hand" fontSize={36} fill="#fff">
          Nậm Rốm
        </text>
        {BLUE_POSTS.map(([x, y], i) => {
          const fall = l2 + (0.2 + i * 0.25) * fps;
          const s = interpolate(frame, [l0 + i * 4, l0 + i * 4 + 8, fall, fall + 6], [0, 1, 1, 0], clamp);
          return s > 0 ? <circle key={i} cx={x} cy={y} r={34 * s} fill="#1e5bb8" stroke={INK} strokeWidth={4} /> : null;
        })}
        {RED_UNITS.map(([x, y], i) => {
          const at = l1 + i * 3;
          const s = interpolate(frame, [at, at + 8], [0, 1], clamp);
          const cx = x + (960 - x) * squeeze;
          const cy = y + (560 - y) * squeeze;
          return s > 0 ? (
            <g key={i}>
              <circle cx={cx} cy={cy} r={34 * s} fill="#d32f2f" stroke={INK} strokeWidth={4} />
              <rect x={cx - 14} y={cy - 6} width={36} height={12} fill={INK} transform={`rotate(${(Math.atan2(560 - cy, 960 - cx) * 180) / Math.PI} ${cx} ${cy})`} opacity={s} />
            </g>
          ) : null;
        })}
        <DrawPath
          d="M960 120 C1450 160 1580 700 1150 900 C700 1050 360 760 480 420 C580 200 860 230 960 300"
          start={l1 + 1.2 * fps}
          frames={2.4 * fps}
          color="#8b1a1a"
          width={8}
        />
        <Pop at={l2 + 3 * fps} x={960} y={600}>
          <Flag kind="vn" wave={frame / 5} size={0.9} />
        </Pop>
        <Character look="phap" speaker="phap" x={1620} y={1060} scale={0.75} mood="worried" pose="wave" label="Pháp" enterAt={l3} enterFrom="bottom" prop={<Flag kind="white" wave={frame / 4} size={0.45} />} />
      </Stage>
      <Caption text="(Điện Biên Phủ, 13/3 – 7/5/1954)" at={l0} color="#fff" />
    </Scene>
  );
};
