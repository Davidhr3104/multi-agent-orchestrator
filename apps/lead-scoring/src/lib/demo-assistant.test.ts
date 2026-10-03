import { describe, expect, it } from "vitest";
import type { StoredLead } from "@helix/core";
import { buildDemoReply } from "./demo-assistant";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const DAY = 86_400_000;

function lead(p: Partial<StoredLead> & { id: string; name: string }): StoredLead {
  return {
    classification: "lead",
    score: 70,
    tier: "warm",
    confidence: 0.78,
    reasoning: "",
    fields: [],
    needsReview: false,
    engine: "heuristic",
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    runId: "run",
    crmStatus: "not_sent",
    source: "website",
    message: "",
    email: `${p.id}@example.com`,
    pipelineStage: "new",
    ...p,
  } as StoredLead;
}

const jordan = lead({
  id: "jordan",
  name: "Jordan Hale",
  score: 96,
  tier: "hot",
  confidence: 0.78,
  timeline: "this week",
  budget: "12000",
  pipelineStage: "qualified",
  fields: [
    {
      key: "budget_signal",
      label: "Budget",
      value: "12000",
      confidence: 0.7,
      evidence: "chars 1-5",
      quote: "12000",
      spanStart: 0,
      spanEnd: 5,
      verified: true,
      needsHuman: false,
    },
    {
      key: "timeline_signal",
      label: "Timeline",
      value: "this week",
      confidence: 0.7,
      evidence: "",
      quote: "",
      spanStart: 0,
      spanEnd: 0,
      verified: false,
      needsHuman: false,
    },
  ],
});
const maya = lead({ id: "maya", name: "Maya Chen", score: 90, tier: "hot", pipelineStage: "qualified" });
const ava = lead({
  id: "ava",
  name: "Ava Brooks",
  score: 42,
  tier: "cold",
  classification: "info",
  createdAt: new Date(NOW - 200 * DAY).toISOString(),
});
const recentCold = lead({ id: "recent", name: "Recent Cold", score: 40, tier: "cold", createdAt: new Date(NOW - 3 * DAY).toISOString() });
const spam = lead({
  id: "spam",
  name: "Crypto Blast",
  score: 18,
  tier: "cold",
  classification: "spam",
  pipelineStage: "lost",
  createdAt: new Date(NOW - 300 * DAY).toISOString(),
});
const priya = lead({ id: "priya", name: "Priya Nair", score: 68, tier: "warm", needsReview: true });

const all = [jordan, maya, ava, recentCold, spam, priya];

