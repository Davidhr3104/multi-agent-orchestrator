import { FPS } from "./theme";

/** HyperFrames plate length (seconds). */
export const LEGAL_PLATE_SECONDS = 60;
export const LEGAL_PLATE_FRAMES = LEGAL_PLATE_SECONDS * FPS;

/** Scene-aligned VO from OmniVoice audio_meta. */
export const LEGAL_VO = [
  { id: "01", file: "legal-voice-48k/01.wav", start: 0.0, duration: 3.83 },
  { id: "02", file: "legal-voice-48k/02.wav", start: 5.0, duration: 4.23 },
  { id: "03", file: "legal-voice-48k/03.wav", start: 12.0, duration: 5.27 },
  { id: "04", file: "legal-voice-48k/04.wav", start: 20.0, duration: 8.2 },
  { id: "05", file: "legal-voice-48k/05.wav", start: 30.0, duration: 5.79 },
  { id: "06", file: "legal-voice-48k/06.wav", start: 40.0, duration: 5.37 },
  { id: "07", file: "legal-voice-48k/07.wav", start: 48.0, duration: 6.09 },
  { id: "08", file: "legal-voice-48k/08.wav", start: 55.0, duration: 3.85 },
] as const;

export function legalVoPlayDuration(index: number): number {
  const clip = LEGAL_VO[index];
  if (!clip) return 0;
  const next = LEGAL_VO[index + 1];
  const cap = next ? next.start - clip.start - 0.05 : LEGAL_PLATE_SECONDS - clip.start;
  return Math.min(clip.duration, Math.max(0.4, cap));
}

export const LEGAL_DURATION_SECONDS = LEGAL_PLATE_SECONDS;
export const LEGAL_DURATION_FRAMES = LEGAL_PLATE_FRAMES;

export const LEGAL_COLORS = {
  gold: "#D4AF37",
  navy: "#0A1628",
  white: "#FFFFFF",
  bg: "#050A12",
} as const;
