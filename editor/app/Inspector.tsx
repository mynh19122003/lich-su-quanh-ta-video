import React from "react";
import { EMBEDDABLE } from "../../src/project/compositions";
import { animValue } from "../../src/project/ProjectComposition";
import { STICKERS } from "../../src/project/stickers";
import { ANIM_DEFAULTS, FRAME_PRESETS, itemEnd, itemSpeed, NEUTRAL_FILTERS, type AnimProp, type Filters, type Item, type Project, type TransitionType } from "../../src/project/types";
import { findItem, usePlayheadSelect, type ProjectApi } from "./store";

const FONTS = ["Arial", "Pacifico", "Patrick Hand", "Times New Roman", "Segoe UI", "Georgia", "Impact"];

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="row">
    <span>{label}</span>
    <div>{children}</div>
  </label>
);

const Num: React.FC<{ value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }> = ({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}) => (
  <span className="num">
    <input
      type="number"
      value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
    {suffix ? <em>{suffix}</em> : null}
  </span>
);

const Slider: React.FC<{ value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string }> = ({
  value,
  onChange,
  min,
  max,
  step,
  format,
}) => (
  <span className="slider">
    <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    <em>{format(value)}</em>
  </span>
);

export type Tools = {
  splitScenes: (id: string) => void;
  detachAudio: (id: string) => void;
  separateVoice: (id: string) => void;
  autoSubtitles: (id: string, model: string) => void;
  readText: (id: string) => void;
};

