import React from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { HandwrittenText } from "../../handwriting/HandwrittenText";
import { DrawPath } from "../../sketches/primitives";
import { Character, type Look, type Mood, type Pose } from "../Character";
import { Caption, HAND_FONT, INK, Pop, Stage } from "../Common";
import { IndochinaMap } from "../IndochinaMap";
import { Board, Placard, Room, StickyNote, Table } from "../Props";
import { Scene, useLine } from "../SceneContext";
import type { Speaker } from "../timeline";

const RED = "#d23a2c";
const YELLOW = "#f2c94c";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Delegate = { look: Look; name: string; speaker?: Speaker };
const DELEGATES: Delegate[] = [
  { look: "phap", name: "Pháp", speaker: "phap" },
  { look: "vm", name: "VNDCCH", speaker: "vm" },
  { look: "lienxo", name: "Liên Xô" },
  { look: "anh", name: "Anh" },
  { look: "tq", name: "Trung Quốc", speaker: "tq" },
  { look: "my", name: "Mỹ", speaker: "my" },
  { look: "suit", name: "Lào" },
  { look: "suit", name: "Campuchia" },
  { look: "suit", name: "Quốc gia VN" },
];
const seatX = (i: number) => 125 + i * 209;
const SUITS = ["#4a4f5c", "#4a4f5c", "#4a4f5c", "#4a4f5c", "#4a4f5c", "#4a4f5c", "#6d4c7d", "#7d5a3c", "#8a7a2c"];

const Conference: React.FC<{
  appearAt: (i: number) => number;
  moodOf: (i: number) => Mood;
  poseOf: (i: number) => Pose;
  extra?: React.ReactNode;
}> = ({ appearAt, moodOf, poseOf, extra }) => (
  <Stage>
    <Room />
    {DELEGATES.map((d, i) => (
      <Character
        key={i}
        look={d.look}
        speaker={d.speaker}
        suitColor={d.look === "suit" ? SUITS[i] : undefined}
        x={seatX(i)}
        y={840}
        scale={0.62}
        mood={moodOf(i)}
        pose={poseOf(i)}
        enterAt={appearAt(i)}
        enterFrom="bottom"
      />
    ))}
    <Table />
    {DELEGATES.map((d, i) => (
      <Pop key={i} at={appearAt(i) + 6} x={seatX(i)} y={812}>
        <Placard text={d.name} />
      </Pop>
    ))}
    {extra}
  </Stage>
);

export const HoiNghi: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1);
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const l4 = useLine(4).from;
  const step = (l1.to - l1.from - fps) / DELEGATES.length;
  return (
    <Scene id="hoi-nghi">
      <Conference
        appearAt={(i) => l1.from + 0.6 * fps + i * step}
        moodOf={(i) => (i === 5 && frame >= l3 ? "smug" : i === 1 ? "happy" : i === 0 ? "worried" : "neutral")}
        poseOf={(i) => (i === 5 && frame >= l3 ? "cross" : "down")}
        extra={
          <>
            {[2, 3].map((i) => (
              <Pop key={i} at={l2 + 0.3 * fps} x={seatX(i)} y={500}>
                <text textAnchor="middle" fontFamily="Patrick Hand" fontSize={34} fill="#7a1a1a">
                  Đồng chủ tịch
                </text>
              </Pop>
            ))}
            <Pop at={l4 + 1.5 * fps} x={960} y={300}>
              <StickyNote lines={["Ghi nhớ:", "“chỉ ngồi xem thôi”"]} />
            </Pop>
          </>
        }
      />
      <Caption text="(Giơnevơ, Thụy Sĩ, 8/5/1954)" at={l0} />
    </Scene>
  );
};

