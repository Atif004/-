import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const fontFamily = "Tajawal";

loadFont({
  family: fontFamily,
  url: staticFile("fonts/Tajawal-Medium.ttf"),
  weight: "500",
});
loadFont({
  family: fontFamily,
  url: staticFile("fonts/Tajawal-ExtraBold.ttf"),
  weight: "800",
});

export type PhotoSceneProps = {
  readonly photo: string;
  readonly zoom: "in" | "out";
  readonly caption: string;
};

export const PhotoScene: React.FC<PhotoSceneProps> = ({
  photo,
  zoom,
  caption,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#2a1408" }}>
      <Img
        src={staticFile(photo)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: interpolate(
            frame,
            [0, durationInFrames],
            zoom === "in" ? [1, 1.12] : [1.12, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
        }}
      />
      {caption ? (
        <>
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(to top, rgba(30,12,4,0.75) 0%, rgba(30,12,4,0) 35%)",
            }}
          />
          <AbsoluteFill
            style={{
              justifyContent: "flex-end",
              alignItems: "center",
              padding: "0 80px 220px",
            }}
          >
            <div
              dir="rtl"
              style={{
                fontFamily,
                fontWeight: 800,
                fontSize: 96,
                lineHeight: 1.3,
                color: "#fff5ec",
                textAlign: "center",
                textShadow: "0 4px 24px rgba(0,0,0,0.45)",
                opacity: interpolate(frame, [0.4 * fps, 1.2 * fps], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                translate: interpolate(
                  frame,
                  [0.4 * fps, 1.2 * fps],
                  ["0px 40px", "0px 0px"],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                ),
              }}
            >
              {caption}
            </div>
          </AbsoluteFill>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
