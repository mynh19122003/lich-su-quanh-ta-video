import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Paper } from "./Paper";
import { EventScene, TitleScene } from "./scenes";
import { Sketch1954, Sketch1968, Sketch1972, Sketch1973, Sketch1975 } from "./sketches/Sketches";
import { SCENE_FRAMES, TRANSITION_FRAMES } from "./timeline";

const SKETCH_START = 2.2;

export const HistoryVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Paper />
      <Audio name="Nhạc nền" src={staticFile("music.wav")} volume={0.32} />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Mở đầu" durationInFrames={SCENE_FRAMES[0]}>
          <TitleScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence name="1954" durationInFrames={SCENE_FRAMES[1]}>
          <EventScene
            index={1}
            year="1954"
            title="Hiệp định Giơnevơ"
            caption="Đất nước tạm thời chia cắt tại vĩ tuyến 17"
            photo="photos/1954.jpg"
            photoAspect={742 / 570}
            credit="Hội nghị Giơnevơ 1954 · Ảnh: US Army, public domain"
            tilt={-2.5}
            sketch={<Sketch1954 start={SKETCH_START * fps} />}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence name="1968" durationInFrames={SCENE_FRAMES[2]}>
          <EventScene
            index={2}
            year="1968"
            title="Tổng tiến công Tết Mậu Thân"
            caption="Giáng đòn bất ngờ, làm lung lay ý chí xâm lược của Mỹ"
            photo="photos/1968.jpg"
            photoAspect={1494 / 981}
            credit="Chợ Lớn, Sài Gòn 1968 · Ảnh: J. D. Meyerson, public domain"
            tilt={2}
            sketch={<Sketch1968 start={SKETCH_START * fps} />}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence name="1972" durationInFrames={SCENE_FRAMES[3]}>
          <EventScene
            index={3}
            year="1972"
            title="Điện Biên Phủ trên không"
            caption="12 ngày đêm Hà Nội đánh bại cuộc tập kích bằng B-52"
            photo="photos/1972.jpg"
            photoAspect={1920 / 1280}
            credit="Mảnh xác B-52 bị bắn rơi đêm 26/12/1972 · Ảnh: CC0"
            tilt={-1.5}
            sketch={<Sketch1972 start={SKETCH_START * fps} />}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence name="1973" durationInFrames={SCENE_FRAMES[4]}>
          <EventScene
            index={4}
            year="1973"
            title="Hiệp định Paris"
            caption="Mỹ cam kết rút toàn bộ quân đội khỏi Việt Nam"
            photo="photos/1973.jpg"
            photoAspect={1920 / 1303}
            credit="Lễ ký Hiệp định Paris 27/1/1973 · Ảnh: Nhà Trắng, public domain"
            tilt={2.5}
            sketch={<Sketch1973 start={SKETCH_START * fps} />}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence name="1975" durationInFrames={SCENE_FRAMES[5]}>
          <EventScene
            index={5}
            year="30/4/1975"
            title="Giải phóng miền Nam"
            caption="Non sông thu về một mối, đất nước thống nhất"
            photo="photos/1975.jpg"
            photoAspect={1920 / 947}
            credit="Xe tăng 843, nay trưng bày tại bảo tàng · Ảnh: kitmasterbloke, CC BY 2.0"
            tilt={-2}
            sketch={<Sketch1975 start={SKETCH_START * fps} />}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
