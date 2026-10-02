import type { StoredRfp } from "@helix/core";
import { assignTeam, battleCard, goNoGo } from "@/lib/rfp-intel";

export type Pursuit = {
  verdict: "GO" | "CONDITIONAL" | "NO-GO";
  score: number;
  probability: number | null;
  reasons: string[];
};

/** Win chance from closed outcomes, then incumbent, margin, jurisdiction, and hours. */
export function pursuitRecommendation(rfp: StoredRfp, peers: StoredRfp[] = []): Pursuit {
  const base = goNoGo(rfp);
  const incumbents = battleCard(rfp).names;
  const hours = assignTeam(rfp).hours;
  let verdict = base.verdict;
  const reasons = [base.why];

  if (incumbents.length) {
    reasons.push(`Incumbent on the record: ${incumbents.join(", ")}.`);
    if (verdict === "GO") verdict = "CONDITIONAL";
  } else {
    reasons.push("No named incumbent in the solicitation text.");
  }

  if (rfp.tier === "hot") reasons.push("Expected margin: inside the desk band.");
  else if (rfp.tier === "warm") reasons.push("Expected margin: tight — confirm rate card before bid.");
  else reasons.push("Expected margin: below the floor for this method.");

  reasons.push(`Jurisdiction signal: ${rfp.issuer || "issuer not stated"}.`);
  reasons.push(`Effort: about ${hours} partner hours before submission.`);

  const closed = peers.filter((peer) => {
    const outcome = peer.partnerDecision?.outcome;
    return outcome === "won" || outcome === "lost";
  });
  const sameMethod = closed.filter((peer) => peer.method === rfp.method);
  const pool = sameMethod.length >= 2 ? sameMethod : closed;
  const won = pool.filter((peer) => peer.partnerDecision?.outcome === "won").length;
  const probability = pool.length === 0 ? null : Math.round((won / pool.length) * 100);
  if (probability == null) {
    reasons.push("No closed won/lost history yet, so this is not a calibrated win probability.");
  } else {
    reasons.unshift(
      `Historical win rate (${sameMethod.length >= 2 ? rfp.method : "all closed matters"}): ${probability}% (${won}/${pool.length}).`
    );
    if (probability < 35 && verdict === "GO") verdict = "CONDITIONAL";
  }

  return { verdict, score: probability ?? base.score, probability, reasons };
}
