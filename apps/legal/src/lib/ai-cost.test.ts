import { describe, expect, it } from "vitest";
import {
  CLAUDE_INPUT_USD_PER_MTOK_ESTIMATE,
  CLAUDE_OUTPUT_USD_PER_MTOK_ESTIMATE,
  estimateClaudeUsd,
  formatUsdEstimate,
  summarizeDeskUsage,
  usageEntry,
} from "./ai-cost";

describe("AI cost estimates", () => {
  it("prices tokens with the named list-price constants", () => {
    expect(estimateClaudeUsd(1_000_000, 0)).toBe(CLAUDE_INPUT_USD_PER_MTOK_ESTIMATE);
    expect(estimateClaudeUsd(0, 1_000_000)).toBe(CLAUDE_OUTPUT_USD_PER_MTOK_ESTIMATE);
    expect(estimateClaudeUsd(3000, 600)).toBeCloseTo(0.009 + 0.009, 6);
  });

  it("sums usage across RFPs", () => {
    const a = usageEntry({ purpose: "extraction", inputTokens: 2000, outputTokens: 500, rfpId: "x" });
    const b = usageEntry({ purpose: "coi", inputTokens: 1000, outputTokens: 100, rfpId: "y" });
    const total = summarizeDeskUsage([{ aiUsage: [a] }, { aiUsage: [b] }, {}]);
    expect(total.calls).toBe(2);
    expect(total.inputTokens).toBe(3000);
    expect(total.outputTokens).toBe(600);
    expect(total.estimatedUsd).toBeCloseTo(a.estimatedUsd + b.estimatedUsd, 6);
  });

  it("formats tiny amounts without rounding them to zero", () => {
    expect(formatUsdEstimate(0)).toBe("$0.00");
    expect(formatUsdEstimate(0.0042)).toBe("$0.0042");
    expect(formatUsdEstimate(1.234)).toBe("$1.23");
  });
});
