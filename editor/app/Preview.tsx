import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useRef, useState } from "react";
import { ProjectComposition } from "../../src/project/ProjectComposition";
import { STICKERS } from "../../src/project/stickers";
import { itemEnd, projectDuration, type Item } from "../../src/project/types";
import { usePlayheadSelect, type ProjectApi } from "./store";

type Props = {
  api: ProjectApi;
  playerRef: React.RefObject<PlayerRef | null>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

type Box = { x: number; y: number; w: number; h: number };

// Rough on-screen box of a visual item, in composition pixels.
const boxOf = (item: Item): Box | null => {
  if (item.type === "image" || item.type === "video") return { x: item.x, y: item.y, w: item.width, h: item.height };
  if (item.type === "sticker") {
    const h = item.size;
    const w = h * (STICKERS[item.sticker]?.aspect ?? 1);
    return { x: item.x - w / 2, y: item.y - h / 2, w, h };
  }
  if (item.type === "text") {
    const lines = item.text.split("\n");
    const w = Math.max(...lines.map((l) => l.length), 1) * item.fontSize * 0.56 + (item.background ? item.fontSize * 0.8 : 0);
    const h = lines.length * item.fontSize * 1.2 + (item.background ? item.fontSize * 0.3 : 0);
    return { x: item.x - w / 2, y: item.y - h / 2, w, h };
  }
  return null;
};

export const Preview: React.FC<Props> = ({ api, playerRef, selectedId, onSelect }) => {
  const { project } = api;
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; sx: number; sy: number; orig: Item } | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / project.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.width]);

  // Visual items showing at the playhead, topmost first. Subscribing to their ids (not the
  // frame) means playback re-renders this overlay only when a clip starts or ends.
  const candidates = project.tracks
    .filter((t) => !t.hidden)
    .flatMap((t) => t.items)
    .filter((i) => boxOf(i));
  const visibleKey = usePlayheadSelect((frame) =>
    candidates
      .filter((i) => frame >= i.from && frame < itemEnd(i))
      .map((i) => i.id)
      .join(" "),
  );
  const shown = new Set(visibleKey.split(" "));
  const visible = candidates.filter((i) => shown.has(i.id)).reverse(); // top tracks last, so their boxes sit above the ones underneath

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - drag.sx) / scale;
      const dy = (e.clientY - drag.sy) / scale;
      api.updateGesture((p) => {
        const it = p.tracks.flatMap((t) => t.items).find((i) => i.id === drag.id);
        const o = drag.orig;
        if (!it) return;
        if (drag.mode === "move") {
          if ("x" in it && "x" in o) {
            it.x = Math.round(o.x + dx);
            it.y = Math.round(o.y + dy);
          }
        } else if ((it.type === "image" || it.type === "video") && (o.type === "image" || o.type === "video")) {
          const ar = o.width / o.height;
          const w = Math.max(20, o.width + dx);
          it.width = Math.round(w);
          it.height = Math.round(w / ar);
        } else if (it.type === "sticker" && o.type === "sticker") {
          it.size = Math.max(20, Math.round(o.size + dy * 2));
        } else if (it.type === "text" && o.type === "text") {
          it.fontSize = Math.max(10, Math.round(o.fontSize * (1 + dy / 200)));
        }
      });
    };
    const onUp = () => {
      api.endGesture();
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, scale, api]);

  const startDrag = (e: React.PointerEvent, item: Item, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    api.beginGesture();
    setDrag({ id: item.id, mode, sx: e.clientX, sy: e.clientY, orig: structuredClone(item) });
  };

  return (
    <div className="preview">
      <div className="stage" ref={stageRef} style={{ aspectRatio: `${project.width} / ${project.height}` }}>
        <Player
          ref={playerRef}
          component={ProjectComposition}
          inputProps={{ project }}
          durationInFrames={projectDuration(project)}
          fps={project.fps}
          compositionWidth={project.width}
          compositionHeight={project.height}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          clickToPlay={false}
          acknowledgeRemotionLicense
        />
        <div className="overlay" onPointerDown={() => onSelect(null)}>
          {visible.map((item) => {
            const b = boxOf(item)!;
            const selected = item.id === selectedId;
            return (
              <div
                key={item.id}
                className={`box${selected ? " selected" : ""}`}
                style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
                onPointerDown={(e) => startDrag(e, item, "move")}
              >
                {selected ? <div className="resize" title="Kéo để đổi kích thước" onPointerDown={(e) => startDrag(e, item, "resize")} /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