describe("buildDemoReply", () => {
  it("summarizes the active pipeline and ignores archived/spam leads", () => {
    const r = buildDemoReply("How is my pipeline doing?", all, NOW);
    expect(r.answer).toContain("5 active leads");
    expect(r.answer).toContain("Jordan Hale");
    expect(r.answer).not.toContain("Crypto Blast");
    expect(r.proposal).toBeUndefined();
    expect(r.suggestions).toBeUndefined();
  });

  it("explains a lead by name using its real scored fields and quotes", () => {
    const r = buildDemoReply("Why does Jordan Hale have the highest score?", all, NOW);
    expect(r.answer).toContain("Jordan Hale");
    expect(r.answer).toContain("96");
    expect(r.answer).toContain("Budget");
    expect(r.answer).toContain("“12000”");
  });

  it("resolves a first or last name only (not the top lead)", () => {
    expect(buildDemoReply("why did Priya score 68?", all, NOW).answer).toContain("Priya Nair scored 68");
    expect(buildDemoReply("why did nair score 68?", all, NOW).answer).toContain("Priya Nair");
  });

  it("asks which lead when a partial name is ambiguous", () => {
    const other = lead({ id: "p2", name: "Priya Shah", score: 50 });
    const r = buildDemoReply("why did Priya score 68?", [...all, other], NOW);
    expect(r.answer).toMatch(/which lead/i);
    expect(r.answer).toContain("Priya Shah");
    expect(r.answer).not.toContain("Jordan Hale");
  });

  it("explains the top active lead when no name is given", () => {
    const r = buildDemoReply("Why is my best lead scored so high?", all, NOW);
    expect(r.answer).toContain("Jordan Hale");
  });

  it("proposes archiving only cold, active leads idle for 30+ days", () => {
    const r = buildDemoReply("Do I have any leads that need cleanup?", all, NOW);
    expect(r.proposal?.action).toBe("archive_leads");
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["ava"]);
  });

  it("proposes nothing when there is nothing to clean up", () => {
    const r = buildDemoReply("Find stale leads", [jordan, maya, recentCold], NOW);
    expect(r.proposal).toBeUndefined();
    expect(r.answer).toMatch(/nothing to clean up/i);
  });

  it("proposes approving leads waiting in the human-review queue", () => {
    const r = buildDemoReply("What is waiting in the review queue?", all, NOW);
    expect(r.proposal?.action).toBe("approve_leads");
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["priya"]);
  });

  it("says the review queue is clear when it is", () => {
    const r = buildDemoReply("Anything to approve?", [jordan, maya], NOW);
    expect(r.proposal).toBeUndefined();
    expect(r.answer).toMatch(/clear/i);
  });

  it("suggests 3 plays for the top actionable lead with exactly one recommended, each backed by a real stage change", () => {
    const r = buildDemoReply("What's my best next move?", all, NOW);
    expect(r.suggestions).toHaveLength(3);
    expect(r.suggestions!.filter((s) => s.recommended)).toHaveLength(1);
    for (const s of r.suggestions!) {
      expect(s.action.action).toBe("advance_stage");
      expect(s.action.stage).toBe("contacted");
      expect(s.action.targetIds).toEqual(["jordan"]);
    }
    expect(r.answer).toContain("Jordan Hale");
  });

  it("recommends the fast-track call for an urgent lead and the softer play otherwise", () => {
    const urgent = buildDemoReply("next move?", [jordan], NOW);
    expect(urgent.suggestions![0].recommended).toBe(true);

    const calm = lead({ id: "calm", name: "Calm Co", score: 72, tier: "warm", timeline: "next quarter", pipelineStage: "qualified" });
    const soft = buildDemoReply("next move?", [calm], NOW);
    expect(soft.suggestions![0].recommended).toBeFalsy();
    expect(soft.suggestions![1].recommended).toBe(true);
  });

  it("skips leads already contacted, in review, or archived when picking who to act on", () => {
    const contacted = lead({ id: "c", name: "Already Contacted", score: 99, tier: "hot", pipelineStage: "contacted" });
    const r = buildDemoReply("next move?", [contacted, priya, spam, maya], NOW);
    expect(r.suggestions![0].action.targetIds).toEqual(["maya"]);
  });

  it("gives a helpful capability list for unrecognized questions instead of raw data", () => {
    const r = buildDemoReply("tell me a joke", all, NOW);
    expect(r.answer).toMatch(/summarize/i);
    expect(r.answer).toMatch(/clean up/i);
    expect(r.proposal).toBeUndefined();
  });

  it("turns \"clean up my stale leads\" into a command, not just a question", () => {
    const r = buildDemoReply("Clean up my stale leads", all, NOW);
    expect(r.command).toBe(true);
    expect(r.proposal?.action).toBe("archive_leads");
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["ava"]);
  });

  it("parses \"move <lead> to contacted\" as a stage change on that lead", () => {
    const r = buildDemoReply("Move Jordan Hale to contacted", all, NOW);
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "advance_stage", stage: "contacted" });
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["jordan"]);
  });

  it("parses \"add a note to <lead>: text\"", () => {
    const r = buildDemoReply("Add a note to Maya Chen: sent pricing deck", all, NOW);
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "add_note", note: "sent pricing deck" });
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["maya"]);
  });

  it("says so when the named lead does not exist instead of guessing", () => {
    const r = buildDemoReply("Move Nobody Here to contacted", all, NOW);
    expect(r.command).toBeUndefined();
    expect(r.proposal).toBeUndefined();
    expect(r.answer).toMatch(/couldn.t find/i);
  });

  it("keeps plain questions as proposals, never commands", () => {
    expect(buildDemoReply("Do I have any leads that need cleanup?", all, NOW).command).toBeUndefined();
  });

  it("handles an empty desk", () => {
    const r = buildDemoReply("How is my pipeline doing?", [], NOW);
    expect(r.answer).toMatch(/no leads/i);
  });
});
