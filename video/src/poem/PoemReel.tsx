import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TIMELINE } from "./timeline";

const calligraphy = "Aref Ruqaa";
const naskh = "Amiri";

loadFont({
  family: calligraphy,
  url: staticFile("poem/ArefRuqaa-Bold.woff2"),
  weight: "700",
});
loadFont({ family: naskh, url: staticFile("poem/Amiri.woff2"), weight: "400" });

// Word index where each verse breaks into its second hemistich.
const SPLIT = [3, 4, 2, 3];
const ARABIC_DIGITS = ["١", "٢", "٣", "٤"];
const GOLD = "#f3d58a";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Stars: React.FC<{ t: number }> = ({ t }) => (
  <>
    {new Array(140).fill(0).map((_, i) => {
      const x = random(`sx${i}`) * 100;
      const y = random(`sy${i}`) * 70;
      const size = 1 + random(`ss${i}`) * 2.6;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + random(`sp${i}`)) + i));
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "#fff",
            opacity: tw * 0.85,
            boxShadow: `0 0 ${size * 3}px rgba(255,255,255,0.8)`,
          }}
        />
      );
    })}
  </>
);

const Embers: React.FC<{ t: number; speed: number; warm: number }> = ({
  t,
  speed,
  warm,
}) => (
  <>
    {new Array(46).fill(0).map((_, i) => {
      const x0 = random(`ex${i}`) * 1080;
      const v = 25 + random(`ev${i}`) * 55;
      const y = 1980 - ((t * v * speed + random(`ey${i}`) * 2000) % 2100);
      const x = x0 + Math.sin(t * 0.7 + i) * 40;
      const size = 3 + random(`es${i}`) * 7;
      const color = warm > 0.5 ? "255,150,90" : "255,215,140";
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: "50%",
            background: `rgba(${color},0.9)`,
            filter: "blur(1.5px)",
            boxShadow: `0 0 ${size * 4}px rgba(${color},0.9)`,
            opacity: 0.25 + 0.5 * random(`eo${i}`),
          }}
        />
      );
    })}
  </>
);

