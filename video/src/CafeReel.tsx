import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { PhotoScene } from "./PhotoScene";

// 3 scenes × 120 frames − 2 transitions × 20 frames = 320 frames
export const CafeReel: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence
        name="Espresso machine"
        durationInFrames={120}
        premountFor={fps}
      >
        <PhotoScene photo="photos/espresso-machine.jpg" zoom="in" caption="" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 20 })}
      />
      <TransitionSeries.Sequence
        name="Shelves"
        durationInFrames={120}
        premountFor={fps}
      >
        <PhotoScene photo="photos/shelves.jpg" zoom="out" caption="" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 20 })}
      />
      <TransitionSeries.Sequence
        name="Coffee bar"
        durationInFrames={120}
        premountFor={fps}
      >
        <PhotoScene
          photo="photos/coffee-bar.jpg"
          zoom="in"
          caption="استمتع بالتفاصيل الصغيرة"
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
