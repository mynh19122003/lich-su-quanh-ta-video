import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { HandwrittenText } from "../../handwriting/HandwrittenText";
import { DrawPath } from "../../sketches/primitives";
import { Character } from "../Character";
import { Caption, HAND_FONT, INK, Pop, Stage } from "../Common";
import { IndochinaMap } from "../IndochinaMap";
import { BallotBox, Board, Calendar, Flag, Flame } from "../Props";
import { Scene, useLine } from "../SceneContext";

const RED = "#d23a2c";
const YELLOW = "#f2c94c";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Write: React.FC<{ text: string; x: number; y: number; at: number; frames: number; size?: number; color?: string }> = ({
  text,
  x,
  y,
  at,
  frames,
  size = 60,
  color = INK,
}) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <HandwrittenText text={text} fontFile={HAND_FONT} fontSize={size} color={color} startFrame={at} writeFrames={frames} showPen={false} />
  </div>
);

const BigText: React.FC<{ at: number; x: number; y: number; text: string; size?: number; color?: string; until?: number }> = ({
  at,
  x,
  y,
  text,
  size = 90,
  color = "#fff",
  until,
}) => (
  <Pop at={at} x={x} y={y} until={until}>
    <text textAnchor="middle" fontFamily="Patrick Hand" fontSize={size} fill={color} stroke={INK} strokeWidth={size / 10} paintOrder="stroke">
      {text}
    </text>
  </Pop>
);

export const DiemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  const l2 = useLine(2);
  const l3 = useLine(3);
  const l4 = useLine(4).from;
  const fill = interpolate(frame, [l2.from + 4 * fps, l3.from + 4 * fps], [0, 1.6], clamp);
  return (
    <Scene id="diem" background="#f1d27a">
      <Stage>
        <rect y={880} width={1920} height={200} fill="#b5895a" />
        <Character look="my" x={260} y={1000} scale={0.85} mood="smug" pose={frame < l1 ? "point" : "cross"} facing="right" label="Mỹ" />
        <Character
          look="diem"
          speaker="diem"
          x={720}
          y={1000}
          scale={0.95}
          mood={frame >= l3.from ? "smug" : "happy"}
          pose={frame >= l4 ? "up" : frame >= l1 && frame < l2.from ? "wave" : "down"}
          facing="right"
          label="Ngô Đình Diệm"
          enterAt={l0 + 2.2 * fps}
          enterFrom="right"
        />
        {frame >= l2.from - 10 ? (
          <>
            <Pop at={l2.from} x={1150} y={990}>
              <BallotBox fill={Math.min(fill, 1)} />
              {fill > 1
                ? Array.from({ length: 10 }, (_, i) => {
                    const t = (fill - 1 + i * 0.07) % 0.6;
                    return (
                      <rect
                        key={i}
                        x={-30 + Math.sin(i * 2.1) * 200 * t * 2}
                        y={-200 - t * 500}
                        width={44}
                        height={28}
                        fill="#fff"
                        stroke={INK}
                        strokeWidth={2}
                        transform={`rotate(${i * 40 + frame * 4})`}
                      />
                    );
                  })
                : null}
            </Pop>
            <Character look="baodai" x={1600} y={1000} scale={0.9} mood={frame >= l2.from + 3 * fps ? "shock" : "neutral"} label="Bảo Đại" exitAt={l2.from + 4.5 * fps} enterFrom="right" />
          </>
        ) : null}
        <BigText at={l2.from + 5 * fps} x={1500} y={400} text="98,2%" size={150} until={l3.from} />
        <Pop at={l3.from + 1 * fps} x={1430} y={330} until={l4}>
          <rect x={-330} y={-130} width={660} height={230} rx={16} fill="#fff" stroke={INK} strokeWidth={5} />
          <text y={-60} textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill={INK}>
            Sài Gòn, 1955
          </text>
          <text y={10} textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill={INK}>
            Phiếu bầu: 605.025
          </text>
          <text y={70} textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill="#c62828">
            Cử tri đăng ký: ~450.000
          </text>
        </Pop>
        <Pop at={l4 + 1.4 * fps} x={1400} y={300}>
          <rect x={-380} y={-80} width={760} height={140} rx={16} fill="#ffd600" stroke={INK} strokeWidth={5} />
          <text y={18} textAnchor="middle" fontFamily="Patrick Hand" fontSize={58} fill="#b71c1c">
            Việt Nam Cộng hòa (26/10/1955)
          </text>
        </Pop>
      </Stage>
    </Scene>
  );
};

