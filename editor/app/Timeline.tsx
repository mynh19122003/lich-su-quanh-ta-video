import React, { useEffect, useRef, useState } from "react";
import { EMBEDDABLE } from "../../src/project/compositions";
import { STICKERS } from "../../src/project/stickers";
import { itemEnd, itemSpeed, TRACK_ACCEPTS, type Item, type Project, type TrackKind } from "../../src/project/types";
import { fmtTime, playhead, sourceLength, TRACK_LABEL, usePlayhead, type ProjectApi } from "./store";
import { PEAKS_PER_SECOND, usePeaks } from "./waveform";

// Sound wave drawn inside an audio/video clip, following its trim and speed.
const Wave: React.FC<{ src: string; item: Item; fps: number; ppf: number }> = ({ src, item, fps, ppf }) => {
  const peaks = usePeaks(src);
  if (!peaks) return null;
  const width = item.durationInFrames * ppf;
  const trim = "trimStart" in item ? item.trimStart : 0;
  const speed = itemSpeed(item);
  const step = Math.max(2, width / 1500);
  let d = "";
  for (let x = 0; x < width; x += step) {
    const sourceFrame = trim + (x / ppf) * speed;
    const v = peaks[Math.floor((sourceFrame / fps) * PEAKS_PER_SECOND)] ?? 0;
    const h = Math.max(0.5, v * 18);
    d += `M${x.toFixed(1)} ${(23 - h).toFixed(1)}V${(23 + h).toFixed(1)}`;
  }
  return (
    <svg className="wave" width={width} height={46} viewBox={`0 0 ${width} 46`}>
      <path d={d} stroke="rgba(255,255,255,0.45)" strokeWidth={Math.min(step * 0.7, 2)} />
    </svg>
  );
};

const HEADER_W = 150;
const RULER_H = 28;
const ROW_H = 58;
const SNAP_PX = 8;

export const DRAG_MIME = "application/x-timeline-drop";

const COLORS: Record<Item["type"], string> = {
  composition: "#5b4bd6",
  video: "#2a7bd5",
  image: "#2f9e6e",
  text: "#c9771d",
  audio: "#2b9aa8",
  sticker: "#b0457a",
  solid: "#6b6b75",
};

const compLength = (id: string) => EMBEDDABLE[id]?.durationInFrames;

export const itemLabel = (p: Project, item: Item) => {
  if (item.type === "text") return item.text.split("\n")[0] || "Chữ";
  if (item.type === "composition") return EMBEDDABLE[item.compositionId]?.name ?? item.compositionId;
  if (item.type === "sticker") return STICKERS[item.sticker]?.name ?? "Nhãn dán";
  if (item.type === "solid") return "Nền màu";
  return p.assets.find((a) => a.id === item.assetId)?.name ?? "Tư liệu";
};

// The only part of the timeline that moves every frame during playback.
const Playhead: React.FC<{ ppf: number }> = ({ ppf }) => {
  const frame = usePlayhead();
  // transform moves it on the compositor instead of re-laying out the timeline each frame.
  return <div className="playhead" style={{ left: 0, transform: `translateX(${frame * ppf}px)` }} />;
};

type Props = {
  api: ProjectApi;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (frame: number) => void;
  ppf: number; // pixels per frame
  onDropPayload: (payload: string, frame: number, trackId: string | null) => void;
};

type Drag =
  | { mode: "move"; id: string; startX: number; startFrom: number; startTrack: number; dur: number }
  | { mode: "trim-left" | "trim-right"; id: string; startX: number; item: Item }
  | { mode: "scrub" };

