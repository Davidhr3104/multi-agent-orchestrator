import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HelixLead } from "./lead-ai";
import { claudeResponse, isolateSecrets } from "./test-env";

let restore: () => void;

beforeEach(() => {
  vi.resetModules();
  vi.doMock("./supabase-leads", () => ({
    isSupabaseConfigured: () => false,
    supabaseListLeads: async () => null,
    supabaseUpsertLead: async () => true,
    supabaseListOrgIds: async () => null,
  }));
});

afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
  vi.doUnmock("./supabase-leads");
});

function realLead(): HelixLead {
  return {
    id: "lead-real-1",
    name: "Jordan Hale",
    email: "jordan@bookedjobs.com",
    company: "Booked Jobs",
    source: "website form",
    message: "Urgent: we need lead scoring this week, budget approved.",
    budget: "12000",
    timeline: "this week",
    classification: "lead",
    score: 60,
    tier: "warm",
    confidence: 0.6,
    reasoning: "",
    fields: [],
    needsReview: false,
    engine: "heuristic",
    createdAt: new Date().toISOString(),
    runId: "r1",
    crmStatus: "not_sent",
    pipelineStage: "new",
  };
}

describe("runTriageCron", () => {
  it("triages with Claude and queues proposals, but never calls a CRM", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test", HUBSPOT_TOKEN: "pat-test" });
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (!url.startsWith("https://api.anthropic.com/")) throw new Error(`unexpected call to ${url}`);
      const body = JSON.parse(String(init.body)) as { system?: string };
      if (body.system?.includes("next best move")) {
        return claudeResponse(
          JSON.stringify({
            action: "Call Jordan today",
            channel: "call",
            subject: "",
            message: "Hi Jordan, you mentioned you need lead scoring this week.",
            rationale: "Lead said 'this week' and budget approved.",
          })
        );
      }
      return claudeResponse(
        JSON.stringify({
          classification: "lead",
          score: 91,
          confidence: 0.92,
          reasons: [{ reason: "Urgent timeline", quote: "we need lead scoring this week" }],
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = await import("./store");
    await store.saveLead(realLead(), undefined, { real: true });
    const { runTriageCron } = await import("./cron-triage");
    const report = await runTriageCron();

    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("https://api.anthropic.com/"))).toBe(true);
    expect(report.scopes[0]).toMatchObject({ triaged: 1, triagedWithClaude: 1, proposalsQueued: 1, draftsWritten: 1 });

    const lead = (await store.getLead("lead-real-1")) as HelixLead;
    expect(lead.crmStatus).toBe("not_sent");
    expect(lead.score).toBe(91);
    expect(lead.aiTriage?.reasons[0].verified).toBe(true);
    expect(lead.crmProposal).toMatchObject({ status: "pending_approval", target: "hubspot", queuedBy: "cron" });
    expect(lead.nextMove).toMatchObject({ status: "draft", createdBy: "cron", channel: "call" });
  });

  it("skips a desk that is only showing demo data", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { runTriageCron } = await import("./cron-triage");
    const report = await runTriageCron();
    expect(report.scopes[0].skipped).toMatch(/demo/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("without a Claude key, triages heuristically and writes no AI draft", async () => {
    restore = isolateSecrets({ HUBSPOT_TOKEN: "pat-test" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = await import("./store");
    await store.saveLead(realLead(), undefined, { real: true });
    const { runTriageCron } = await import("./cron-triage");
    const report = await runTriageCron();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.scopes[0].triagedWithClaude).toBe(0);
    const lead = (await store.getLead("lead-real-1")) as HelixLead;
    expect(lead.aiTriage?.engine).toBe("heuristic");
    expect(lead.nextMove).toBeUndefined();
  });
});