export const NamNamSau: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const l4 = useLine(4).from;
  const mark = interpolate(frame, [l2 + 1.6 * fps, l2 + 2 * fps], [0, 1], clamp);
  const wall = spring({ frame: frame - (l4 + 2.5 * fps), fps, config: { damping: 18 } });
  const pie = interpolate(frame, [l3 + 4.5 * fps, l3 + 6 * fps], [0, 0.8], clamp);
  const pieEnd = { x: 150 * Math.sin(pie * Math.PI * 2), y: -150 * Math.cos(pie * Math.PI * 2) };
  return (
    <Scene id="1956" background="#efe6d2">
      <Stage>
        <rect y={900} width={1920} height={180} fill="#c9b48e" />
        {frame < l3 ? (
          <Pop at={l0} x={960} y={420}>
            <Calendar month="Tháng 7" year="1956" mark={mark} />
          </Pop>
        ) : null}
        {frame >= l3 && frame < l4 ? (
          <>
            <Pop at={l3 + 0.5 * fps} x={800} y={430}>
              <rect x={-170} y={-210} width={340} height={420} rx={8} fill="#2a4d7a" stroke={INK} strokeWidth={5} />
              <rect x={-150} y={-190} width={300} height={380} rx={4} fill="none" stroke="#e0c070" strokeWidth={3} />
              <text y={-60} textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill="#fff">
                Hồi ký
              </text>
              <text y={0} textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill="#fff">
                Eisenhower
              </text>
              <text y={90} textAnchor="middle" fontFamily="Patrick Hand" fontSize={36} fill="#e0c070">
                1963
              </text>
            </Pop>
            {pie > 0 ? (
              <g transform="translate(1200 420)">
                <circle r={150} fill="#fff" stroke={INK} strokeWidth={5} />
                <path d={`M0 0 L0 -150 A150 150 0 ${pie > 0.5 ? 1 : 0} 1 ${pieEnd.x} ${pieEnd.y} Z`} fill="#d32f2f" stroke={INK} strokeWidth={4} />
                <text y={215} textAnchor="middle" fontFamily="Patrick Hand" fontSize={50} fill={INK}>
                  ~80% bầu cho Hồ Chí Minh
                </text>
              </g>
            ) : null}
          </>
        ) : null}
        <Character
          look="vm"
          speaker="vm"
          x={260}
          y={1000}
          scale={0.9}
          mood={frame >= l2 ? "angry" : "happy"}
          pose={frame >= l1 && frame < l2 ? "hold" : "down"}
          facing="right"
          label="VNDCCH"
          enterAt={l1 - 0.6 * fps}
          prop={frame < l2 ? <rect x={-10} y={-50} width={90} height={60} fill="#fff" stroke={INK} strokeWidth={4} /> : undefined}
        />
        <Character
          look="diem"
          speaker="diem"
          x={1660}
          y={1000}
          scale={0.9}
          mood="angry"
          pose="cross"
          facing="left"
          label="Ngô Đình Diệm"
          enterAt={l2 - 0.6 * fps}
          enterFrom="right"
        />
        {wall > 0 ? (
          <g transform={`translate(860 ${1000 + (1 - wall) * 700})`}>
            {Array.from({ length: 10 }, (_, row) =>
              Array.from({ length: 3 }, (_, col) => (
                <rect key={`${row}-${col}`} x={col * 70 - (row % 2) * 35 + 10} y={-(row + 1) * 62} width={70} height={62} fill="#b5523b" stroke={INK} strokeWidth={4} />
              )),
            )}
            <text x={110} y={-680} textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill={INK}>
              vĩ tuyến 17
            </text>
          </g>
        ) : null}
      </Stage>
    </Scene>
  );
};

const FIRES: [number, number][] = [
  [106.37, 10.24], [106.0, 10.0], [105.6, 9.6], [106.7, 10.6], [105.4, 10.4], [107.2, 11.2],
  [108.3, 12.4], [108.9, 14.6], [108.0, 15.3], [107.6, 13.6], [105.2, 9.3], [106.6, 11.6],
];

