import type { Font, PathCommand } from "opentype.js";

type Point = { x: number; y: number };

// One closed outline of a glyph. Drawn as a single pen stroke.
export type Stroke = {
  d: string;
  points: Point[];
  length: number;
  glyphIndex: number;
};

export type GlyphShape = {
  d: string;
};

export type TextLayout = {
  strokes: Stroke[];
  glyphs: GlyphShape[];
  totalLength: number;
  width: number;
  height: number;
};

const CURVE_SAMPLES = 8;

const commandsToD = (cmds: PathCommand[]) =>
  cmds
    .map((c) => {
      switch (c.type) {
        case "M":
          return `M${c.x} ${c.y}`;
        case "L":
          return `L${c.x} ${c.y}`;
        case "Q":
          return `Q${c.x1} ${c.y1} ${c.x} ${c.y}`;
        case "C":
          return `C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`;
        case "Z":
          return "Z";
      }
    })
    .join("");

// Flattens a contour into a polyline so we know its length and can place the pen tip.
const flatten = (cmds: PathCommand[]): Point[] => {
  const pts: Point[] = [];
  let start: Point = { x: 0, y: 0 };
  let cur: Point = { x: 0, y: 0 };
  for (const c of cmds) {
    if (c.type === "M") {
      start = cur = { x: c.x, y: c.y };
      pts.push(cur);
    } else if (c.type === "L") {
      cur = { x: c.x, y: c.y };
      pts.push(cur);
    } else if (c.type === "Q") {
      for (let i = 1; i <= CURVE_SAMPLES; i++) {
        const t = i / CURVE_SAMPLES;
        const u = 1 - t;
        pts.push({
          x: u * u * cur.x + 2 * u * t * c.x1 + t * t * c.x,
          y: u * u * cur.y + 2 * u * t * c.y1 + t * t * c.y,
        });
      }
      cur = { x: c.x, y: c.y };
    } else if (c.type === "C") {
      for (let i = 1; i <= CURVE_SAMPLES; i++) {
        const t = i / CURVE_SAMPLES;
        const u = 1 - t;
        pts.push({
          x:
            u * u * u * cur.x +
            3 * u * u * t * c.x1 +
            3 * u * t * t * c.x2 +
            t * t * t * c.x,
          y:
            u * u * u * cur.y +
            3 * u * u * t * c.y1 +
            3 * u * t * t * c.y2 +
            t * t * t * c.y,
        });
      }
      cur = { x: c.x, y: c.y };
    } else if (c.type === "Z") {
      cur = start;
      pts.push(start);
    }
  }
  return pts;
};

const polylineLength = (pts: Point[]) => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
};

export const pointAt = (pts: Point[], fraction: number): Point => {
  const target = polylineLength(pts) * fraction;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= target) {
      const t = seg === 0 ? 0 : (target - acc) / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
};

// Lays out one line of text at the origin (baseline at y = ascender).
export const layoutText = (
  font: Font,
  text: string,
  fontSize: number,
): TextLayout => {
  const normalized = text.normalize("NFC");
  const scale = fontSize / font.unitsPerEm;
  const ascender = font.ascender * scale;
  const paths = font.getPaths(normalized, 0, ascender, fontSize, {
    kerning: true,
  });

  const strokes: Stroke[] = [];
  const glyphs: GlyphShape[] = [];
  paths.forEach((path) => {
    const cmds = path.commands;
    if (cmds.length === 0) {
      return;
    }
    const glyphIndex = glyphs.length;
    glyphs.push({ d: commandsToD(cmds) });

    let contour: PathCommand[] = [];
    const flush = () => {
      if (contour.length > 1) {
        const points = flatten(contour);
        strokes.push({
          d: commandsToD(contour),
          points,
          length: polylineLength(points),
          glyphIndex,
        });
      }
      contour = [];
    };
    for (const c of cmds) {
      if (c.type === "M") {
        flush();
      }
      contour.push(c);
    }
    flush();
  });

  return {
    strokes,
    glyphs,
    totalLength: strokes.reduce((sum, s) => sum + s.length, 0),
    width: font.getAdvanceWidth(normalized, fontSize, { kerning: true }),
    height: (font.ascender - font.descender) * scale,
  };
};
