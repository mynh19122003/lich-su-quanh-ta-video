import React from "react";
import { Character, type Look, type Mood, type Pose } from "../geneva/Character";
import { IndochinaMap } from "../geneva/IndochinaMap";
import { BallotBox, Flag, MoneyBag, Popcorn } from "../geneva/Props";

type Sticker = {
  name: string;
  group: "Nhân vật" | "Cờ" | "Đồ vật" | "Bản đồ";
  aspect: number; // width / height
  render: (height: number, frame: number, talking?: boolean) => React.ReactNode;
};

const character = (look: Look, name: string, mood: Mood = "neutral", pose: Pose = "down"): Sticker => ({
  name,
  group: "Nhân vật",
  aspect: 400 / 560,
  render: (h, _frame, talking) => (
    <svg height={h} width={(h * 400) / 560} viewBox="-200 -545 400 560" style={{ overflow: "visible" }}>
      <Character look={look} x={0} y={0} mood={mood} pose={pose} talking={!!talking} />
    </svg>
  ),
});

const flag = (kind: "vn" | "mt" | "fr" | "us" | "white", name: string): Sticker => ({
  name,
  group: "Cờ",
  aspect: 170 / 280,
  render: (h, frame) => (
    <svg height={h} width={(h * 170) / 280} viewBox="-12 -272 170 280" style={{ overflow: "visible" }}>
      <Flag kind={kind} wave={frame / 5} />
    </svg>
  ),
});

const prop = (name: string, viewBox: string, aspect: number, node: React.ReactNode): Sticker => ({
  name,
  group: "Đồ vật",
  aspect,
  render: (h) => (
    <svg height={h} width={h * aspect} viewBox={viewBox} style={{ overflow: "visible" }}>
      {node}
    </svg>
  ),
});

export const STICKERS: Record<string, Sticker> = {
  "char-vm": character("vm", "Việt Minh", "happy"),
  "char-phap": character("phap", "Pháp", "smug", "hips"),
  "char-my": character("my", "Mỹ", "smug", "cross"),
  "char-lienxo": character("lienxo", "Liên Xô"),
  "char-tq": character("tq", "Trung Quốc"),
  "char-anh": character("anh", "Anh"),
  "char-diem": character("diem", "Ngô Đình Diệm"),
  "char-baodai": character("baodai", "Bảo Đại"),
  "char-teacher": character("teacher", "Cô giáo", "happy", "wave"),
  "char-dan": character("dan", "Người dân", "worried", "shrug"),
  "char-nixon": character("nixon", "Níchxơn", "smug", "point"),
  "char-kissinger": character("kissinger", "Kítxinhgiơ", "neutral", "hold"),
  "char-letho": character("letho", "Lê Đức Thọ", "neutral", "down"),
  "char-hcm": character("hcm", "Chủ tịch Hồ Chí Minh", "happy", "down"),
  "char-mao": character("mao", "Mao Trạch Đông", "smug", "down"),
  "char-brezhnev": character("brezhnev", "Brêgiơnép", "neutral", "down"),
  "flag-vn": flag("vn", "Cờ đỏ sao vàng"),
  "flag-mt": flag("mt", "Cờ Mặt trận"),
  "flag-fr": flag("fr", "Cờ Pháp"),
  "flag-us": flag("us", "Cờ Mỹ"),
  "flag-white": flag("white", "Cờ trắng"),
  "prop-money": prop("Túi tiền", "-60 -120 120 125", 120 / 125, <MoneyBag />),
  "prop-ballot": prop("Thùng phiếu", "-115 -165 230 170", 230 / 170, <BallotBox fill={0.5} />),
  "prop-popcorn": prop("Bỏng ngô", "-85 -205 170 210", 170 / 210, <Popcorn />),
  "map-vn": {
    name: "Bản đồ Việt Nam",
    group: "Bản đồ",
    aspect: 0.75,
    render: (h) => <IndochinaMap width={h * 0.75} height={h} bounds={[[101, 8], [111, 23.5]]} />,
  },
};
