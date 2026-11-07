import { Thumbnail } from "@remotion/player";
import React, { useRef, useState } from "react";
import { EMBEDDABLE } from "../../src/project/compositions";
import { STICKERS } from "../../src/project/stickers";
import type { Project, TextItem } from "../../src/project/types";
import { fmtTime } from "./store";
import { TEMPLATES } from "./templates";
import { DRAG_MIME } from "./Timeline";

export type TextPreset = Omit<TextItem, "id" | "from" | "durationInFrames" | "type" | "x" | "y">;

export const TEXT_PRESETS: { name: string; preset: TextPreset }[] = [
  {
    name: "Tiêu đề",
    preset: { text: "Tiêu đề", fontFamily: "Pacifico", fontSize: 110, color: "#ffffff", strokeColor: "#111111", strokeWidth: 8, bold: false, background: "", opacity: 1 },
  },
  {
    name: "Phụ đề",
    preset: { text: "Phụ đề", fontFamily: "Arial", fontSize: 50, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, bold: false, background: "rgba(0,0,0,0.75)", opacity: 1 },
  },
  {
    name: "Viết tay",
    preset: { text: "Chữ viết tay", fontFamily: "Patrick Hand", fontSize: 72, color: "#1d1d1d", strokeColor: "#ffffff", strokeWidth: 0, bold: false, background: "", opacity: 1 },
  },
  {
    name: "Nổi bật",
    preset: { text: "NỔI BẬT", fontFamily: "Arial", fontSize: 96, color: "#ffd600", strokeColor: "#000000", strokeWidth: 10, bold: true, background: "", opacity: 1 },
  },
];

export type DropPayload =
  | { kind: "asset"; id: string }
  | { kind: "text"; preset: number }
  | { kind: "comp"; id: string }
  | { kind: "sticker"; id: string }
  | { kind: "template"; id: string };

const StickerThumb: React.FC<{ id: string }> = ({ id }) => (
  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{STICKERS[id].render(150, 0)}</div>
);

const Draggable: React.FC<{ payload: DropPayload; onAdd: (p: DropPayload) => void; children: React.ReactNode; className?: string }> = ({
  payload,
  onAdd,
  children,
  className = "lib-item",
}) => (
  <div
    className={className}
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "copy";
    }}
    onDoubleClick={() => onAdd(payload)}
  >
    {children}
    <button className="add" title="Thêm vào vị trí đầu phát" onClick={() => onAdd(payload)}>
      +
    </button>
  </div>
);

export type VoiceSettings = { voice: string; rate: string; pitch: string };

type Props = {
  project: Project;
  onAdd: (p: DropPayload) => void;
  onAddVoice: (text: string, cfg: VoiceSettings, withSubtitle: boolean) => Promise<void>;
  onUpload: (files: File[]) => Promise<void>;
  onRemoveAsset: (id: string) => void;
};

