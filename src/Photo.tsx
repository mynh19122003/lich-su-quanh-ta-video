import React from "react";
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = {
  readonly src: string;
  readonly credit: string;
  readonly width: number;
  readonly aspect: number;
  readonly tilt: number;
  readonly style?: React.CSSProperties;
};

const Tape: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    style={{
      position: "absolute",
      width: 150,
      height: 44,
      background: "rgba(236, 222, 180, 0.78)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      ...style,
    }}
  />
);

// An archival photo pasted onto the page as a polaroid, with a slow Ken Burns push.
export const Photo: React.FC<Props> = ({ src, credit, width, aspect, tilt, style }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const drop = spring({ frame: frame - 0.1 * fps, fps, config: { damping: 14, mass: 0.8 } });
  const imgHeight = width / aspect;

  return (
    <div
      style={{
        position: "absolute",
        width,
        padding: "22px 22px 70px",
        background: "#fbf8f1",
        boxShadow: "0 18px 40px rgba(60,40,10,0.35), 0 2px 6px rgba(0,0,0,0.2)",
        opacity: interpolate(drop, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
        translate: `0px ${interpolate(drop, [0, 1], [-80, 0])}px`,
        rotate: `${interpolate(drop, [0, 1], [tilt - 8, tilt])}deg`,
        scale: interpolate(drop, [0, 1], [1.08, 1]),
        ...style,
      }}
    >
      <Tape style={{ top: -18, left: 40, rotate: "-8deg" }} />
      <Tape style={{ top: -14, right: 40, rotate: "6deg" }} />
      <div style={{ width, height: imgHeight, overflow: "hidden" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "sepia(0.35) contrast(1.05) saturate(0.85)",
            scale: interpolate(frame, [0, durationInFrames], [1.02, 1.14], {
              easing: Easing.inOut(Easing.quad),
            }),
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 26,
          right: 26,
          fontFamily: "Patrick Hand, sans-serif",
          fontSize: 26,
          color: "#6b5a3e",
        }}
      >
        {credit}
      </div>
    </div>
  );
};
