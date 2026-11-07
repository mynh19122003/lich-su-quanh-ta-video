import React, { useMemo } from "react";
import { staticFile } from "remotion";
import { HandwrittenText } from "./HandwrittenText";
import { useFont } from "./useFont";

type Props = {
  readonly text: string;
  readonly fontFile: string;
  readonly fontSize: number;
  readonly color: string;
  readonly maxWidth: number;
  readonly lineHeight?: number;
  readonly startFrame: number;
  readonly writeFrames: number;
  readonly align?: "left" | "center";
  readonly style?: React.CSSProperties;
};

// Word-wraps text to maxWidth and writes the lines one after another.
export const HandwrittenParagraph: React.FC<Props> = ({
  text,
  fontFile,
  fontSize,
  color,
  maxWidth,
  lineHeight = 1.05,
  startFrame,
  writeFrames,
  align = "left",
  style,
}) => {
  const font = useFont(staticFile(fontFile));
  const lines = useMemo(() => {
    if (!font) {
      return [];
    }
    const wrap = (width: number) => {
      const out: string[] = [];
      let line = "";
      for (const word of text.normalize("NFC").split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.getAdvanceWidth(next, fontSize) > width) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) {
        out.push(line);
      }
      return out;
    };
    // Narrow the width as long as the line count holds, so lines come out balanced.
    let best = wrap(maxWidth);
    for (let w = maxWidth - 20; w > maxWidth / 3; w -= 20) {
      const attempt = wrap(w);
      if (attempt.length !== best.length) {
        break;
      }
      best = attempt;
    }
    return best;
  }, [font, text, fontSize, maxWidth]);

  const totalChars = lines.reduce((sum, l) => sum + l.length, 0);
  let charsBefore = 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "center",
        ...style,
      }}
    >
      {lines.map((line, i) => {
        const lineStart = startFrame + (writeFrames * charsBefore) / totalChars;
        const lineFrames = (writeFrames * line.length) / totalChars;
        charsBefore += line.length;
        return (
          <HandwrittenText
            key={i}
            text={line}
            fontFile={fontFile}
            fontSize={fontSize}
            color={color}
            startFrame={lineStart}
            writeFrames={lineFrames}
            style={{ marginTop: i === 0 ? 0 : fontSize * (lineHeight - 1.36) }}
          />
        );
      })}
    </div>
  );
};
