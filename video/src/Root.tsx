import { Composition, Folder } from "remotion";
import { CafeReel } from "./CafeReel";
import { PhotoScene } from "./PhotoScene";
import { PoemReel } from "./poem/PoemReel";
import { TIMELINE } from "./poem/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CafeReel"
        component={CafeReel}
        durationInFrames={320}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PoemReel"
        component={PoemReel}
        durationInFrames={Math.ceil(TIMELINE.total * 30)}
        fps={30}
        width={1080}
        height={1920}
      />
      <Folder name="Scenes">
        <Composition
          id="PhotoScene"
          component={PhotoScene}
          durationInFrames={120}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{
            photo: "photos/coffee-bar.jpg",
            zoom: "in" as const,
            caption: "استمتع بالتفاصيل الصغيرة",
          }}
        />
      </Folder>
    </>
  );
};