export const DongKhoi: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const dark = interpolate(frame, [l0, l0 + 2 * fps, l1 + 3 * fps, l1 + 5 * fps], [0, 0.45, 0.45, 0.1], clamp);
  return (
    <Scene id="dong-khoi">
      <IndochinaMap width={1920} height={1080} bounds={[[102.5, 8.3], [111, 17.6]]} split={{ lat: 17, north: RED, south: YELLOW }}>
        {(p) => (
          <g>
            <rect width={1920} height={1080} fill="#000" opacity={dark} />
            {FIRES.map(([lon, lat], i) => {
              const [x, y] = p(lon, lat);
              const at = l1 + (2.8 + i * 0.35) * fps;
              const s = spring({ frame: frame - at, fps, config: { damping: 10 } });
              const flicker = 1 + Math.sin(frame / 2 + i) * 0.08;
              return frame >= at ? (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <Flame s={s * flicker * (i === 0 ? 1.4 : 1)} />
                </g>
              ) : null;
            })}
            {(() => {
              const [x, y] = p(106.37, 10.24);
              return (
                <Pop at={l1 + 3 * fps} x={x - 380} y={y - 30}>
                  <text fontFamily="Patrick Hand" fontSize={46} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">
                    Bến Tre (1960)
                  </text>
                </Pop>
              );
            })()}
            {(() => {
              const [x, y] = p(107.6, 12.6);
              return (
                <Pop at={l2 + 1 * fps} x={x} y={y + 120}>
                  <Flag kind="mt" wave={frame / 5} size={1.1} />
                </Pop>
              );
            })()}
          </g>
        )}
      </IndochinaMap>
      <Stage>
        <BigText at={l0 + 1.5 * fps} x={600} y={200} text="“Tố cộng, diệt cộng”" size={70} until={l1} />
        <Pop at={l0 + 4.5 * fps} x={600} y={330} until={l1}>
          <g transform="rotate(-8)">
            <rect x={-210} y={-60} width={420} height={110} fill="none" stroke="#c62828" strokeWidth={8} />
            <text y={22} textAnchor="middle" fontFamily="Patrick Hand" fontSize={70} fill="#c62828">
              LUẬT 10/59
            </text>
          </g>
        </Pop>
      </Stage>
      <Caption text="Mặt trận Dân tộc Giải phóng miền Nam Việt Nam (20/12/1960)" at={l2 + 1.5 * fps} color="#fff" />
    </Scene>
  );
};

