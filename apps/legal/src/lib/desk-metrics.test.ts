import { describe, expect, it } from "vitest";
import { effectiveOutcome as coreOutcome, parseMoneyLoose as coreMoney, summarizeLegalOutcomes } from "@helix/core";
import { buildDemoSeed } from "@/lib/demo-seed";
import { bidRows, effectiveOutcome, outcomeCounts, parseMoneyLoose, deadlineSummary, deskStage, goFunnel, normalizeWeights, rangePosition, rfpDeadline, timelineScale, verdictCounts } from "@/lib/desk-metrics";
import { extractDeadlines, goNoGo, toIsoDate, winProbability } from "@/lib/rfp-intel";

const NOW = new Date(2026, 9, 2, 12, 0, 0).getTime();
const seed = buildDemoSeed(NOW, "profile");
const byTitle = (p: string) => seed.rfps.find((r) => r.title.startsWith(p))!;

describe("demo seed tells one story", () => {
  it("assigns each RFP one stage and one verdict", () => {
    expect(deskStage(byTitle("Medical"))).toBe("won");
    expect(deskStage(byTitle("SPI"))).toBe("lost");
    expect(deskStage(byTitle("County"))).toBe("no_bid");
    expect(deskStage(byTitle("Clinical"))).toBe("pending");
    expect(deskStage(byTitle("IME"))).toBe("awaiting");
    expect(goNoGo(byTitle("County")).verdict).toBe("NO-GO");
  });

  it("audit lines quote the same verdict the Go/No-Go engine returns", () => {
    const county = byTitle("County");
    const g = goNoGo(county);
    expect(seed.audit.some((e) => e.detail.includes(`${county.title}: ${g.verdict} (${g.score})`))).toBe(true);
    expect(seed.audit.some((e) => e.detail.includes("County IT — Kubernetes refresh: GO"))).toBe(false);
  });

  it("audit timestamps are distinct, newest first", () => {
    const times = seed.audit.map((e) => e.at);
    expect(new Set(times).size).toBe(times.length);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("closed RFPs are never past due and a second date never counts twice", () => {
    const s = deadlineSummary(seed.rfps, NOW);
    expect(s.pastDue).toBe(0);
    expect(s.closed).toBe(3);
    expect(rfpDeadline(byTitle("Medical"), NOW).kind).toBe("closed");
    expect(rfpDeadline(byTitle("IME"), NOW).kind).toBe("week");
    expect(s.within14).toBe(1);
    expect(s.next?.title).toMatch(/IME/);
  });

  it("an open RFP whose dates all passed is one past-due RFP", () => {
    const open = { ...byTitle("Medical"), partnerDecision: undefined };
    expect(extractDeadlines(open, NOW).length).toBeGreaterThan(1);
    const s = deadlineSummary([open], NOW);
    expect(s.pastDue).toBe(1);
  });

  it("win rate uses recorded outcomes only and matches the funnel", () => {
    const o = summarizeLegalOutcomes(seed.rfps);
    expect(o.won).toBe(1);
    expect(o.lost).toBe(1);
    const f = goFunnel(seed.rfps);
    expect(f.map((x) => x.value)).toEqual([5, 4, 3, 1]);
    const v = verdictCounts(seed.rfps);
    expect(v.go + v.conditional + v.noGo).toBe(5);
  });

  it("win probability is one pre-decision estimate bounded 8..92", () => {
    for (const r of seed.rfps) {
      const p = winProbability(r);
      expect(p).toBeGreaterThanOrEqual(8);
      expect(p).toBeLessThanOrEqual(92);
    }
    expect(winProbability(byTitle("SPI"))).toBeGreaterThan(winProbability(byTitle("County")));
  });

  it("bid rows pair bid and won amounts", () => {
    const rows = bidRows(seed.rfps);
    const med = rows.find((r) => r.title.startsWith("Medical"))!;
    expect(med.bid).toBe(85000);
    expect(med.won).toBe(92000);
    expect(rows.find((r) => r.title.startsWith("SPI"))!.won).toBeNull();
  });
});

describe("client-safe copies match helix-core", () => {
  it("effectiveOutcome and win rate agree", () => {
    for (const r of seed.rfps) expect(effectiveOutcome(r)).toBe(coreOutcome(r));
    const mine = outcomeCounts(seed.rfps);
    const core = summarizeLegalOutcomes(seed.rfps);
    expect(mine.won).toBe(core.won);
    expect(mine.lost).toBe(core.lost);
    expect(mine.winRate).toBe(core.winRate);
  });
  it("parseMoneyLoose agrees on the formats the desk uses", () => {
    for (const v of ["$85,000", "$92k", "Unspecified", "", "TBD", "1500.5"]) expect(parseMoneyLoose(v)).toBe(coreMoney(v));
  });
});

describe("helpers", () => {
  it("normalises dates to one format", () => {
    expect(toIsoDate("September 18, 2026")).toBe("2026-09-18");
    expect(toIsoDate("2026-09-18")).toBe("2026-09-18");
    expect(toIsoDate("not a date")).toBeNull();
  });
  it("weights become shares of their sum", () => {
    const w = normalizeWeights({ a: 30, b: 40, c: 30 });
    expect(w.map((x) => x.share)).toEqual([30, 40, 30]);
    expect(normalizeWeights({ a: 0 })[0].share).toBe(0);
  });
  it("timeline always contains today and positions are 0..100", () => {
    const sc = timelineScale([-14, 9, 30]);
    expect(sc.pos(0)).toBeGreaterThan(0);
    expect(sc.pos(0)).toBeLessThan(100);
    expect(sc.pos(sc.from)).toBe(0);
    expect(sc.pos(sc.to)).toBeCloseTo(100);
  });
  it("range position clamps", () => {
    expect(rangePosition(5, 10, 20)).toBe(0);
    expect(rangePosition(25, 10, 20)).toBe(100);
    expect(rangePosition(15, 10, 20)).toBe(50);
    expect(rangePosition(15, 10, 10)).toBe(0);
  });
});
