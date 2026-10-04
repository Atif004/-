import { Composition, Folder } from "remotion";
import { CafeReel } from "./CafeReel";
import { PhotoScene } from "./PhotoScene";

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
