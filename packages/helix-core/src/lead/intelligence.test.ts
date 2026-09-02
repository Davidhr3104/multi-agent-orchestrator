import { describe, expect, it } from "vitest";
import {
  applyBehavior,
  attachIntelligence,
  detectCompetitors,
  findDuplicate,
  mergeCompetitors,
  routeLead,
  sourceAttribution,
} from "./intelligence";
import { scoreLeadHeuristic } from "./heuristic";
import type { StoredLead } from "../types";

function asLead(partial: Partial<StoredLead> & { email: string; name: string }): StoredLead {
  const scored = scoreLeadHeuristic(partial);
  return {
    ...scored,
    id: partial.id ?? "l1",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    runId: "run",
    crmStatus: "not_sent",
    name: partial.name,
    email: partial.email,
    source: partial.source ?? "website",
    message: partial.message ?? "",
    budget: partial.budget,
    phone: partial.phone,
    company: partial.company,
    assignee: partial.assignee,
  };
}

describe("lead intelligence", () => {
  it("dedupes by email and keeps the original id on reingest", () => {
    const first = asLead({
      id: "seed-maya",
      name: "Maya Chen",
      email: "maya@northwindhvac.com",
      budget: "8500",
    });
    const incoming = asLead({
      id: "new-id",
      name: "Maya Chen",
      email: "Maya@Northwindhvac.com",
      budget: "12000",
      message: "Back again, still evaluating HubSpot vs you.",
    });
    expect(findDuplicate([first], incoming)?.id).toBe("seed-maya");
    const merged = attachIntelligence(incoming, first, [first]);
    expect(merged.id).toBe("seed-maya");
    expect(merged.reingestCount).toBe(1);
    expect(merged.notes?.some((n) => /re-ingested/i.test(n))).toBe(true);
    expect(merged.competitors?.some((c) => c.name === "HubSpot")).toBe(true);
  });

  it("routes $10k+ to a senior rep", () => {
    const { assignee, reason } = routeLead(
      { name: "Jordan", email: "jordan@acme.io", budget: "12000", message: "SaaS inbound" },
      []
    );
    expect(assignee).toBe("Sam Patel");
    expect(reason).toMatch(/senior/i);
  });

  it("applies behavioral deltas and records history", () => {
    const lead = attachIntelligence(
      asLead({ name: "Ava", email: "ava@example.org", message: "Just looking" }),
      null,
      []
    );
    const next = applyBehavior(lead, "pricing_visit");
    expect(next.score).toBe(lead.score + 15);
    expect(next.scoreHistory?.at(-1)?.reason).toMatch(/pricing/i);
  });

  it("computes source hot rates", () => {
    const rows = sourceAttribution([
      asLead({ name: "A", email: "a@x.com", source: "referral", message: "x".repeat(90), budget: "12000", timeline: "this week" }),
      asLead({ name: "B", email: "b@x.com", source: "referral", message: "curious" }),
    ]);
    expect(rows[0]?.source).toBe("referral");
  });

  it("detects competitors", () => {
    expect(detectCompetitors("we're evaluating Salesforce").map((c) => c.name)).toContain("Salesforce");
  });

  it("merges Claude competitor names with heuristic talking points", () => {
    const merged = mergeCompetitors(
      [{ name: "Salesforce", talkingPoints: [] }],
      detectCompetitors("we're evaluating Salesforce")
    );
    expect(merged[0]?.talkingPoints.length).toBeGreaterThan(0);
  });
});
