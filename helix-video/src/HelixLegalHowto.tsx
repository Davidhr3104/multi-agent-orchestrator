import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Freeze, Sequence, staticFile } from "remotion";
import { LegalSubtitles } from "./components/LegalSubtitles";
import {
  LEGAL_DURATION_FRAMES,
  LEGAL_PLATE_FRAMES,
  LEGAL_VO,
  legalVoPlayDuration,
} from "./legalTheme";
import { FPS } from "./theme";

/** Helix for Legal howto — navy/gold plate + scene-aligned VO. */
export const HelixLegalHowto: React.FC = () => {
  const lastPlateFrame = LEGAL_PLATE_FRAMES - 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#050A12" }}>
      <Sequence from={0} durationInFrames={LEGAL_PLATE_FRAMES} name="Picture plate">
        <AbsoluteFill>
          <Video
            src={staticFile("plates/helix-legal-howto.mp4")}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      </Sequence>
      <Sequence
        from={LEGAL_PLATE_FRAMES}
        durationInFrames={Math.max(1, LEGAL_DURATION_FRAMES - LEGAL_PLATE_FRAMES)}
        name="Plate hold"
      >
        <Freeze frame={lastPlateFrame}>
          <AbsoluteFill>
            <Video
              src={staticFile("plates/helix-legal-howto.mp4")}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        </Freeze>
      </Sequence>

      {LEGAL_VO.map((clip, i) => {
        const playDur = legalVoPlayDuration(i);
        const fadeFrames = Math.min(Math.round(0.12 * FPS), Math.max(1, Math.floor(playDur * FPS) - 1));
        return (
          <Sequence
            key={clip.id}
            name={`VO ${clip.id}`}
            from={Math.round(clip.start * FPS)}
            durationInFrames={Math.max(1, Math.round(playDur * FPS))}
          >
            <Audio
              src={staticFile(clip.file)}
              volume={(f) => {
                const total = Math.max(1, Math.round(playDur * FPS));
                if (f >= total - fadeFrames) {
                  return Math.max(0, (total - f) / fadeFrames);
                }
                return 1;
              }}
            />
          </Sequence>
        );
      })}

      <LegalSubtitles />
    </AbsoluteFill>
  );
};