export const ViTuyen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const l4 = useLine(4).from;
  const l5 = useLine(5).from;
  const l6 = useLine(6).from;
  const l7 = useLine(7).from;

  const settle = l7 + 1.8 * fps;
  let lat = 13;
  if (frame >= l2) {
    lat = interpolate(frame, [l2 + 0.8 * fps, l2 + 1.4 * fps], [13, 18], clamp);
  }
  if (frame >= l3 + 1 * fps) {
    lat = 15.5 + 2.5 * Math.cos((frame - l3 - fps) / 14);
  }
  if (frame >= settle - 0.8 * fps) {
    const from = 15.5 + 2.5 * Math.cos((settle - 0.8 * fps - l3 - fps) / 14);
    lat = interpolate(frame, [settle - 0.8 * fps, settle], [from, 17], clamp);
  }
  const lineShown = frame >= l1 + 0.8 * fps;
  const south = interpolateColors(frame, [settle, settle + 0.5 * fps], [RED, YELLOW]);
  const daysLeft = Math.max(1, Math.round(interpolate(frame, [l4 + 1.5 * fps, l7 + 1.5 * fps], [30, 1], clamp)));

  return (
    <Scene id="vi-tuyen">
      <IndochinaMap width={1920} height={1080} bounds={[[100.5, 8], [112, 23.6]]} split={{ lat: frame >= settle ? 17 : 0, north: RED, south }}>
        {(p) => {
          const [x0, y] = p(101, lat);
          const [x1] = p(111.5, lat);
          return lineShown ? (
            <g>
              <line x1={x0} y1={y} x2={x1} y2={y} stroke="#fff" strokeWidth={8} strokeDasharray="22 14" />
              <text x={x1 - 10} y={y - 18} textAnchor="end" fontFamily="Patrick Hand" fontSize={52} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">
                {frame >= settle ? "Vĩ tuyến 17 - sông Bến Hải" : `Vĩ tuyến ${Math.round(lat)}`}
              </text>
            </g>
          ) : null;
        }}
      </IndochinaMap>
      <Stage>
        <Character look="vm" speaker="vm" x={250} y={1060} scale={0.75} mood={frame >= l2 ? "angry" : "happy"} pose={frame >= l1 && frame < l2 ? "point" : "hips"} facing="right" label="VNDCCH" />
        <Character look="phap" speaker="phap" x={1680} y={1060} scale={0.75} mood={frame >= l4 && frame < l5 ? "angry" : "smug"} pose={frame >= l2 && frame < l3 ? "point" : frame >= l4 && frame < l5 ? "up" : "cross"} facing="left" label="Pháp" flip />
        <Character look="lienxo" x={560} y={1060} scale={0.7} mood="neutral" pose="hips" label="Liên Xô" enterAt={l5 + 0.5 * fps} enterFrom="bottom" />
        <Character look="tq" speaker="tq" x={1330} y={1060} scale={0.7} mood={frame >= l6 ? "happy" : "neutral"} pose={frame >= l6 && frame < l7 ? "shrug" : "down"} label="Trung Quốc" enterAt={l5 + 0.9 * fps} enterFrom="bottom" />
        <Pop at={l4 + 1.2 * fps} x={1700} y={250}>
          <rect x={-120} y={-110} width={240} height={220} rx={12} fill="#fff" stroke={INK} strokeWidth={5} />
          <rect x={-120} y={-110} width={240} height={60} rx={12} fill="#1f3c88" stroke={INK} strokeWidth={5} />
          <text y={-68} textAnchor="middle" fontFamily="Patrick Hand" fontSize={34} fill="#fff">
            còn lại
          </text>
          <text y={50} textAnchor="middle" fontFamily="Patrick Hand" fontSize={100} fill={INK}>
            {daysLeft}
          </text>
          <text y={95} textAnchor="middle" fontFamily="Patrick Hand" fontSize={32} fill={INK}>
            ngày
          </text>
        </Pop>
      </Stage>
    </Scene>
  );
};

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

export const NoiDung: React.FC = () => {
  const { fps } = useVideoConfig();
  const l = [useLine(0), useLine(1), useLine(2), useLine(3), useLine(4), useLine(5)];
  const write = (i: number) => ({ at: l[i].from + 0.2 * fps, frames: Math.min(3 * fps, (l[i].to - l[i].from) * 0.75) });
  return (
    <Scene id="noi-dung" background="#efe6d2">
      <Stage>
        <rect y={930} width={1920} height={150} fill="#c9b48e" />
        <Board kind="white" x={240} y={70} w={1440} h={720} />
        <DrawPath d="M1080 540 C1300 530 1290 650 1060 648 C860 650 840 545 1080 540" start={l[4].from + 3.4 * fps} frames={0.8 * fps} color="#d32f2f" width={6} />
      </Stage>
      <Write text="Hiệp định Giơnevơ (21/7/1954)" x={300} y={90} {...write(0)} size={74} color="#1f3c88" />
      <Write text="1. Ngừng bắn trên toàn Đông Dương" x={300} y={225} {...write(1)} />
      <Write text="2. Vĩ tuyến 17: giới tuyến quân sự TẠM THỜI" x={300} y={330} {...write(2)} />
      <Write text="3. Tập kết, chuyển quân trong 300 ngày" x={300} y={435} {...write(3)} />
      <Write text="4. Tổng tuyển cử thống nhất: tháng 7/1956" x={300} y={540} {...write(4)} />
      <Write text="Giám sát: Ấn Độ - Ba Lan - Canada" x={300} y={665} {...write(5)} size={54} color="#2e7d32" />
    </Scene>
  );
};

