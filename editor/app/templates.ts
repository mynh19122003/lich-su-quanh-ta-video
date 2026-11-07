// Ready-made groups of clips ("Mẫu") dropped onto the timeline at the playhead.
import type { Item, Project, SolidItem, StickerItem, TextItem, Track } from "../../src/project/types";
import { uid } from "./store";

type TextOpts = Partial<Omit<TextItem, "id" | "type">> & { text: string; from: number; durationInFrames: number };

const text = (p: Project, o: TextOpts): TextItem => ({
  id: uid(),
  type: "text",
  fontFamily: "Arial",
  fontSize: 64,
  color: "#ffffff",
  strokeColor: "#111111",
  strokeWidth: 0,
  bold: false,
  background: "",
  x: p.width / 2,
  y: p.height / 2,
  opacity: 1,
  ...o,
});

const solid = (from: number, durationInFrames: number, color: string, color2 = ""): SolidItem => ({
  id: uid(),
  type: "solid",
  from,
  durationInFrames,
  color,
  color2,
  opacity: 1,
  transitionOut: { type: "fade", durationInFrames: 12 },
});

const sticker = (o: Omit<StickerItem, "id" | "type" | "flip" | "opacity"> & Partial<StickerItem>): StickerItem => ({
  id: uid(),
  type: "sticker",
  flip: false,
  opacity: 1,
  ...o,
});

// Puts the template's visual items on a new track above the existing pictures and its text on a new top track.
const place = (p: Project, name: string, visuals: Item[], texts: Item[]) => {
  if (visuals.length) {
    const firstVisual = p.tracks.findIndex((t) => t.kind === "visual");
    const t: Track = { id: uid(), kind: "visual", name, items: visuals };
    p.tracks.splice(firstVisual === -1 ? p.tracks.length : firstVisual, 0, t);
  }
  if (texts.length) p.tracks.unshift({ id: uid(), kind: "text", name: `Chữ ${name.toLowerCase()}`, items: texts });
};

export const TEMPLATES: { id: string; name: string; description: string; build: (p: Project, at: number) => void }[] = [
  {
    id: "intro",
    name: "Intro kênh",
    description: "4 giây: nền màu, tên kênh nảy vào, tên tập gõ dần, lá cờ",
    build: (p, at) => {
      const f = p.fps;
      place(
        p,
        "Intro",
        [
          solid(at, 4 * f, "#1f3c88", "#b3261e"),
          sticker({ sticker: "flag-vn", from: at + 0.3 * f, durationInFrames: 3.7 * f, x: p.width * 0.82, y: p.height * 0.62, size: p.height * 0.45, transitionIn: { type: "slide-right", durationInFrames: 15 } }),
        ],
        [
          text(p, { text: "Tên kênh của bạn", from: at, durationInFrames: 4 * f, fontFamily: "Pacifico", fontSize: 130, strokeWidth: 8, y: p.height * 0.4, transitionIn: { type: "pop", durationInFrames: 18 }, transitionOut: { type: "fade", durationInFrames: 12 } }),
          text(p, { text: "Tập 1: Tiêu đề tập", from: at + 0.7 * f, durationInFrames: 3.3 * f, fontFamily: "Patrick Hand", fontSize: 72, y: p.height * 0.56, transitionIn: { type: "typewriter", durationInFrames: 30 }, transitionOut: { type: "fade", durationInFrames: 12 } }),
        ],
      );
    },
  },
  {
    id: "outro",
    name: "Outro đăng ký",
    description: "5 giây: lời cảm ơn, nút ĐĂNG KÝ nhấp nháy, cô giáo vẫy tay",
    build: (p, at) => {
      const f = p.fps;
      place(
        p,
        "Outro",
        [
          solid(at, 5 * f, "#16161c", "#2f4f43"),
          sticker({ sticker: "char-teacher", from: at + 0.4 * f, durationInFrames: 4.6 * f, x: p.width * 0.8, y: p.height * 0.6, size: p.height * 0.6, transitionIn: { type: "slide-right", durationInFrames: 15 } }),
        ],
        [
          text(p, { text: "Cảm ơn bạn đã xem!", from: at, durationInFrames: 5 * f, fontFamily: "Pacifico", fontSize: 110, strokeWidth: 6, x: p.width * 0.42, y: p.height * 0.38, transitionIn: { type: "fade", durationInFrames: 15 } }),
          text(p, {
            text: "ĐĂNG KÝ",
            from: at + f,
            durationInFrames: 4 * f,
            fontSize: 72,
            bold: true,
            background: "#e53935",
            x: p.width * 0.42,
            y: p.height * 0.6,
            transitionIn: { type: "pop", durationInFrames: 15 },
            keyframes: { scale: [0, 20, 30, 40, 50, 60, 70].map((fr, i) => ({ frame: fr + 20, value: i % 2 ? 1.08 : 1 })) },
          }),
        ],
      );
    },
  },
  {
    id: "chapter",
    name: "Tiêu đề chương",
    description: "3 giây: dải chữ trượt vào ở góc dưới",
    build: (p, at) => {
      place(p, "Chương", [], [
        text(p, {
          text: "Chương 1: Tên chương",
          from: at,
          durationInFrames: 3 * p.fps,
          fontSize: 60,
          bold: true,
          background: "rgba(0,0,0,0.75)",
          x: p.width * 0.32,
          y: p.height - 190,
          transitionIn: { type: "slide-left", durationInFrames: 14 },
          transitionOut: { type: "slide-left", durationInFrames: 12 },
        }),
      ]);
    },
  },
  {
    id: "place",
    name: "Chú thích địa điểm",
    description: "3 giây: dòng “(Hà Nội, 2/9/1945)” ở trên cùng",
    build: (p, at) => {
      place(p, "Chú thích", [], [
        text(p, {
          text: "(Hà Nội, 2/9/1945)",
          from: at,
          durationInFrames: 3 * p.fps,
          fontFamily: "Patrick Hand",
          fontSize: 56,
          color: "#1d1d1d",
          strokeColor: "#ffffff",
          strokeWidth: 6,
          y: 70,
          transitionIn: { type: "fade", durationInFrames: 10 },
          transitionOut: { type: "fade", durationInFrames: 10 },
        }),
      ]);
    },
  },
  {
    id: "quote",
    name: "Trích dẫn",
    description: "5 giây: nền giấy, câu nói gõ dần và tên người nói",
    build: (p, at) => {
      const f = p.fps;
      place(
        p,
        "Trích dẫn",
        [solid(at, 5 * f, "#f2e6cc", "#e2cfa6")],
        [
          text(p, { text: "“Không có gì quý hơn\nđộc lập, tự do”", from: at, durationInFrames: 5 * f, fontFamily: "Patrick Hand", fontSize: 88, color: "#1d1d1d", y: p.height * 0.45, transitionIn: { type: "typewriter", durationInFrames: 45 } }),
          text(p, { text: "— Hồ Chí Minh", from: at + 1.8 * f, durationInFrames: 3.2 * f, fontFamily: "Patrick Hand", fontSize: 56, color: "#b3261e", x: p.width * 0.62, y: p.height * 0.66, transitionIn: { type: "fade", durationInFrames: 15 } }),
        ],
      );
    },
  },
  {
    id: "solid",
    name: "Nền màu",
    description: "5 giây: một nền màu trơn để đặt chữ, nhãn dán lên trên",
    build: (p, at) => place(p, "Nền", [{ ...solid(at, 5 * p.fps, "#22313f"), transitionOut: undefined }], []),
  },
];