const FILTER_LABELS: Record<keyof Filters, [string, number, number, number, (v: number) => string]> = {
  brightness: ["Sáng", 0, 2, 0.01, (v) => `${Math.round(v * 100)}%`],
  contrast: ["Tương phản", 0, 2, 0.01, (v) => `${Math.round(v * 100)}%`],
  saturate: ["Bão hoà", 0, 3, 0.01, (v) => `${Math.round(v * 100)}%`],
  hue: ["Tông màu", -180, 180, 1, (v) => `${v}°`],
  sepia: ["Màu nâu cũ", 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
  grayscale: ["Trắng đen", 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
  blur: ["Làm mờ", 0, 30, 0.5, (v) => `${v}px`],
  vignette: ["Tối viền", 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`],
};

const FILTER_PRESETS: [string, Partial<Filters> | null][] = [
  ["Gốc", null],
  ["Phim cũ", { sepia: 0.6, contrast: 1.1, saturate: 0.8, vignette: 0.5 }],
  ["Trắng đen", { grayscale: 1, contrast: 1.15 }],
  ["Ấm", { sepia: 0.25, saturate: 1.2, hue: -8 }],
  ["Lạnh", { saturate: 0.9, hue: 15, brightness: 1.05 }],
  ["Rực rỡ", { saturate: 1.6, contrast: 1.1 }],
  ["Điện ảnh", { contrast: 1.2, saturate: 0.85, vignette: 0.6 }],
];


const TRANSITIONS: [TransitionType | "", string][] = [
  ["", "Không"],
  ["fade", "Mờ dần"],
  ["slide-left", "Trượt từ trái"],
  ["slide-right", "Trượt từ phải"],
  ["slide-up", "Trượt từ dưới"],
  ["zoom", "Phóng to"],
  ["pop", "Nảy"],
  ["blur", "Nhòe"],
  ["wipe", "Quét"],
  ["typewriter", "Gõ chữ (chỉ cho chữ)"],
];

const ANIM_LABELS: Record<AnimProp, [string, number, number, number, string]> = {
  // label, min, max, step, unit
  offsetX: ["Dời ngang", -2000, 2000, 1, "px"],
  offsetY: ["Dời dọc", -2000, 2000, 1, "px"],
  scale: ["Phóng", 0, 5, 0.01, "x"],
  rotate: ["Xoay", -720, 720, 1, "°"],
  opacity: ["Độ hiện", 0, 1, 0.01, ""],
};

// Follows the playhead on its own, so playback re-renders this panel rather than the whole inspector.
const KeyframeSection: React.FC<{ item: Item; set: (fn: (it: Item) => void, merge?: string) => void }> = ({ item, set }) => {
  // Playhead position inside the clip, or -1 when the playhead is outside it.
  const rel = usePlayheadSelect((f) => (f >= item.from && f < itemEnd(item) ? f - item.from : -1));
  return (
    <div className="section">
      <h4>Keyframe (tại đầu phát)</h4>
      {rel < 0 ? (
        <p className="hint">Đưa đầu phát vào trong đoạn này để đặt keyframe.</p>
      ) : (
        (Object.keys(ANIM_LABELS) as AnimProp[]).map((prop) => {
          const [label, min, max, step, unit] = ANIM_LABELS[prop];
          const kfs = item.keyframes?.[prop] ?? [];
          const here = kfs.find((k) => k.frame === rel);
          const value = animValue(item, prop, rel);
          const setKey = (v: number) =>
            set((it) => {
              it.keyframes ??= {};
              const list = (it.keyframes[prop] ??= []);
              const existing = list.find((k) => k.frame === rel);
              if (existing) existing.value = v;
              else list.push({ frame: rel, value: v });
            }, `kf-${prop}-${rel}`);
          return (
            <div key={prop} className="kf-row">
              <span>{label}</span>
              <input
                type="number"
                value={Math.round(value * 100) / 100}
                min={min}
                max={max}
                step={step}
                title={unit}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setKey(v);
                }}
              />
              <button
                className={`kf-btn${here ? " on" : ""}`}
                title={here ? "Bỏ keyframe này" : "Thêm keyframe tại đây"}
                onClick={() =>
                  set((it) => {
                    it.keyframes ??= {};
                    const list = it.keyframes[prop] ?? [];
                    it.keyframes[prop] = here ? list.filter((k) => k.frame !== rel) : [...list, { frame: rel, value }];
                  })
                }
              >
                ◆
              </button>
              <button
                className="kf-btn"
                title="Xoá hết keyframe của thuộc tính này"
                disabled={!kfs.length}
                onClick={() => set((it) => void (it.keyframes![prop] = []))}
              >
                ↺
              </button>
            </div>
          );
        })
      )}
      <p className="hint">
        Bấm ◆ để đặt keyframe, dời đầu phát rồi đổi giá trị: đoạn sẽ chuyển động mượt giữa các keyframe. Mặc định: dời 0, phóng {ANIM_DEFAULTS.scale}x, xoay 0°.
      </p>
    </div>
  );
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

type Props = {
  api: ProjectApi;
  selectedId: string | null;
  busy: boolean;
  tools: Tools;
  onDelete: () => void;
  onDuplicate: () => void;
};

export const Inspector: React.FC<Props> = ({ api, selectedId, busy, tools, onDelete, onDuplicate }) => {
  const [whisperModel, setWhisperModel] = React.useState("small");
  const { project } = api;
  const found = findItem(project, selectedId);

  if (!found) {
    return (
      <div className="inspector">
        <h3>Dự án</h3>
        <Row label="Tên">
          <input
            type="text"
            value={project.name}
            onChange={(e) => api.mutate((p) => void (p.name = e.target.value), { merge: "project-name" })}
          />
        </Row>
        <Row label="Khung hình">
          <select
            value={FRAME_PRESETS.find((f) => f.width === project.width && f.height === project.height)?.id ?? ""}
            onChange={(e) => {
              const preset = FRAME_PRESETS.find((f) => f.id === e.target.value);
              if (!preset) return;
              // Keep everything centred in the new frame.
              api.mutate((p) => {
                const dx = (preset.width - p.width) / 2;
                const dy = (preset.height - p.height) / 2;
                for (const t of p.tracks)
                  for (const it of t.items)
                    if ("x" in it && "y" in it) {
                      it.x += dx;
                      it.y += dy;
                    }
                p.width = preset.width;
                p.height = preset.height;
              });
            }}
          >
            {FRAME_PRESETS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Kích thước">
          <span className="muted">
            {project.width}×{project.height}, {project.fps} khung/giây
          </span>
        </Row>
        <p className="hint">Chọn một đoạn trên timeline hoặc trong khung xem trước để chỉnh.</p>
        <div className="shortcuts">
          <h4>Phím tắt</h4>
          <p><kbd>Space</kbd> phát / dừng</p>
          <p><kbd>S</kbd> tách đoạn ở đầu phát</p>
          <p><kbd>Delete</kbd> xoá đoạn đang chọn</p>
          <p><kbd>Ctrl</kbd>+<kbd>D</kbd> nhân đôi đoạn</p>
          <p><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> hoàn tác / làm lại</p>
          <p><kbd>←</kbd> <kbd>→</kbd> lùi / tiến 1 khung (giữ Shift: 1 giây)</p>
          <p><kbd>Ctrl</kbd>+lăn chuột trên timeline: phóng to / thu nhỏ</p>
        </div>
      </div>
    );
  }

  const { item } = found;
  const fps = project.fps;
  const set = <T extends Item>(fn: (it: T) => void, merge?: string) =>
    api.mutate(
      (p) => {
        const f = findItem(p, item.id);
        if (f) fn(f.item as T);
      },
      { merge: merge ? `${item.id}-${merge}` : undefined },
    );

  const fitFrame = () =>
    set((it: Item) => {
      if (it.type !== "image" && it.type !== "video") return;
      const asset = project.assets.find((a) => a.id === it.assetId);
      const ar = asset?.width && asset?.height ? asset.width / asset.height : project.width / project.height;
      let w = project.width;
      let h = w / ar;
      if (h > project.height) {
        h = project.height;
        w = h * ar;
      }
      Object.assign(it, { width: w, height: h, x: (project.width - w) / 2, y: (project.height - h) / 2 });
    });

  const title =
    item.type === "text" ? "Chữ" : item.type === "composition" ? "Tập phim" : item.type === "video" ? "Video" : item.type === "image" ? "Ảnh" : item.type === "sticker" ? "Nhãn dán" : item.type === "solid" ? "Nền màu" : "Âm thanh";

  return (
    <div className="inspector">
      <h3>{title}</h3>
      <Row label="Bắt đầu">
        <Num value={item.from / fps} step={0.1} min={0} suffix="giây" onChange={(v) => set((it) => void (it.from = Math.max(0, Math.round(v * fps))), "from")} />
      </Row>
      <Row label="Độ dài">
        <Num
          value={item.durationInFrames / fps}
          step={0.1}
          min={0.1}
          suffix="giây"
          onChange={(v) => set((it) => void (it.durationInFrames = Math.max(1, Math.round(v * fps))), "dur")}
        />
      </Row>
      {"trimStart" in item ? (
        <Row label="Cắt đầu">
          <span className="muted">{(item.trimStart / fps).toFixed(2)} giây của bản gốc</span>
        </Row>
      ) : null}

      {item.type === "composition" ? (
        <p className="hint">
          {EMBEDDABLE[item.compositionId]?.name}. Âm thanh gốc (giọng đọc, nhạc) đi kèm tập phim. Muốn sửa lời thoại, dùng mục “Sửa kịch bản”.
        </p>
      ) : null}

      {item.type === "text" ? (
        <>
          <label className="field">Nội dung</label>
          <textarea value={item.text} rows={3} onChange={(e) => set((it) => void ((it as typeof item).text = e.target.value), "text")} />
          <Row label="Font">
            <select value={item.fontFamily} onChange={(e) => set((it) => void ((it as typeof item).fontFamily = e.target.value))}>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Cỡ chữ">
            <Slider value={item.fontSize} min={12} max={300} step={1} format={(v) => `${v}`} onChange={(v) => set((it) => void ((it as typeof item).fontSize = v), "size")} />
          </Row>
          <Row label="Màu chữ">
            <input type="color" value={item.color} onChange={(e) => set((it) => void ((it as typeof item).color = e.target.value), "color")} />
            <label className="check">
              <input type="checkbox" checked={item.bold} onChange={(e) => set((it) => void ((it as typeof item).bold = e.target.checked))} /> Đậm
            </label>
          </Row>
          <Row label="Viền">
            <input type="color" value={item.strokeColor} onChange={(e) => set((it) => void ((it as typeof item).strokeColor = e.target.value), "stroke")} />
            <Slider value={item.strokeWidth} min={0} max={20} step={1} format={(v) => `${v}px`} onChange={(v) => set((it) => void ((it as typeof item).strokeWidth = v), "sw")} />
          </Row>
          <Row label="Nền chữ">
            <label className="check">
              <input
                type="checkbox"
                checked={!!item.background}
                onChange={(e) => set((it) => void ((it as typeof item).background = e.target.checked ? "rgba(0,0,0,0.75)" : ""))}
              />{" "}
              Có nền
            </label>
            {item.background ? (
              <input
                type="color"
                value={item.background.startsWith("#") ? item.background : "#000000"}
                onChange={(e) => set((it) => void ((it as typeof item).background = e.target.value), "bg")}
              />
            ) : null}
          </Row>
          <Row label="Vị trí">
            <Num value={item.x} onChange={(v) => set((it) => void ((it as typeof item).x = v), "x")} suffix="x" />
            <Num value={item.y} onChange={(v) => set((it) => void ((it as typeof item).y = v), "y")} suffix="y" />
          </Row>
          <button className="small" onClick={() => set((it) => Object.assign(it, { x: project.width / 2, y: project.height / 2 }))}>
            Căn giữa khung
          </button>{" "}
          <button className="small" onClick={() => set((it) => Object.assign(it, { x: project.width / 2, y: project.height - 120 }))}>
            Đặt ở dưới (phụ đề)
          </button>
        </>
      ) : null}

      {item.type === "image" || item.type === "video" ? (
        <>
          <Row label="Vị trí">
            <Num value={item.x} onChange={(v) => set((it) => void ((it as typeof item).x = v), "x")} suffix="x" />
            <Num value={item.y} onChange={(v) => set((it) => void ((it as typeof item).y = v), "y")} suffix="y" />
          </Row>
          <Row label="Kích thước">
            <Num value={item.width} min={10} onChange={(v) => set((it) => void ((it as typeof item).width = Math.max(10, v)), "w")} suffix="r" />
            <Num value={item.height} min={10} onChange={(v) => set((it) => void ((it as typeof item).height = Math.max(10, v)), "h")} suffix="c" />
          </Row>
          <button className="small" onClick={fitFrame}>
            Vừa khung hình
          </button>
        </>
      ) : null}

      {item.type === "image" || item.type === "video" || item.type === "text" ? (
        <Row label="Độ trong">
          <Slider
            value={item.opacity}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set((it) => void ((it as typeof item).opacity = v), "opacity")}
          />
        </Row>
      ) : null}

      {item.type === "video" || item.type === "audio" ? (
        <Row label="Âm lượng">
          <Slider
            value={item.volume}
            min={0}
            max={2}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set((it) => void ((it as typeof item).volume = v), "vol")}
          />
        </Row>
      ) : null}

      {item.type === "solid" ? (
        <>
          <Row label="Màu">
            <input type="color" value={item.color} onChange={(e) => set((it) => void ((it as typeof item).color = e.target.value), "c1")} />
            <label className="check">
              <input type="checkbox" checked={!!item.color2} onChange={(e) => set((it) => void ((it as typeof item).color2 = e.target.checked ? "#b3261e" : ""))} /> Chuyển màu
            </label>
            {item.color2 ? <input type="color" value={item.color2} onChange={(e) => set((it) => void ((it as typeof item).color2 = e.target.value), "c2")} /> : null}
          </Row>
          <Row label="Độ trong">
            <Slider value={item.opacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((it) => void ((it as typeof item).opacity = v), "opacity")} />
          </Row>
        </>
      ) : null}

      {item.type === "sticker" ? (
        <>
          <Row label="Nhãn dán">
            <span className="muted">{STICKERS[item.sticker]?.name}</span>
          </Row>
          <Row label="Kích thước">
            <Slider value={item.size} min={40} max={1600} step={1} format={(v) => `${v}px`} onChange={(v) => set((it) => void ((it as typeof item).size = v), "size")} />
          </Row>
          <Row label="Vị trí">
            <Num value={item.x} onChange={(v) => set((it) => void ((it as typeof item).x = v), "x")} suffix="x" />
            <Num value={item.y} onChange={(v) => set((it) => void ((it as typeof item).y = v), "y")} suffix="y" />
          </Row>
          <Row label="Lật">
            <label className="check">
              <input type="checkbox" checked={item.flip} onChange={(e) => set((it) => void ((it as typeof item).flip = e.target.checked))} /> Lật ngang
            </label>
          </Row>
          <Row label="Độ trong">
            <Slider value={item.opacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set((it) => void ((it as typeof item).opacity = v), "opacity")} />
          </Row>
        </>
      ) : null}

      {item.type === "video" || item.type === "audio" ? (
        <Row label="Tốc độ">
          <select
            value={itemSpeed(item)}
            onChange={(e) => {
              const next = Number(e.target.value);
              // Keep the same stretch of source: faster means a shorter clip.
              set((it) => {
                if (it.type !== "video" && it.type !== "audio") return;
                it.durationInFrames = Math.max(1, Math.round((it.durationInFrames * itemSpeed(it)) / next));
                it.speed = next;
              });
            }}
          >
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {v}x
              </option>
            ))}
          </select>
        </Row>
      ) : null}

      {item.type === "audio" ? (
        <Row label="Fade">
          <Num value={(item.fadeIn ?? 0) / fps} step={0.1} min={0} suffix="vào" onChange={(v) => set((it) => void ((it as typeof item).fadeIn = Math.round(v * fps)), "fi")} />
          <Num value={(item.fadeOut ?? 0) / fps} step={0.1} min={0} suffix="ra" onChange={(v) => set((it) => void ((it as typeof item).fadeOut = Math.round(v * fps)), "fo")} />
        </Row>
      ) : null}

      {item.type !== "audio" ? (
        <div className="section">
          <h4>Hiệu ứng vào / ra</h4>
          {(["transitionIn", "transitionOut"] as const).map((key) => {
            const t = item[key];
            return (
              <Row key={key} label={key === "transitionIn" ? "Vào" : "Ra"}>
                <select
                  value={t?.type ?? ""}
                  onChange={(e) =>
                    set((it) => {
                      const v = e.target.value as TransitionType | "";
                      it[key] = v ? { type: v, durationInFrames: it[key]?.durationInFrames ?? Math.round(0.6 * fps) } : undefined;
                    })
                  }
                >
                  {TRANSITIONS.filter(([v]) => v !== "typewriter" || (item.type === "text" && key === "transitionIn")).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                {t ? (
                  <Num
                    value={t.durationInFrames / fps}
                    step={0.1}
                    min={0.1}
                    suffix="giây"
                    onChange={(v) => set((it) => void (it[key] = { ...it[key]!, durationInFrames: Math.max(1, Math.round(v * fps)) }), `${key}-d`)}
                  />
                ) : null}
              </Row>
            );
          })}
        </div>
      ) : null}

      {item.type !== "audio" ? <KeyframeSection item={item} set={set} /> : null}

      {item.type === "video" || item.type === "audio" || item.type === "composition" ? (
        <div className="section">
          <h4>Công cụ tự động</h4>
          <div className="tools">
            {item.type !== "audio" ? (
              <button disabled={busy} onClick={() => tools.splitScenes(item.id)}>
                ✂ Tự chia theo chuyển cảnh
              </button>
            ) : null}
            {item.type !== "audio" && (item.type === "video" ? !item.muted : !item.muteAudio && !!EMBEDDABLE[item.compositionId]?.audioParts) ? (
              <button disabled={busy} onClick={() => tools.detachAudio(item.id)}>
                🔊 Tách âm thanh ra lớp riêng
              </button>
            ) : null}
            {item.type !== "composition" ? (
              <button disabled={busy} onClick={() => tools.separateVoice(item.id)}>
                🎤 Tách giọng / nhạc nền (AI)
              </button>
            ) : null}
            {item.type === "composition" ? (
              EMBEDDABLE[item.compositionId]?.subtitles && !item.hideSubtitles ? (
                <button disabled={busy} onClick={() => tools.autoSubtitles(item.id, "")}>
                  💬 Phụ đề thành chữ chỉnh được
                </button>
              ) : null
            ) : (
              <>
                <button disabled={busy} onClick={() => tools.autoSubtitles(item.id, whisperModel)}>
                  💬 Phụ đề tự động (AI)
                </button>
                <Row label="Mô hình">
                  <select value={whisperModel} onChange={(e) => setWhisperModel(e.target.value)}>
                    <option value="small">Nhanh (small)</option>
                    <option value="medium">Chính xác hơn (medium, tải 1,5 GB)</option>
                    <option value="large-v3">Chính xác nhất (large-v3, tải 3 GB, chậm)</option>
                  </select>
                </Row>
              </>
            )}
          </div>
        </div>
      ) : null}

      {item.type === "text" ? (
        <div className="section">
          <h4>Giọng đọc</h4>
          <button disabled={busy} onClick={() => tools.readText(item.id)}>
            🔈 Đọc chữ này bằng giọng AI
          </button>
          <p className="hint">Tạo đoạn giọng đọc ở cùng vị trí, độ dài chữ khớp với giọng. Đổi giọng ở tab “Giọng AI”.</p>
        </div>
      ) : null}

      {item.type === "composition" && (project.width !== EMBEDDABLE[item.compositionId]?.width || project.height !== EMBEDDABLE[item.compositionId]?.height) ? (
        <Row label="Vừa khung">
          <select value={item.fit ?? "contain"} onChange={(e) => set((it) => void ((it as typeof item).fit = e.target.value as "contain" | "cover"))}>
            <option value="contain">Hiện đủ (có viền đen)</option>
            <option value="cover">Lấp đầy (cắt bớt 2 bên)</option>
          </select>
        </Row>
      ) : null}

      {item.type !== "audio" ? (
        <div className="section">
          <h4>Màu sắc</h4>
          <div className="presets">
            {FILTER_PRESETS.map(([name, f]) => (
              <button key={name} className="small" onClick={() => set((it) => void (it.filters = f ? { ...NEUTRAL_FILTERS, ...f } : undefined))}>
                {name}
              </button>
            ))}
          </div>
          {(Object.keys(FILTER_LABELS) as (keyof Filters)[]).map((key) => {
            const [label, min, max, step, fmt] = FILTER_LABELS[key];
            const value = (item.filters ?? NEUTRAL_FILTERS)[key];
            return (
              <Row key={key} label={label}>
                <Slider
                  value={value}
                  min={min}
                  max={max}
                  step={step}
                  format={fmt}
                  onChange={(v) => set((it) => void (it.filters = { ...NEUTRAL_FILTERS, ...it.filters, [key]: v }), `filter-${key}`)}
                />
              </Row>
            );
          })}
        </div>
      ) : null}

      {item.type === "video" || item.type === "image" ? (
        <div className="section">
          <h4>Xoá phông (phông xanh)</h4>
          <label className="check">
            <input
              type="checkbox"
              checked={!!item.chromaKey}
              onChange={(e) => set((it) => void ((it as typeof item).chromaKey = e.target.checked ? { color: "#00ff00", similarity: 0.18, smoothness: 0.08 } : undefined))}
            />{" "}
            Bật xoá phông
          </label>
          {item.chromaKey ? (
            <>
              <Row label="Màu phông">
                <input type="color" value={item.chromaKey.color} onChange={(e) => set((it) => void ((it as typeof item).chromaKey!.color = e.target.value), "ck-color")} />
                <button className="small" onClick={() => set((it) => void ((it as typeof item).chromaKey!.color = "#00ff00"))}>
                  Xanh lá
                </button>
                <button className="small" onClick={() => set((it) => void ((it as typeof item).chromaKey!.color = "#0047bb"))}>
                  Xanh dương
                </button>
              </Row>
              <Row label="Độ rộng">
                <Slider value={item.chromaKey.similarity} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set((it) => void ((it as typeof item).chromaKey!.similarity = v), "ck-sim")} />
              </Row>
              <Row label="Viền mềm">
                <Slider value={item.chromaKey.smoothness} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set((it) => void ((it as typeof item).chromaKey!.smoothness = v), "ck-smooth")} />
              </Row>
              <p className="hint">Tăng “Độ rộng” nếu còn sót màu phông, giảm nếu người bị mất một phần.</p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="inspector-actions">
        <button onClick={onDuplicate}>Nhân đôi</button>
        <button className="danger" onClick={onDelete}>
          Xoá đoạn
        </button>
      </div>
    </div>
  );
};

export const projectHasItem = (p: Project, id: string | null) => !!findItem(p, id);