const VoicePanel: React.FC<{ onAddVoice: Props["onAddVoice"] }> = ({ onAddVoice }) => {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("vi-VN-NamMinhNeural");
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [withSub, setWithSub] = useState(true);
  const [busy, setBusy] = useState<"" | "try" | "add">("");
  const cfg = { voice, rate: `${rate >= 0 ? "+" : ""}${rate}%`, pitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz` };

  const tryIt = async () => {
    setBusy("try");
    try {
      const res = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, ...cfg }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      new Audio(body.url).play();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="lib-body">
      <p className="hint">Gõ lời thoại, máy đọc thành giọng rồi đặt vào timeline ở đầu phát.</p>
      <textarea rows={5} value={text} placeholder="Ví dụ: Năm 1954, Hiệp định Giơnevơ được ký kết…" onChange={(e) => setText(e.target.value)} />
      <label className="field">Giọng</label>
      <select value={voice} onChange={(e) => setVoice(e.target.value)}>
        <option value="vi-VN-NamMinhNeural">Nam - NamMinh</option>
        <option value="vi-VN-HoaiMyNeural">Nữ - HoaiMy</option>
      </select>
      <label className="field">Tốc độ {cfg.rate}</label>
      <input type="range" min={-40} max={40} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
      <label className="field">Cao độ {cfg.pitch}</label>
      <input type="range" min={-50} max={50} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
      <label className="check">
        <input type="checkbox" checked={withSub} onChange={(e) => setWithSub(e.target.checked)} /> Kèm phụ đề
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={!text.trim() || !!busy} onClick={tryIt}>
          {busy === "try" ? "Đang tạo…" : "Nghe thử"}
        </button>
        <button
          className="primary"
          disabled={!text.trim() || !!busy}
          onClick={async () => {
            setBusy("add");
            try {
              await onAddVoice(text, cfg, withSub);
              setText("");
            } finally {
              setBusy("");
            }
          }}
        >
          {busy === "add" ? "Đang tạo…" : "+ Thêm vào timeline"}
        </button>
      </div>
    </div>
  );
};

export const Library: React.FC<Props> = ({ project, onAdd, onAddVoice, onUpload, onRemoveAsset }) => {
  const [tab, setTab] = useState<"media" | "text" | "voice" | "stickers" | "templates" | "episodes">("media");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      await onUpload(files);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="library">
      <div className="tabs">
        <button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>
          Tư liệu
        </button>
        <button className={tab === "text" ? "active" : ""} onClick={() => setTab("text")}>
          Chữ
        </button>
        <button className={tab === "voice" ? "active" : ""} onClick={() => setTab("voice")}>
          Giọng AI
        </button>
        <button className={tab === "stickers" ? "active" : ""} onClick={() => setTab("stickers")}>
          Nhãn dán
        </button>
        <button className={tab === "templates" ? "active" : ""} onClick={() => setTab("templates")}>
          Mẫu
        </button>
        <button className={tab === "episodes" ? "active" : ""} onClick={() => setTab("episodes")}>
          Tập phim
        </button>
      </div>
      {tab === "media" ? (
        <div
          className={`lib-body${over ? " drop-over" : ""}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setOver(true);
            }
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setOver(false);
            upload([...e.dataTransfer.files]);
          }}
        >
          <button className="primary wide" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Đang tải lên…" : "+ Nhập tư liệu"}
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            hidden
            onChange={(e) => {
              upload([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <p className="hint">Kéo thả file video, ảnh, nhạc vào đây. Kéo tư liệu xuống timeline để dùng.</p>
          <div className="grid">
            {project.assets.filter((a) => !a.hidden).map((a) => (
              <Draggable key={a.id} payload={{ kind: "asset", id: a.id }} onAdd={onAdd} className="lib-item media">
                <div className="thumb">
                  {a.kind === "image" ? <img src={"/" + a.src} alt="" /> : null}
                  {a.kind === "video" ? <video src={"/" + a.src + "#t=0.5"} muted preload="metadata" /> : null}
                  {a.kind === "audio" ? <span className="audio-icon">♪</span> : null}
                  {a.durationInFrames ? <span className="dur">{fmtTime(a.durationInFrames, project.fps)}</span> : null}
                </div>
                <div className="lib-name" title={a.name}>
                  {a.name}
                </div>
                <button
                  className="remove"
                  title="Bỏ khỏi thư viện"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAsset(a.id);
                  }}
                >
                  ✕
                </button>
              </Draggable>
            ))}
          </div>
        </div>
      ) : null}
      {tab === "text" ? (
        <div className="lib-body">
          <p className="hint">Kéo kiểu chữ xuống timeline, hoặc bấm + để thêm ở đầu phát.</p>
          {TEXT_PRESETS.map((t, i) => (
            <Draggable key={t.name} payload={{ kind: "text", preset: i }} onAdd={onAdd} className="lib-item text-preset">
              <span
                style={{
                  fontFamily: t.preset.fontFamily,
                  fontWeight: t.preset.bold ? 700 : 400,
                  color: t.preset.color,
                  WebkitTextStroke: t.preset.strokeWidth ? `${Math.min(3, t.preset.strokeWidth / 3)}px ${t.preset.strokeColor}` : undefined,
                  background: t.preset.background || undefined,
                  padding: "2px 8px",
                  fontSize: 26,
                }}
              >
                {t.name}
              </span>
            </Draggable>
          ))}
        </div>
      ) : null}
      {tab === "voice" ? <VoicePanel onAddVoice={onAddVoice} /> : null}
      {tab === "templates" ? (
        <div className="lib-body">
          <p className="hint">Nhóm đoạn dựng sẵn, thả vào đầu phát rồi sửa chữ cho hợp.</p>
          {TEMPLATES.map((t) => (
            <Draggable key={t.id} payload={{ kind: "template", id: t.id }} onAdd={onAdd}>
              <div>
                <div>{t.name}</div>
                <div className="hint">{t.description}</div>
              </div>
            </Draggable>
          ))}
        </div>
      ) : null}
      {tab === "stickers" ? (
        <div className="lib-body">
          <p className="hint">Nhân vật, cờ, đồ vật và bản đồ của project. Kéo xuống timeline như ảnh.</p>
          {(["Nhân vật", "Cờ", "Đồ vật", "Bản đồ"] as const).map((group) => (
            <React.Fragment key={group}>
              <h4 className="lib-group">{group}</h4>
              <div className="grid">
                {Object.entries(STICKERS)
                  .filter(([, s]) => s.group === group)
                  .map(([id, s]) => (
                    <Draggable key={id} payload={{ kind: "sticker", id }} onAdd={onAdd} className="lib-item media">
                      <div className="thumb sticker-thumb">
                        <Thumbnail component={StickerThumb} inputProps={{ id }} compositionWidth={200} compositionHeight={170} frameToDisplay={0} durationInFrames={1} fps={30} style={{ width: "100%", height: "100%" }} />
                      </div>
                      <div className="lib-name">{s.name}</div>
                    </Draggable>
                  ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {tab === "episodes" ? (
        <div className="lib-body">
          <p className="hint">Các video hoạt hình của project. Thả vào timeline rồi cắt, chèn chữ, nhạc lên trên.</p>
          {Object.entries(EMBEDDABLE).map(([id, c]) => (
            <Draggable key={id} payload={{ kind: "comp", id }} onAdd={onAdd}>
              <div>
                <div>{c.name}</div>
                <div className="hint">{fmtTime(c.durationInFrames, project.fps)}</div>
              </div>
            </Draggable>
          ))}
        </div>
      ) : null}
    </div>
  );
};
