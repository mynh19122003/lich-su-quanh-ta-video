import { Composition } from "remotion";
import "./fonts";
import { GenevaVideo } from "./geneva/GenevaVideo";
import { FPS as GENEVA_FPS, TOTAL_FRAMES as GENEVA_FRAMES } from "./geneva/timeline";
import { HistoryVideo } from "./HistoryVideo";
import { ProjectComposition } from "./project/ProjectComposition";
import { emptyProject, projectDuration, type Project } from "./project/types";
import { FPS, TOTAL_FRAMES } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KhangChienChongMy"
        component={HistoryVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="HiepDinhGiongevo"
        component={GenevaVideo}
        durationInFrames={GENEVA_FRAMES}
        fps={GENEVA_FPS}
        width={1920}
        height={1080}
      />
      {/* Timeline projects made in the editor; rendered with --props=projects/<id>.json */}
      <Composition
        id="ProjectVideo"
        component={ProjectComposition}
        durationInFrames={30}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ project: emptyProject() }}
        calculateMetadata={({ props }: { props: { project: Project } }) => ({
          durationInFrames: projectDuration(props.project),
          fps: props.project.fps,
          width: props.project.width,
          height: props.project.height,
        })}
      />
    </>
  );
};