export const Timeline: React.FC<Props> = React.memo(({ api, selectedId, onSelect, onSeek, ppf, onDropPayload }) => {
  const { project } = api;
  const scrollRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const fps = project.fps;
  const total = Math.max(...project.tracks.flatMap((t) => t.items.map(itemEnd)), 0);
  const width = Math.max((total + 10 * fps) * ppf, (scrollRef.current?.clientWidth ?? 800) - HEADER_W);

  const frameAt = (clientX: number) => {
    const rect = rowsRef.current!.getBoundingClientRect();
    return Math.max(0, Math.round((clientX - rect.left) / ppf));
  };
  const trackAt = (clientY: number) => {
    const rect = rowsRef.current!.getBoundingClientRect();
    return Math.floor((clientY - rect.top - RULER_H) / ROW_H);
  };

  // Moves `value` (a frame) onto the nearest snap point within SNAP_PX.
  const snap = (values: number[], excludeId: string) => {
    const points = [0, playhead.get()];
    for (const t of project.tracks) for (const i of t.items) if (i.id !== excludeId) points.push(i.from, itemEnd(i));
    let best: { delta: number; at: number } | null = null;
    for (const v of values) {
      for (const p of points) {
        const d = p - v;
        if (Math.abs(d) * ppf <= SNAP_PX && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: p };
      }
    }
    return best;
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      if (drag.mode === "scrub") {
        onSeek(frameAt(e.clientX));
        return;
      }
      const df = Math.round((e.clientX - drag.startX) / ppf);
      if (drag.mode === "move") {
        let from = Math.max(0, drag.startFrom + df);
        const s = snap([from, from + drag.dur], drag.id);
        if (s) from = Math.max(0, from + s.delta);
        setGuide(s ? s.at : null);
        const targetIndex = trackAt(e.clientY);
        api.updateGesture((p) => {
          let srcTrack = p.tracks.find((t) => t.items.some((i) => i.id === drag.id))!;
          const idx = srcTrack.items.findIndex((i) => i.id === drag.id);
          const item = srcTrack.items[idx];
          item.from = from;
          const target = p.tracks[targetIndex];
          if (target && target !== srcTrack && TRACK_ACCEPTS[target.kind].includes(item.type)) {
            srcTrack.items.splice(idx, 1);
            target.items.push(item);
            srcTrack = target;
          }
        });
      } else {
        const it = drag.item;
        const src = sourceLength(project, it, compLength);
        const hasTrim = "trimStart" in it;
        const speed = itemSpeed(it);
        api.updateGesture((p) => {
          const item = p.tracks.flatMap((t) => t.items).find((i) => i.id === drag.id)!;
          if (drag.mode === "trim-right") {
            let end = itemEnd(it) + df;
            const s = snap([end], it.id);
            if (s) end += s.delta;
            setGuide(s ? s.at : null);
            let dur = Math.max(1, end - it.from);
            if (src !== undefined && hasTrim) dur = Math.min(dur, Math.floor((src - (it as { trimStart: number }).trimStart) / speed));
            item.durationInFrames = dur;
          } else {
            let start = it.from + df;
            const s = snap([start], it.id);
            if (s) start += s.delta;
            setGuide(s ? s.at : null);
            let d = start - it.from;
            d = Math.max(d, -it.from);
            if (hasTrim) d = Math.max(d, -Math.floor((it as { trimStart: number }).trimStart / speed));
            d = Math.min(d, it.durationInFrames - 1);
            item.from = it.from + d;
            item.durationInFrames = it.durationInFrames - d;
            if (hasTrim && "trimStart" in item) item.trimStart = Math.max(0, (it as { trimStart: number }).trimStart + Math.round(d * speed));
            if (it.keyframes) {
              for (const [prop, kfs] of Object.entries(it.keyframes)) {
                item.keyframes![prop as keyof typeof it.keyframes] = kfs!.map((k) => ({ ...k, frame: k.frame - d }));
              }
            }
          }
        });
      }
    };
    const onUp = () => {
      if (drag.mode !== "scrub") api.endGesture();
      setDrag(null);
      setGuide(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, ppf, project]);

  const startItemDrag = (e: React.PointerEvent, item: Item, mode: "move" | "trim-left" | "trim-right") => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    api.beginGesture();
    if (mode === "move") {
      const trackIndex = project.tracks.findIndex((t) => t.items.some((i) => i.id === item.id));
      setDrag({ mode, id: item.id, startX: e.clientX, startFrom: item.from, startTrack: trackIndex, dur: item.durationInFrames });
    } else {
      setDrag({ mode, id: item.id, startX: e.clientX, item: structuredClone(item) });
    }
  };

  // Ruler ticks: pick a step that leaves at least ~90px between labels.
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const step = (steps.find((s) => s * fps * ppf >= 90) ?? 600) * fps;
  const ticks: number[] = [];
  for (let f = 0; f <= width / ppf; f += step) ticks.push(f);

  const toggleTrack = (id: string, key: "hidden" | "muted") =>
    api.mutate((p) => {
      const t = p.tracks.find((x) => x.id === id)!;
      t[key] = !t[key];
    });
  const removeTrack = (id: string) => {
    const t = project.tracks.find((x) => x.id === id)!;
    if (t.items.length && !confirm(`Xoá lớp "${t.name}" cùng ${t.items.length} đoạn trên đó?`)) return;
    api.mutate((p) => {
      p.tracks = p.tracks.filter((x) => x.id !== id);
    });
  };
  const moveTrack = (id: string, d: number) =>
    api.mutate((p) => {
      const i = p.tracks.findIndex((x) => x.id === id);
      const j = i + d;
      if (j < 0 || j >= p.tracks.length) return;
      [p.tracks[i], p.tracks[j]] = [p.tracks[j], p.tracks[i]];
    });

  const onDrop = (e: React.DragEvent) => {
    const payload = e.dataTransfer.getData(DRAG_MIME);
    if (!payload) return;
    e.preventDefault();
    const t = project.tracks[trackAt(e.clientY)];
    onDropPayload(payload, frameAt(e.clientX), t?.id ?? null);
  };

  return (
    <div className="timeline">
      <div className="tl-headers" ref={headersRef} style={{ width: HEADER_W }}>
        <div style={{ height: RULER_H }} />
        {project.tracks.map((t, i) => (
          <div key={t.id} className="tl-header" style={{ height: ROW_H }}>
            <div className="tl-name" title={t.name}>
              <span className={`kind kind-${t.kind}`}>{TRACK_LABEL[t.kind as TrackKind]}</span> {t.name}
            </div>
            <div className="tl-tools">
              {t.kind !== "audio" ? (
                <button className={t.hidden ? "on" : ""} title={t.hidden ? "Hiện lớp" : "Ẩn lớp"} onClick={() => toggleTrack(t.id, "hidden")}>
                  {t.hidden ? "◌" : "◉"}
                </button>
              ) : null}
              {t.kind !== "text" ? (
                <button className={t.muted ? "on" : ""} title={t.muted ? "Bật tiếng" : "Tắt tiếng"} onClick={() => toggleTrack(t.id, "muted")}>
                  {t.muted ? "🔇" : "🔊"}
                </button>
              ) : null}
              <button title="Lên" disabled={i === 0} onClick={() => moveTrack(t.id, -1)}>
                ↑
              </button>
              <button title="Xuống" disabled={i === project.tracks.length - 1} onClick={() => moveTrack(t.id, 1)}>
                ↓
              </button>
              <button title="Xoá lớp" onClick={() => removeTrack(t.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {/* Room to scroll as far as the rows do (they have 30px spare plus a horizontal scrollbar). */}
        <div style={{ height: 60 }} />
      </div>
      <div
        className="tl-scroll"
        ref={scrollRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        // The track names sit outside this scroller: keep them level with their rows.
        onScroll={(e) => {
          if (headersRef.current) headersRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
      >
        <div
          ref={rowsRef}
          className="tl-rows"
          style={{ width, height: RULER_H + Math.max(1, project.tracks.length) * ROW_H + 30 }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            onSelect(null);
            onSeek(frameAt(e.clientX));
            setDrag({ mode: "scrub" });
          }}
        >
          <div className="tl-ruler" style={{ height: RULER_H }}>
            {ticks.map((f) => (
              <div key={f} className="tick" style={{ left: f * ppf }}>
                <span>{fmtTime(f, fps)}</span>
              </div>
            ))}
          </div>
          {project.tracks.map((t, ti) => (
            <div key={t.id} className={`tl-row${t.hidden ? " hidden-track" : ""}`} style={{ top: RULER_H + ti * ROW_H, height: ROW_H }}>
              {t.items.map((item) => (
                <div
                  key={item.id}
                  className={`clip${item.id === selectedId ? " selected" : ""}`}
                  style={{ left: item.from * ppf, width: Math.max(4, item.durationInFrames * ppf), background: COLORS[item.type] }}
                  onPointerDown={(e) => startItemDrag(e, item, "move")}
                  title={`${itemLabel(project, item)} (${fmtTime(item.from, fps)} - ${fmtTime(itemEnd(item), fps)})`}
                >
                  <div className="handle left" onPointerDown={(e) => startItemDrag(e, item, "trim-left")} />
                  {(item.type === "audio" || (item.type === "video" && !item.muted)) && project.assets.find((a) => a.id === item.assetId) ? (
                    <Wave src={project.assets.find((a) => a.id === item.assetId)!.src} item={item} fps={fps} ppf={ppf} />
                  ) : null}
                  <span className="clip-label">
                    {itemSpeed(item) !== 1 ? `${itemSpeed(item)}x · ` : ""}
                    {itemLabel(project, item)}
                  </span>
                  {item.id === selectedId
                    ? [...new Set(Object.values(item.keyframes ?? {}).flatMap((k) => k!.map((x) => x.frame)))].map((f) => (
                        <span key={f} className="kf-mark" style={{ left: f * ppf - 5 }} />
                      ))
                    : null}
                  {item.transitionIn ? <span className="tr-mark in" style={{ width: item.transitionIn.durationInFrames * ppf }} /> : null}
                  {item.transitionOut ? <span className="tr-mark out" style={{ width: item.transitionOut.durationInFrames * ppf }} /> : null}
                  <div className="handle right" onPointerDown={(e) => startItemDrag(e, item, "trim-right")} />
                </div>
              ))}
            </div>
          ))}
          {project.tracks.length === 0 ? (
            <div className="tl-empty" style={{ top: RULER_H + 10 }}>
              Kéo tư liệu, chữ hoặc tập phim từ bên trái thả vào đây
            </div>
          ) : null}
          {guide !== null ? <div className="snap-guide" style={{ left: guide * ppf }} /> : null}
          <Playhead ppf={ppf} />
        </div>
      </div>
    </div>
  );
});
