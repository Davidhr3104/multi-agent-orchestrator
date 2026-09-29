import { describe, expect, it } from "vitest";
import type { StoredLead } from "@helix/core";
import { assessRisk } from "./ai-risk";

function lead(p: Partial<StoredLead> & { id: string }): StoredLead {
  return {
    name: p.id,
    classification: "lead",
    score: 40,
    tier: "cold",
    needsReview: false,
    crmStatus: "not_sent",
    pipelineStage: "new",
    ...p,
  } as StoredLead;
}

describe("assessRisk", () => {
  it("lets a single low-score lead be archived automatically", () => {
    expect(assessRisk("archive_leads", [lead({ id: "a" })]).level).toBe("auto");
  });

  it("asks before archiving a high-score lead, and says why", () => {
    const r = assessRisk("archive_leads", [lead({ id: "a", score: 88, tier: "hot" })]);
    expect(r.level).toBe("confirm");
    expect(r.reasons.join(" ")).toMatch(/high-score/i);
  });

  it("asks before bulk archiving", () => {
    const many = ["a", "b", "c", "d"].map((id) => lead({ id }));
    expect(assessRisk("archive_leads", many).level).toBe("confirm");
  });

  it("asks before touching a lead already synced to the CRM", () => {
    const r = assessRisk("archive_leads", [lead({ id: "a", crmStatus: "pushed" as StoredLead["crmStatus"] })]);
    expect(r.level).toBe("confirm");
  });

  it("never auto-approves the human-review queue", () => {
    expect(assessRisk("approve_leads", [lead({ id: "a", needsReview: true })]).level).toBe("confirm");
  });

  it("asks before moving a lead that is still awaiting review", () => {
    expect(assessRisk("advance_stage", [lead({ id: "a", needsReview: true })]).level).toBe("confirm");
  });

  it("moves a normal lead forward and adds notes without asking", () => {
    expect(assessRisk("advance_stage", [lead({ id: "a" })]).level).toBe("auto");
    expect(assessRisk("add_note", [lead({ id: "a" })]).level).toBe("auto");
  });

  it("treats unknown actions and missing targets as needing confirmation", () => {
    expect(assessRisk("delete_leads", [lead({ id: "a" })]).level).toBe("confirm");
    expect(assessRisk("advance_stage", []).level).toBe("confirm");
  });
});
