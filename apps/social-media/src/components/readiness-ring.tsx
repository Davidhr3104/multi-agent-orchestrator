import { ScoreRing } from "@helix/ui";
import type { Readiness } from "@/lib/types";

/** The readiness score as a ring. It scores form (length, tags, CTA, voice, visual), not performance. */
export function ReadinessRing({ r, size = 40 }: { r: Pick<Readiness, "score" | "ready">; size?: number }) {
  return <ScoreRing score={r.score} size={size} label={`Readiness ${r.score} of 100${r.ready ? ", ready for approval" : ", needs work"}`} />;
}