const Verse: React.FC<{
  verse: (typeof TIMELINE.verses)[number];
  t: number;
  fps: number;
}> = ({ verse, t }) => {
  const exitStart = verse.start + verse.dur + 0.15;
  const exit = interpolate(t, [exitStart, exitStart + 0.9], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  if (t < verse.start - 0.6 || exit >= 1) return null;

  const split = SPLIT[verse.idx];
  const lines = [verse.words.slice(0, split), verse.words.slice(split)];
  const big = verse.climax ? 1.18 : 1;
  const hit = interpolate(t, [verse.start - 0.05, verse.start + 0.5], [1.6, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        transform: `translateY(${-exit * 160}px) scale(${1 + exit * 0.08})`,
        opacity: 1 - exit,
        filter: `blur(${exit * 14}px)`,
      }}
    >
      <div
        style={{
          fontFamily: naskh,
          color: "rgba(243,213,138,0.75)",
          fontSize: 40,
          letterSpacing: 8,
          marginBottom: 40,
          opacity: interpolate(t, [verse.start - 0.5, verse.start], [0, 1], clamp),
        }}
      >
        {verse.climax ? "✦ ✦ ✦" : `— ${ARABIC_DIGITS[verse.idx]} —`}
      </div>
      {lines.map((line, li) => (
        <div
          key={li}
          dir="rtl"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 30px",
            width: 980,
            marginTop: li === 1 ? 30 : 0,
          }}
        >
          {line.map((w, wi) => {
            const p = interpolate(t, [w.s - 0.12, w.s + 0.35], [0, 1], {
              ...clamp,
              easing: Easing.out(Easing.back(1.6)),
            });
            const speaking = t >= w.s && t <= w.e + 0.15;
            const glow = speaking ? 1 : 0.35;
            return (
              <span
                key={wi}
                style={{
                  fontFamily: calligraphy,
                  fontWeight: 700,
                  fontSize: 118 * big,
                  lineHeight: 1.55,
                  color: speaking ? "#fff6dc" : GOLD,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 60}px) scale(${0.7 + 0.3 * p + (speaking ? 0.04 : 0)})`,
                  filter: `blur(${(1 - p) * 12}px)`,
                  display: "inline-block",
                  textShadow: `0 0 ${18 + glow * 30}px rgba(255,190,90,${0.35 + glow * 0.45}), 0 6px 18px rgba(0,0,0,0.85)`,
                }}
              >
                {w.w}
              </span>
            );
          })}
        </div>
      ))}
      {/* light ring that bursts on the impact */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          border: `${4 * hit}px solid rgba(255,215,150,${0.5 * hit})`,
          transform: `scale(${1 + (1.6 - hit) * 3})`,
          opacity: hit > 0 ? 1 : 0,
        }}
      />
    </AbsoluteFill>
  );
};

export const PoemReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const verses = TIMELINE.verses;
  const climax = verses[verses.length - 1];
  const lastEnd = climax.start + climax.dur;

  // Warm, crimson grade for the climax.
  const warm = interpolate(t, [climax.start - 3, climax.start, lastEnd, lastEnd + 2], [0, 1, 1, 0.4], clamp);

  // Camera: slow push plus a short shake on every impact.
  let shake = 0;
  for (const v of verses) {
    const d = t - v.start;
    if (d > -0.05 && d < 0.5) shake = Math.max(shake, (v.climax ? 16 : 8) * (1 - d / 0.5));
  }
  const sx = Math.sin(frame * 2.3) * shake;
  const sy = Math.cos(frame * 3.1) * shake;
  const push = interpolate(frame, [0, durationInFrames], [1.0, 1.12]);

  // Flash on impact.
  const flash = Math.max(
    0,
    ...verses.map((v) => interpolate(t - v.start, [-0.05, 0.02, 0.35], [0, v.climax ? 0.55 : 0.28, 0], clamp)),
  );

  // Intro heartbeat pulse (matches thumps at 0.4s + n).
  const phase = (((t - 0.4) % 1) + 1) % 1;
  const beat = t >= 0.4 && t < TIMELINE.intro ? Math.exp(-phase * 7) : 0;

  const introOut = interpolate(t, [TIMELINE.intro - 1, TIMELINE.intro - 0.2], [1, 0], clamp);
  const introIn = interpolate(t, [0.3, 1.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const outroIn = interpolate(t, [lastEnd + 0.6, lastEnd + 2], [0, 1], clamp);
  const fadeAll = interpolate(t, [0, 0.6, TIMELINE.total - 1.6, TIMELINE.total], [0, 1, 1, 0], clamp);

  const moonY = interpolate(t, [0, TIMELINE.total], [420, 330]);
  const fogShift = t * 18;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03040b" }}>
      <Audio src={staticFile("poem/poem.mp3")} />
      <AbsoluteFill
        style={{
          opacity: fadeAll,
          transform: `translate(${sx}px, ${sy}px) scale(${push})`,
        }}
      >
        {/* Sky */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg,
              rgb(${8 + warm * 40},${12 + warm * 2},${38 - warm * 18}) 0%,
              rgb(${16 + warm * 70},${18 + warm * 4},${52 - warm * 30}) 55%,
              rgb(${30 + warm * 60},${16},${24}) 100%)`,
          }}
        />
        <Stars t={t} />
        {/* Moon */}
        <div
          style={{
            position: "absolute",
            left: 540 - 150,
            top: moonY,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 35%, #fffbe9 0%, #f4e2b0 45%, ${warm > 0.5 ? "#e0a070" : "#c9b27a"} 100%)`,
            boxShadow: `0 0 ${120 + beat * 80}px ${30 + warm * 40}px rgba(255,${220 - warm * 70},${150 - warm * 60},${0.35 + beat * 0.2 + warm * 0.15})`,
            opacity: 0.92,
          }}
        />
        {/* Drifting fog */}
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: -400 + ((fogShift * (k + 1) * 0.6 + k * 500) % 1400) - 200,
              top: 1100 + k * 220,
              width: 1400,
              height: 520,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(170,170,210,0.13), transparent 70%)",
              filter: "blur(30px)",
            }}
          />
        ))}
        {/* Horizon silhouette: dunes */}
        <svg style={{ position: "absolute", bottom: 0 }} width={1080} height={520} viewBox="0 0 1080 520">
          <path d="M0 330 C 220 250, 380 300, 560 280 S 900 220, 1080 290 L1080 520 L0 520 Z" fill="#090813" opacity={0.85} />
          <path d="M0 420 C 260 360, 460 430, 700 390 S 960 360, 1080 400 L1080 520 L0 520 Z" fill="#040309" />
        </svg>
        <Embers t={t} speed={1 + warm * 1.8} warm={warm} />
      </AbsoluteFill>

      {/* Vignette with heartbeat */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent ${45 - beat * 12}%, rgba(0,0,0,${0.75 + beat * 0.15}) 100%)`,
        }}
      />

      {/* Intro title */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: introIn * introOut * fadeAll }}>
        <div style={{ fontFamily: naskh, color: "rgba(243,213,138,0.8)", fontSize: 44, letterSpacing: 14, marginBottom: 20 }}>
          قصيدة
        </div>
        <div
          style={{
            fontFamily: calligraphy,
            fontWeight: 700,
            fontSize: 150,
            color: GOLD,
            transform: `scale(${0.9 + 0.1 * introIn + beat * 0.02})`,
            textShadow: "0 0 40px rgba(255,190,90,0.6), 0 8px 24px rgba(0,0,0,0.9)",
          }}
        >
          كيف أنام الليل
        </div>
        <div style={{ width: 360 * introIn, height: 2, marginTop: 30, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
      </AbsoluteFill>

      {verses.map((v, i) => (
        <Verse key={i} verse={v} t={t} fps={fps} />
      ))}

      {/* Outro */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: outroIn * fadeAll }}>
        <div
          style={{
            fontFamily: calligraphy,
            fontWeight: 700,
            fontSize: 96,
            color: GOLD,
            textShadow: "0 0 40px rgba(255,170,90,0.7)",
            transform: `scale(${1 + (t - lastEnd) * 0.015})`,
          }}
        >
          يا عالمٍ بالقلوب
        </div>
        <div style={{ fontFamily: naskh, fontSize: 46, color: "rgba(255,240,210,0.75)", marginTop: 26, letterSpacing: 6 }}>
          ❤
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: `rgba(255,236,200,${flash})`, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};
