import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import type { Caption } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";
import { LEGAL_COLORS } from "../legalTheme";

const SWITCH_MS = 1400;
const ENTER_S = 0.3;
const HOLD_S = 1.5;
const EXIT_S = 0.2;
const KEYWORDS = new Set(
  [
    "rfp",
    "r.f.p",
    "compliance",
    "match",
    "deadline",
    "proposal",
    "conflict",
    "matter",
    "helix",
    "legal",
    "ninety-four",
    "eighty-seven",
  ].map((w) => w.toLowerCase()),
);

function isKeyword(raw: string): boolean {
  const t = raw.replace(/[^A-Za-z0-9.]/g, "").toLowerCase();
  return KEYWORDS.has(t);
}

export const LegalSubtitles: React.FC = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("legal-captions"));

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile("legal-captions.json"));
      if (!response.ok) {
        setCaptions([]);
        continueRender(handle);
        return;
      }
      const data = (await response.json()) as Caption[];
      setCaptions(Array.isArray(data) ? data : []);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const pages = useMemo(() => {
    if (!captions?.length) return [];
    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: SWITCH_MS,
    }).pages;
  }, [captions]);

  const { fps } = useVideoConfig();
  const pageLife = ENTER_S + HOLD_S + EXIT_S;

  if (!pages.length) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {pages.map((page, i) => {
        const from = Math.round((page.startMs / 1000) * fps);
        const dur = Math.max(1, Math.round(pageLife * fps));
        return (
          <Sequence key={`${page.startMs}-${i}`} from={from} durationInFrames={dur} layout="none">
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const CaptionPage: React.FC<{
  page: ReturnType<typeof createTikTokStyleCaptions>["pages"][number];
}> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = ENTER_S * fps;
  const holdEnd = (ENTER_S + HOLD_S) * fps;
  const exitEnd = (ENTER_S + HOLD_S + EXIT_S) * fps;
  const opacity = interpolate(frame, [0, enter, holdEnd, exitEnd], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, enter], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-start",
        padding: "0 64px 72px",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          maxWidth: "70%",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.35,
          color: LEGAL_COLORS.white,
          textShadow: "0 2px 12px rgba(0,0,0,0.65)",
        }}
      >
        {page.tokens.map((tok, i) => {
          const accent = isKeyword(tok.text);
          return (
            <span
              key={`${tok.fromMs}-${i}`}
              style={{
                color: accent ? LEGAL_COLORS.gold : LEGAL_COLORS.white,
                fontWeight: accent ? 600 : 500,
              }}
            >
              {tok.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
