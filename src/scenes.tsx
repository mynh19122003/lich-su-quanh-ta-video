import { Audio } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { HandwrittenParagraph } from "./handwriting/HandwrittenParagraph";
import { HandwrittenText } from "./handwriting/HandwrittenText";
import { Photo } from "./Photo";
import { Star, Underline } from "./Sketch";
import { VOICE_DELAY_SECONDS } from "./timeline";

export const INK = "#1f2a44";
export const RED = "#b3261e";
export const BROWN = "#5a4326";
const SCRIPT = "fonts/Pacifico-Regular.ttf";
const HAND = "fonts/PatrickHand-Regular.ttf";

// Very slow push-in so held frames don't feel frozen.
const Drift: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        scale: interpolate(frame, [0, durationInFrames], [1, 1.03]),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Voice: React.FC<{ index: number }> = ({ index }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence name={`Lời đọc ${index}`} from={VOICE_DELAY_SECONDS * fps} layout="none">
      <Audio src={staticFile(`voice/${index}.mp3`)} />
    </Sequence>
  );
};

export const TitleScene: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Drift>
      <Voice index={0} />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}
      >
        <Star startFrame={0.1 * fps} drawFrames={0.8 * fps} color={RED} size={130} />
        <HandwrittenText
          text="Kháng chiến chống Mỹ"
          fontFile={SCRIPT}
          fontSize={128}
          color={RED}
          startFrame={0.8 * fps}
          writeFrames={2.2 * fps}
          style={{ marginTop: 10 }}
        />
        <HandwrittenText
          text="cứu nước"
          fontFile={SCRIPT}
          fontSize={104}
          color={RED}
          startFrame={3 * fps}
          writeFrames={1 * fps}
          style={{ marginTop: -40 }}
        />
        <HandwrittenText
          text="1954 – 1975"
          fontFile={HAND}
          fontSize={76}
          color={INK}
          startFrame={4.2 * fps}
          writeFrames={1.4 * fps}
          style={{ marginTop: 10 }}
        />
      </AbsoluteFill>
    </Drift>
  );
};

type EventProps = {
  readonly index: number;
  readonly year: string;
  readonly title: string;
  readonly caption: string;
  readonly photo: string;
  readonly photoAspect: number;
  readonly credit: string;
  readonly tilt: number;
  readonly sketch: React.ReactNode;
};

const PHOTO_WIDTH = 760;

export const EventScene: React.FC<EventProps> = ({
  index,
  year,
  title,
  caption,
  photo,
  photoAspect,
  credit,
  tilt,
  sketch,
}) => {
  const { fps } = useVideoConfig();
  const cardHeight = PHOTO_WIDTH / photoAspect + 92;
  return (
    <Drift>
      <Voice index={index} />
      <Photo
        src={photo}
        credit={credit}
        width={PHOTO_WIDTH}
        aspect={photoAspect}
        tilt={tilt}
        style={{ left: 100, top: (1080 - cardHeight) / 2 - 10 }}
      />
      <div style={{ position: "absolute", left: 980, top: 70, width: 860 }}>
        <HandwrittenText
          text={year}
          fontFile={SCRIPT}
          fontSize={120}
          color={RED}
          startFrame={0.3 * fps}
          writeFrames={1 * fps}
        />
        <div style={{ marginTop: -40, marginLeft: 6 }}>
          <Underline startFrame={1.3 * fps} drawFrames={0.4 * fps} color={RED} width={year.length * 42} />
        </div>
        <HandwrittenParagraph
          text={title}
          fontFile={HAND}
          fontSize={80}
          color={INK}
          maxWidth={840}
          startFrame={1.7 * fps}
          writeFrames={1.6 * fps}
          style={{ marginTop: 0 }}
        />
        <HandwrittenParagraph
          text={caption}
          fontFile={HAND}
          fontSize={48}
          color={BROWN}
          maxWidth={820}
          startFrame={3.3 * fps}
          writeFrames={2.2 * fps}
          lineHeight={1.15}
          style={{ marginTop: 4 }}
        />
      </div>
      <div style={{ position: "absolute", left: 980, top: 650 }}>{sketch}</div>
    </Drift>
  );
};
