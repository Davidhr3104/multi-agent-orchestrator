import { afterEach, describe, expect, it, vi } from "vitest";
import { quoteIsInText, runTriagePipeline, triageLead } from "./lead-triage";
import { TRIAGE_MODEL } from "./anthropic";
import { claudeResponse, isolateSecrets, jsonResponse } from "./test-env";

const LEAD = {
  name: "Maya Chen",
  email: "maya@northwindhvac.com",
  company: "Northwind HVAC",
  source: "website form",
  message: "We need help scoring inbound HVAC quotes. Ready to start this month.",
  budget: "8500",
};

let restore: () => void;

afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

describe("triageLead", () => {
  it("uses the heuristic, labelled as such, when there is no key", async () => {
    restore = isolateSecrets();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result, triage } = await triageLead(LEAD);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.engine).toBe("heuristic");
    expect(triage.engine).toBe("heuristic");
    expect(triage.fallbackReason).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("takes Claude's classification and verifies each quote against the lead's text", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test" });
    const fetchMock = vi.fn(async () =>
      claudeResponse(
        JSON.stringify({
          classification: "lead",
          score: 88,
          confidence: 0.9,
          reasons: [
            { reason: "Clear timeline", quote: "Ready to start this month" },
            { reason: "Invented claim", quote: "We have 400 technicians" },
          ],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, triage } = await triageLead(LEAD);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.model).toBe(TRIAGE_MODEL);
    expect(body.messages[0].content).toContain("Ready to start this month");
    expect(result).toMatchObject({ engine: "claude", classification: "lead", score: 88, tier: "hot" });
    expect(triage.reasons[0].verified).toBe(true);
    expect(triage.reasons[1].verified).toBe(false);
    expect(result.reasoning).toContain('"Ready to start this month"');
    expect(result.reasoning).not.toContain("400 technicians");
  });

  it("falls back to the heuristic when Claude errors or returns junk", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "overloaded" } }, 529)));
    const failed = await triageLead(LEAD);
    expect(failed.triage.engine).toBe("heuristic");
    expect(failed.triage.fallbackReason).toContain("overloaded");

    vi.stubGlobal("fetch", vi.fn(async () => claudeResponse("not json at all")));
    const junk = await triageLead(LEAD);
    expect(junk.triage.engine).toBe("heuristic");
  });
});

describe("runTriagePipeline", () => {
  it("builds a stored lead carrying the triage record", async () => {
    restore = isolateSecrets();
    const events: string[] = [];
    const lead = await runTriagePipeline(LEAD, (e) => events.push(e.type));
    expect(lead.email).toBe(LEAD.email);
    expect(lead.crmStatus).toBe("not_sent");
    expect(lead.aiTriage?.engine).toBe("heuristic");
    expect(events).toContain("agent");
  });
});

describe("quoteIsInText", () => {
  it("ignores case, spacing and smart quotes, and rejects tiny quotes", () => {
    expect(quoteIsInText("ready  to START", "We are Ready to start now")).toBe(true);
    expect(quoteIsInText("we\u2019re in", "yes we're in")).toBe(true);
    expect(quoteIsInText("ab", "abc")).toBe(false);
  });
});
