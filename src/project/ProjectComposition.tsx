import { colorKey } from "@remotion/effects/color-key";
import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { EMBEDDABLE } from "./compositions";
import { STICKERS } from "./stickers";
import { ANIM_DEFAULTS, NEUTRAL_FILTERS, type AnimProp, type Asset, type ChromaKey, type Filters, type Item, type Project, type Transition } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Keyframed value of `prop` at `frame` (relative to the item start).
export const animValue = (item: Item, prop: AnimProp, frame: number) => {
  const kfs = item.keyframes?.[prop];
  if (!kfs || kfs.length === 0) return ANIM_DEFAULTS[prop];
  if (kfs.length === 1) return kfs[0].value;
  const sorted = [...kfs].sort((a, b) => a.frame - b.frame);
  return interpolate(
    frame,
    sorted.map((k) => k.frame),
    sorted.map((k) => k.value),
    { ...clamp, easing: Easing.inOut(Easing.quad) },
  );
};

// Progress 0..1 of an entering (or, mirrored, leaving) transition.
const transitionProgress = (t: Transition | undefined, frame: number, duration: number, side: "in" | "out") => {
  if (!t || t.durationInFrames <= 0) return 1;
  const f = side === "in" ? frame : duration - frame;
  return interpolate(f, [0, t.durationInFrames], [0, 1], clamp);
};

type Look = { tx: number; ty: number; scale: number; opacity: number; clip?: string; blur: number };

const applyTransition = (look: Look, t: Transition | undefined, p: number, side: "in" | "out", w: number, h: number) => {
  if (!t || p >= 1) return;
  const e = Easing.out(Easing.cubic)(p);
  switch (t.type) {
    case "fade":
    case "typewriter":
      look.opacity *= t.type === "fade" ? e : 1;
      break;
    case "slide-left":
      look.tx += (side === "in" ? -1 : 1) * (1 - e) * w;
      break;
    case "slide-right":
      look.tx += (side === "in" ? 1 : -1) * (1 - e) * w;
      break;
    case "slide-up":
      look.ty += (side === "in" ? 1 : -1) * (1 - e) * h;
      break;
    case "zoom":
      look.scale *= 0.5 + 0.5 * e;
      look.opacity *= e;
      break;
    case "pop":
      look.scale *= Easing.out(Easing.back(2.2))(p);
      break;
    case "blur":
      look.blur += (1 - e) * 30;
      look.opacity *= e;
      break;
    case "wipe":
      look.clip = side === "in" ? `inset(0 ${(1 - e) * 100}% 0 0)` : `inset(0 0 0 ${(1 - e) * 100}%)`;
      break;
  }
};

const keyEffects = (k?: ChromaKey) => (k ? [colorKey({ keyColor: k.color, similarity: k.similarity, smoothness: k.smoothness })] : undefined);

export const cssFilter = (f: Filters | undefined, extraBlur: number) => {
  const v = { ...NEUTRAL_FILTERS, ...f };
  const parts: string[] = [];
  if (v.brightness !== 1) parts.push(`brightness(${v.brightness})`);
  if (v.contrast !== 1) parts.push(`contrast(${v.contrast})`);
  if (v.saturate !== 1) parts.push(`saturate(${v.saturate})`);
  if (v.hue !== 0) parts.push(`hue-rotate(${v.hue}deg)`);
  if (v.sepia > 0) parts.push(`sepia(${v.sepia})`);
  if (v.grayscale > 0) parts.push(`grayscale(${v.grayscale})`);
  if (v.blur + extraBlur > 0.1) parts.push(`blur(${v.blur + extraBlur}px)`);
  return parts.length ? parts.join(" ") : undefined;
};

const centreOf = (item: Item, project: Project): [number, number] => {
  if (item.type === "image" || item.type === "video") return [item.x + item.width / 2, item.y + item.height / 2];
  if (item.type === "text" || item.type === "sticker") return [item.x, item.y];
  return [project.width / 2, project.height / 2];
};

