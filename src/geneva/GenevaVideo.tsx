import { Audio } from "@remotion/media";
import React from "react";
import { Series, staticFile } from "remotion";
import { Subtitles } from "./Common";
import { BangDen, DienBienPhu, DominoScene, MoDau, PhapQuayLai } from "./scenes/ScenesA";
import { BaTramNgay, HoiNghi, KhongTanThanh, NoiDung, ViTuyen } from "./scenes/ScenesB";
import { DiemScene, DongKhoi, Ket, MyVao, NamNamSau } from "./scenes/ScenesC";
import { GenevaAudioCtx, SceneProvider } from "./SceneContext";
import { sceneById } from "./timeline";

export const GENEVA_MUSIC_VOLUME = 0.16;

const SCENE_COMPONENTS: [string, string, React.FC][] = [
  ["mo-dau", "Mở đầu", MoDau],
  ["bang-den", "Bảng đen", BangDen],
  ["phap-quay-lai", "Pháp quay lại", PhapQuayLai],
  ["domino", "Thuyết đôminô", DominoScene],
  ["dien-bien-phu", "Điện Biên Phủ", DienBienPhu],
  ["hoi-nghi", "Hội nghị", HoiNghi],
  ["vi-tuyen", "Vĩ tuyến", ViTuyen],
  ["noi-dung", "Nội dung", NoiDung],
  ["khong-tan-thanh", "Không tán thành", KhongTanThanh],
  ["300-ngay", "300 ngày", BaTramNgay],
  ["diem", "Ngô Đình Diệm", DiemScene],
  ["1956", "1956", NamNamSau],
  ["dong-khoi", "Đồng Khởi", DongKhoi],
  ["my-vao", "Mỹ vào", MyVao],
  ["ket", "Kết", Ket],
];

// showSubtitles / audio are switched off by the editor when it takes over those parts.
export const GenevaVideo: React.FC<{ showSubtitles?: boolean; audio?: boolean }> = ({ showSubtitles = true, audio = true }) => {
  return (
    <GenevaAudioCtx.Provider value={audio}>
      <Series>
        {SCENE_COMPONENTS.map(([id, name, Component]) => (
          <Series.Sequence key={id} name={name} durationInFrames={sceneById(id).durationInFrames}>
            <SceneProvider id={id}>
              <Component />
            </SceneProvider>
          </Series.Sequence>
        ))}
      </Series>
      {audio ? <Audio name="Nhạc nền" src={staticFile("geneva/music.wav")} volume={GENEVA_MUSIC_VOLUME} /> : null}
      {showSubtitles ? <Subtitles /> : null}
    </GenevaAudioCtx.Provider>
  );
};
