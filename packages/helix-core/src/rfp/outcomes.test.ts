import { describe, expect, it } from "vitest";
import { parseMoneyLoose, summarizeLegalOutcomes } from "./outcomes";
import type { StoredRfp } from "../types";

function rfp(partial: Partial<StoredRfp> & Pick<StoredRfp, "id" | "title">): StoredRfp {
  return {
    matchScore: 70,
    tier: "warm",
    method: "other",
    amount: partial.amount ?? "$100k",
    deadline: "2026-10-01",
    confidence: 0.7,
    reasoning: "test",
    fields: [],
    unverifiedCount: 0,
    needsReview: false,
    engine: "heuristic",
    createdAt: "2026-09-01T00:00:00.000Z",
    runId: "t",
    issuer: "Acme",
    body: "body",
    clientProfile: "profile",
    corpusStatus: "mocked",
    ...partial,
  };
}

describe("legal outcomes", () => {
  it("parses money loose", () => {
    expect(parseMoneyLoose("$120k")).toBe(120000);
    expect(parseMoneyLoose("Unspecified")).toBeNull();
  });

  it("computes win-rate and avoided spend on NO-GO", () => {
    const summary = summarizeLegalOutcomes([
      rfp({
        id: "1",
        title: "Won GO",
        partnerDecision: {
          verdict: "GO",
          coiCleared: true,
          bidAmount: "$200k",
          decidedBy: "p",
          decidedAt: "2026-09-01",
          outcome: "won",
          wonAmount: "$180k",
        },
      }),
      rfp({
        id: "2",
        title: "Lost GO",
        partnerDecision: {
          verdict: "GO",
          coiCleared: true,
          bidAmount: "$90k",
          decidedBy: "p",
          decidedAt: "2026-09-01",
          outcome: "lost",
        },
      }),
      rfp({
        id: "3",
        title: "No bid",
        partnerDecision: {
          verdict: "NO-GO",
          coiCleared: false,
          bidAmount: "$500k",
          decidedBy: "p",
          decidedAt: "2026-09-01",
          outcome: "no_bid",
        },
      }),
    ]);
    expect(summary.winRate).toBe(0.5);
    expect(summary.wonUsd).toBe(180000);
    expect(summary.avoidedUsd).toBe(500000);
    expect(summary.goWon).toBe(1);
    expect(summary.goLost).toBe(1);
  });
});