const ItemView: React.FC<{ item: Item; asset?: Asset; muted: boolean; project: Project }> = ({ item, asset, muted, project }) => {
  const frame = useCurrentFrame();
  const dur = item.durationInFrames;
  const pIn = transitionProgress(item.transitionIn, frame, dur, "in");
  const pOut = transitionProgress(item.transitionOut, frame, dur, "out");

  if (item.type === "audio") {
    if (!asset) return null;
    const fadeIn = item.fadeIn ?? 0;
    const fadeOut = item.fadeOut ?? 0;
    return (
      <Audio
        src={staticFile(asset.src)}
        trimBefore={item.trimStart}
        playbackRate={item.speed ?? 1}
        volume={(f) => {
          if (muted) return 0;
          const a = fadeIn > 0 ? interpolate(f, [0, fadeIn], [0, 1], clamp) : 1;
          const b = fadeOut > 0 ? interpolate(f, [dur - fadeOut, dur], [1, 0], clamp) : 1;
          return item.volume * a * b;
        }}
      />
    );
  }

  const look: Look = {
    tx: animValue(item, "offsetX", frame),
    ty: animValue(item, "offsetY", frame),
    scale: animValue(item, "scale", frame),
    opacity: animValue(item, "opacity", frame),
    blur: 0,
  };
  applyTransition(look, item.transitionIn, pIn, "in", project.width, project.height);
  applyTransition(look, item.transitionOut, pOut, "out", project.width, project.height);
  const rotate = animValue(item, "rotate", frame);
  const [cx, cy] = centreOf(item, project);

  let content: React.ReactNode = null;
  switch (item.type) {
    case "video":
      content = asset ? (
        <Video
          src={staticFile(asset.src)}
          trimBefore={item.trimStart}
          playbackRate={item.speed ?? 1}
          volume={muted || item.muted ? 0 : item.volume}
          effects={keyEffects(item.chromaKey)}
          style={{ position: "absolute", left: item.x, top: item.y, width: item.width, height: item.height, opacity: item.opacity, objectFit: "contain" }}
        />
      ) : null;
      break;
    case "image":
      content = !asset ? null : item.card ? (
        // An archive photo pinned on the scene: white border, shadow, a slight tilt, and its
        // provenance (what, when, licence) written under it.
        <div
          style={{
            position: "absolute",
            left: item.x,
            top: item.y,
            width: item.width,
            background: "#fbf8f1",
            padding: item.width * 0.025,
            paddingBottom: 0,
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            rotate: `${item.card.tilt ?? 0}deg`,
            opacity: item.opacity,
          }}
        >
          <Img src={staticFile(asset.src)} style={{ display: "block", width: "100%", height: item.height, objectFit: "contain" }} />
          <div style={{ fontFamily: "Patrick Hand", fontSize: Math.max(22, item.width * 0.04), color: "#2a2a2a", textAlign: "center", padding: "0.35em 0.4em 0.45em", lineHeight: 1.15 }}>
            {item.card.caption}
          </div>
        </div>
      ) : (
        <Img
          src={staticFile(asset.src)}
          effects={keyEffects(item.chromaKey)}
          style={{ position: "absolute", left: item.x, top: item.y, width: item.width, height: item.height, opacity: item.opacity, objectFit: "contain" }}
        />
      );
      break;
    case "sticker": {
      const s = STICKERS[item.sticker];
      content = s ? (
        <div
          style={{
            position: "absolute",
            left: item.x,
            top: item.y,
            translate: "-50% -50%",
            scale: item.flip ? "-1 1" : undefined,
            opacity: item.opacity,
            display: "flex",
          }}
        >
          {s.render(item.size, frame, item.talkRanges?.some(([a, b]) => frame >= a && frame < b))}
        </div>
      ) : null;
      break;
    }
    case "solid":
      content = (
        <AbsoluteFill
          style={{ background: item.color2 ? `linear-gradient(160deg, ${item.color}, ${item.color2})` : item.color, opacity: item.opacity }}
        />
      );
      break;
    case "text": {
      const typing = item.transitionIn?.type === "typewriter" ? pIn : 1;
      const shown = typing < 1 ? [...item.text].slice(0, Math.ceil([...item.text].length * typing)).join("") : item.text;
      content = (
        <div
          style={{
            position: "absolute",
            left: item.x,
            top: item.y,
            translate: "-50% -50%",
            whiteSpace: "pre",
            textAlign: "center",
            fontFamily: item.fontFamily,
            fontSize: item.fontSize,
            fontWeight: item.bold ? 700 : 400,
            color: item.color,
            WebkitTextStroke: item.strokeWidth > 0 ? `${item.strokeWidth}px ${item.strokeColor}` : undefined,
            paintOrder: "stroke fill",
            background: item.background || undefined,
            padding: item.background ? "0.15em 0.4em" : undefined,
            borderRadius: item.background ? "0.2em" : undefined,
            opacity: item.opacity,
            lineHeight: 1.2,
          }}
        >
          {/* Keep the box the full width while typing so the text doesn't shift. */}
          <span>{shown}</span>
          <span style={{ visibility: "hidden" }}>{item.text.slice(shown.length)}</span>
        </div>
      );
      break;
    }
    case "composition": {
      const comp = EMBEDDABLE[item.compositionId];
      if (!comp) return null;
      const Component = comp.component;
      // Lay the episode out at its own size, scaled into the project frame.
      const fitScale = (item.fit === "cover" ? Math.max : Math.min)(project.width / comp.width, project.height / comp.height);
      content = (
        <div
          style={{
            position: "absolute",
            left: (project.width - comp.width * fitScale) / 2,
            top: (project.height - comp.height * fitScale) / 2,
            width: comp.width,
            height: comp.height,
            transform: `scale(${fitScale})`,
            transformOrigin: "0 0",
            overflow: "hidden",
          }}
        >
          {/* Shift the composition so the clip starts `trimStart` frames into it. */}
          <Sequence from={-item.trimStart} width={comp.width} height={comp.height} layout="absolute-fill" name={comp.name}>
            <Component showSubtitles={!item.hideSubtitles} audio={!item.muteAudio && !muted} />
          </Sequence>
        </div>
      );
      break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `translate(${look.tx}px, ${look.ty}px) scale(${look.scale}) rotate(${rotate}deg)`,
        opacity: look.opacity,
        clipPath: look.clip,
        filter: cssFilter(item.filters, look.blur),
      }}
    >
      {content}
      {item.filters?.vignette ? (
        <AbsoluteFill
          style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${item.filters.vignette}) 100%)`, pointerEvents: "none" }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

// Renders a whole timeline project. Tracks lower in the list are drawn first (underneath).
export const ProjectComposition: React.FC<{ project: Project }> = ({ project }) => {
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {[...project.tracks].reverse().map((track) =>
        track.hidden && track.kind !== "audio" ? null : (
          <AbsoluteFill key={track.id}>
            {track.items.map((item) => (
              <Sequence key={item.id} from={item.from} durationInFrames={item.durationInFrames} layout="absolute-fill" name={track.name}>
                <ItemView item={item} asset={"assetId" in item ? assets.get(item.assetId) : undefined} muted={!!track.muted} project={project} />
              </Sequence>
            ))}
          </AbsoluteFill>
        ),
      )}
    </AbsoluteFill>
  );
};