export const KhongTanThanh: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0);
  const l1 = useLine(1).from;
  const l2 = useLine(2).from;
  const refuse = l0.from + (l0.to - l0.from) * 0.62;
  const refusers = [5, 8];
  return (
    <Scene id="khong-tan-thanh">
      <Conference
        appearAt={() => -100}
        moodOf={(i) => (refusers.includes(i) ? (frame >= refuse ? "smug" : "neutral") : frame >= refuse ? "shock" : "happy")}
        poseOf={(i) => (refusers.includes(i) && frame >= refuse ? "cross" : "down")}
        extra={
          <>
            <Pop at={l0.from + 0.3 * fps} x={960} y={330}>
              <rect x={-190} y={-140} width={380} height={250} fill="#fff" stroke={INK} strokeWidth={5} />
              <text y={-80} textAnchor="middle" fontFamily="Patrick Hand" fontSize={42} fill={INK}>
                Tuyên bố cuối cùng
              </text>
              {[-30, 10, 50].map((y) => (
                <line key={y} x1={-150} y1={y} x2={150} y2={y} stroke="#999" strokeWidth={4} />
              ))}
            </Pop>
            {refusers.map((i) => (
              <Pop key={i} at={refuse} x={seatX(i)} y={620}>
                <g stroke="#d32f2f" strokeWidth={14} strokeLinecap="round">
                  <line x1={-60} y1={-60} x2={60} y2={60} />
                  <line x1={60} y1={-60} x2={-60} y2={60} />
                </g>
              </Pop>
            ))}
            <Pop at={l1} x={seatX(5) + 130} y={600} until={l2}>
              <rect x={-60} y={-80} width={120} height={150} fill="#fffbe0" stroke={INK} strokeWidth={4} />
              <text y={-30} textAnchor="middle" fontFamily="Patrick Hand" fontSize={30} fill={INK}>
                đã
              </text>
              <text y={10} textAnchor="middle" fontFamily="Patrick Hand" fontSize={30} fill={INK}>
                ghi nhận
              </text>
            </Pop>
            <Pop at={l2 + 0.6 * fps} x={960} y={300}>
              <StickyNote lines={["Ghi nhớ:", "“chỉ ngồi xem thôi”"]} />
            </Pop>
          </>
        }
      />
    </Scene>
  );
};

export const BaTramNgay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l0 = useLine(0).from;
  const l1 = useLine(1);
  const l2 = useLine(2).from;
  const l3 = useLine(3).from;
  const day = Math.round(interpolate(frame, [l0 + 0.5 * fps, l1.to], [1, 300], clamp));
  const mid = l1.from + (l1.to - l1.from) * 0.5;

  return (
    <Scene id="300-ngay">
      <IndochinaMap width={1920} height={1080} bounds={[[100.5, 8], [112, 23.6]]} split={{ lat: 17, north: RED, south: YELLOW }}>
        {(p) => {
          const pt = (lon: number, lat: number) => p(lon, lat).join(" ");
          const [x0, y17] = p(105.7, 17);
          const [x1] = p(107.6, 17);
          return (
            <g>
              <line x1={x0} y1={y17} x2={x1} y2={y17} stroke="#fff" strokeWidth={7} strokeDasharray="18 12" />
              {[0, 1, 2].map((k) => (
                <DrawPath
                  key={`s${k}`}
                  d={`M${pt(106.9 + k * 0.15, 20.6)} Q${pt(111 + k * 0.5, 15.5)} ${pt(107.1 + k * 0.1, 10.6)}`}
                  start={l1.from + (0.3 + k * 0.4) * fps}
                  frames={1.6 * fps}
                  color="#ffffff"
                  width={9}
                />
              ))}
              {[
                [105.4, 9.0],
                [109.3, 13.8],
                [107.3, 10.3],
              ].map(([lon, lat], k) => (
                <DrawPath
                  key={`n${k}`}
                  d={`M${pt(lon, lat)} Q${pt(109.6 + k * 0.25, 16.2)} ${pt(106.2, 19.9)}`}
                  start={mid + k * 0.4 * fps}
                  frames={1.6 * fps}
                  color="#7a0d0d"
                  width={9}
                />
              ))}
            </g>
          );
        }}
      </IndochinaMap>
      <Stage>
        <Pop at={l1.from + 1 * fps} x={1560} y={700}>
          <text textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">
            ~1 triệu người vào Nam
          </text>
        </Pop>
        <Pop at={mid + 0.5 * fps} x={1480} y={470}>
          <text textAnchor="middle" fontFamily="Patrick Hand" fontSize={46} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">
            hàng chục nghìn người ra Bắc
          </text>
        </Pop>
        <Pop at={l0 + 0.3 * fps} x={1700} y={150}>
          <rect x={-150} y={-70} width={300} height={130} rx={14} fill="#fff" stroke={INK} strokeWidth={5} />
          <text y={22} textAnchor="middle" fontFamily="Patrick Hand" fontSize={64} fill={INK}>
            Ngày {day}
          </text>
        </Pop>
        <Character look="vm" speaker="vm" x={300} y={1060} scale={0.72} mood="sad" pose="wave" facing="right" enterAt={l2 - 0.4 * fps} enterFrom="left" />
        <Character look="dan" x={520} y={1060} scale={0.62} mood="sad" pose="wave" facing="left" flip enterAt={l2 - 0.2 * fps} enterFrom="left" />
        <Pop at={l3 + 2.2 * fps} x={1350} y={900}>
          <text textAnchor="middle" fontFamily="Patrick Hand" fontSize={78} fill="#fff" stroke={INK} strokeWidth={8} paintOrder="stroke">
            ...hơn 20 năm
          </text>
        </Pop>
      </Stage>
    </Scene>
  );
};
