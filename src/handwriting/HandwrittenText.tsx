import React, { useMemo } from "react";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Pen } from "./Pen";
import { layoutText, pointAt } from "./layout";
import { useFont } from "./useFont";

type Props = {
  readonly text: string;
  readonly fontFile: string;
  readonly fontSize: number;
  readonly color: string;
  // Frame (inside the parent sequence) at which the pen starts writing.
  readonly startFrame: number;
  // How many frames it takes to write the whole line.
  readonly writeFrames: number;
  readonly showPen?: boolean;
  readonly style?: React.CSSProperties;
};

export const HandwrittenText: React.FC<Props> = ({
  text,
  fontFile,
  fontSize,
  color,
  startFrame,
  writeFrames,
  showPen = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const font = useFont(staticFile(fontFile));
  const layout = useMemo(
    () => (font ? layoutText(font, text, fontSize) : null),
    [font, text, fontSize],
  );

  if (!layout) {
    return null;
  }

  // Ink fill trails the outline by this much "pen distance".
  const fillLag = fontSize * 1.2;
  const progress = interpolate(
    frame,
    [startFrame, startFrame + writeFrames],
    [0, layout.totalLength + fillLag],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.35, 0.1, 0.55, 1),
    },
  );

  const strokeWidth = Math.max(1.5, fontSize * 0.022);
  const glyphEnd: number[] = [];
  let acc = 0;
  const strokeProgress = layout.strokes.map((s) => {
    const p = Math.min(1, Math.max(0, (progress - acc) / s.length));
    acc += s.length;
    glyphEnd[s.glyphIndex] = acc;
    return p;
  });

  const activeIndex = strokeProgress.findIndex((p) => p > 0 && p < 1);
  const tip =
    activeIndex === -1
      ? null
      : pointAt(layout.strokes[activeIndex].points, strokeProgress[activeIndex]);

  return (
    <div style={{ position: "relative", ...style }}>
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ overflow: "visible", display: "block" }}
      >
        {layout.glyphs.map((g, i) => (
          <path
            key={`fill-${i}`}
            d={g.d}
            fill={color}
            fillOpacity={interpolate(
              progress,
              [glyphEnd[i] ?? 0, (glyphEnd[i] ?? 0) + fillLag],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}
          />
        ))}
        {layout.strokes.map((s, i) => (
          <path
            key={`stroke-${i}`}
            d={s.d}
            pathLength={1}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            strokeDashoffset={1 - strokeProgress[i]}
            opacity={strokeProgress[i] === 0 ? 0 : 1}
          />
        ))}
        {showPen && tip ? (
          <Pen x={tip.x} y={tip.y} size={fontSize * 0.9} />
        ) : null}
      </svg>
    </div>
  );
};
