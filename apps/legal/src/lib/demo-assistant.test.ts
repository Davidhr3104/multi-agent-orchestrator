import { describe, expect, it } from "vitest";
import type { StoredRfp } from "@helix/core";
import { buildDemoReply } from "./demo-assistant";

const NOW = Date.parse("2026-09-29T12:00:00Z");

function rfp(p: Partial<StoredRfp> & { id: string; title: string; issuer: string }): StoredRfp {
  return {
    matchScore: 50,
    tier: "warm",
    method: "SPI",
    amount: "$10,000",
    deadline: "2026-10-30",
    confidence: 0.8,
    reasoning: "Heuristic match.",
    fields: [],
    unverifiedCount: 0,
    needsReview: false,
    engine: "heuristic",
    createdAt: "2026-09-20T00:00:00Z",
    runId: "r",
    body: "",
    clientProfile: "",
    corpusStatus: "none",
    ...p,
  } as unknown as StoredRfp;
}

const medical = rfp({ id: "medical", title: "Medical record abstraction — mass tort docket", issuer: "Northstar PI Consortium", matchScore: 78, tier: "hot", deadline: "2026-09-18" });
const spi = rfp({ id: "spi", title: "SPI coding for workers' compensation clinic", issuer: "Harbor Occupational Health", matchScore: 65, reasoning: "Method SPI; clinic RFP.", deadline: "2026-10-02" });
const county = rfp({ id: "county", title: "County IT — Kubernetes refresh", issuer: "Lake County CIO", matchScore: 32, tier: "cold", unverifiedCount: 1, deadline: "2026-11-01" });
const clinical = rfp({ id: "clinical", title: "Clinical NLP RFP (thin posting)", issuer: "Unspecified", matchScore: 24, tier: "cold", unverifiedCount: 3, needsReview: true, deadline: "unspecified" });
const all = [medical, spi, county, clinical];

describe("legal demo assistant", () => {
  it("summarizes the desk and counts what is flagged", () => {
    const r = buildDemoReply("Summarize my RFP pipeline", all, NOW);
    expect(r.answer).toContain("4 RFPs");
    expect(r.answer).toContain("Clinical NLP RFP");
    expect(r.answer).toMatch(/4 facts/);
  });

  it("lists what needs attention: review flag, unverified facts and passed deadlines", () => {
    const a = buildDemoReply("Which RFPs need my attention?", all, NOW).answer;
    expect(a).toContain("Clinical NLP RFP — flagged for partner review");
    expect(a).toContain("County IT — 1 unverified fact");
    expect(a).toMatch(/Medical record abstraction.*passed/);
  });

  it("orders deadlines soonest first and marks passed ones", () => {
    const a = buildDemoReply("What are the nearest deadlines?", all, NOW).answer;
    expect(a.indexOf("Medical record")).toBeLessThan(a.indexOf("SPI coding"));
    expect(a).toContain("passed");
    expect(a).not.toContain("Clinical NLP");
  });

  it("explains an RFP by a few words of its title", () => {
    const r = buildDemoReply("Why did the SPI coding RFP score 65?", all, NOW);
    expect(r.answer).toContain("matched 65");
    expect(r.answer).toContain("Method SPI");
  });

  it("parses a conflict-check command on the right RFP", () => {
    const r = buildDemoReply("Run a conflict check on the SPI coding RFP", all, NOW);
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "run_conflict_check" });
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["spi"]);
  });

  it("parses fee quote, review escalation and note commands", () => {
    expect(buildDemoReply("Prepare a fee quote for the County IT RFP", all, NOW).proposal).toMatchObject({ action: "run_pricing" });
    expect(buildDemoReply("Send the Clinical NLP RFP to partner review", all, NOW).proposal).toMatchObject({ action: "flag_review" });
    const note = buildDemoReply("Add a note to the SPI coding RFP: client asked for E&O proof", all, NOW);
    expect(note.proposal).toMatchObject({ action: "add_note", params: { note: "client asked for E&O proof" } });
  });

  it("parses a partner verdict, including NO-GO, into params", () => {
    const r = buildDemoReply("Record NO-GO on the County IT RFP", all, NOW);
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "record_decision", params: { verdict: "NO-GO" } });
    expect(buildDemoReply("Mark conditional on the SPI coding RFP", all, NOW).proposal?.params).toEqual({ verdict: "CONDITIONAL" });
  });

  it("asks which one when the name is ambiguous, and says so when nothing matches", () => {
    const amb = buildDemoReply("Run a conflict check on the clinical RFP", [spi, clinical, rfp({ id: "c2", title: "Clinical records audit", issuer: "X" })], NOW);
    expect(amb.proposal).toBeUndefined();
    expect(amb.answer).toMatch(/which one/i);
    const none = buildDemoReply("Run a conflict check on the zeppelin RFP", all, NOW);
    expect(none.proposal).toBeUndefined();
    expect(none.answer).toMatch(/couldn.t find/i);
  });

  it("shows help for anything else and handles an empty desk", () => {
    expect(buildDemoReply("tell me a joke", all, NOW).answer).toMatch(/conflict check|summarize/i);
    expect(buildDemoReply("summarize", [], NOW).answer).toMatch(/no RFPs/i);
  });
});