export const MyVao: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0);
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const grow = interpolate(frame, [l0.from + 2 * fps, l0.to], [0, 1], clamp);
  const count = Math.round(900 + grow * (16000 - 900));
  const year = Math.round(1960 + grow * 3);

  if (frame >= l2) {
    return (
      <Scene id="my-vao">
        <IndochinaMap width={1920} height={1080} bounds={[[100.5, 8], [112, 23.6]]} split={{ lat: 17, north: RED, south: YELLOW }}>
          {(p) => {
            const [gx, gy] = p(107.6, 19.4);
            const [dx, dy] = p(108.22, 16.05);
            const [sx, sy] = p(111.3, 15.4);
            return (
              <g>
                <Pop at={l2 + 0.6 * fps} x={gx} y={gy}>
                  <path d="M-60 0 L60 0 L45 25 L-45 25 Z" fill="#7b8794" stroke={INK} strokeWidth={4} />
                  <rect x={-20} y={-30} width={40} height={30} fill="#7b8794" stroke={INK} strokeWidth={4} />
                  <text y={70} textAnchor="middle" fontFamily="Patrick Hand" fontSize={40} fill="#fff" stroke={INK} strokeWidth={5} paintOrder="stroke">
                    Vịnh Bắc Bộ, 8/1964
                  </text>
                </Pop>
                <DrawPath d={`M${sx} ${sy} Q${(sx + dx) / 2} ${sy - 140} ${dx + 10} ${dy}`} start={l2 + 3 * fps} frames={1.2 * fps} color="#1f3c88" width={12} />
                <Pop at={l2 + 4.2 * fps} x={dx + 40} y={dy + 80}>
                  <text fontFamily="Patrick Hand" fontSize={44} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">
                    Đà Nẵng, 8/3/1965
                  </text>
                </Pop>
              </g>
            );
          }}
        </IndochinaMap>
        <Stage>
          <Character look="my" speaker="my" x={1600} y={1060} scale={0.8} mood="angry" pose="hold" label="Mỹ" enterAt={l3 + 0.3 * fps} enterFrom="right" prop={<Flag kind="us" wave={frame / 5} size={0.6} />} />
        </Stage>
      </Scene>
    );
  }

  return (
    <Scene id="my-vao" background="#e8eef3">
      <Stage>
        <rect y={900} width={1920} height={180} fill="#9fb3c2" />
        <Character
          look="my"
          speaker="my"
          x={360}
          y={1000}
          scale={0.95}
          mood={frame >= l1 ? "smug" : "neutral"}
          pose={frame >= l1 ? "shrug" : "point"}
          facing="right"
          label="Mỹ"
        />
        {Array.from({ length: Math.round(grow * 40) }, (_, i) => {
          const x = 760 + (i % 10) * 100;
          const y = 820 - Math.floor(i / 10) * 120;
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M-36 0 Q-34 -50 0 -52 Q34 -50 36 0 Z" fill="#5b6b3a" stroke={INK} strokeWidth={4} />
              <rect x={-44} y={-6} width={88} height={10} fill="#4a5830" stroke={INK} strokeWidth={3} />
            </g>
          );
        })}
        <Pop at={l0.from + 1 * fps} x={1250} y={190}>
          <rect x={-380} y={-90} width={760} height={170} rx={16} fill="#fff" stroke={INK} strokeWidth={5} />
          <text y={-20} textAnchor="middle" fontFamily="Patrick Hand" fontSize={48} fill={INK}>
            Cố vấn quân sự Mỹ ({year})
          </text>
          <text y={55} textAnchor="middle" fontFamily="Patrick Hand" fontSize={72} fill="#c62828">
            ~{count.toLocaleString("vi-VN")}
          </text>
        </Pop>
      </Stage>
    </Scene>
  );
};

export const Ket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0);
  const l1 = useLine(1);
  const l2 = useLine(2).from;
  const press = frame >= l2 + 3.2 * fps;
  return (
    <Scene id="ket" background="#e9e2cf">
      <Stage>
        <rect y={900} width={1920} height={180} fill="#b98c5a" />
        <Board kind="chalk" x={100} y={90} w={1300} h={680} />
        <Character look="teacher" speaker="teacher" x={1620} y={960} scale={1} mood="happy" pose={frame >= l2 ? "wave" : "point"} facing="left" flip />
        <Pop at={l2 + 2 * fps} x={1150} y={870}>
          <rect x={-170} y={-60} width={340} height={100} rx={12} fill={press ? "#888" : "#e53935"} stroke={INK} strokeWidth={4} />
          <text y={8} textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize={44} fill="#fff">
            {press ? "ĐÃ ĐĂNG KÝ" : "ĐĂNG KÝ"}
          </text>
          <path
            d="M0 0 L0 60 L16 46 L28 72 L38 68 L26 42 L46 42 Z"
            fill="#fff"
            stroke={INK}
            strokeWidth={3}
            transform={`translate(${interpolate(frame, [l2 + 2.2 * fps, l2 + 3.1 * fps], [220, 60], clamp)} ${interpolate(frame, [l2 + 2.2 * fps, l2 + 3.1 * fps], [80, 0], clamp)})`}
          />
        </Pop>
      </Stage>
      <Write text="Tóm lại:" x={160} y={110} at={l0.from} frames={0.8 * fps} size={74} color="#f4f4ec" />
      <Write text="1954: chia cắt TẠM THỜI, hẹn tổng tuyển cử" x={160} y={230} at={l0.from + 1 * fps} frames={3 * fps} size={58} color="#f4f4ec" />
      <Write text="1956: Mỹ - Diệm phá bỏ tổng tuyển cử" x={160} y={340} at={l1.from + 0.3 * fps} frames={2.6 * fps} size={58} color="#f4f4ec" />
      <Write text="=> Kháng chiến chống Mỹ cứu nước" x={160} y={470} at={l1.from + 4 * fps} frames={2.4 * fps} size={66} color="#ffd54a" />
      <Write text="(1954 - 1975)" x={160} y={570} at={l1.from + 6.6 * fps} frames={1.2 * fps} size={66} color="#ffd54a" />
    </Scene>
  );
};
