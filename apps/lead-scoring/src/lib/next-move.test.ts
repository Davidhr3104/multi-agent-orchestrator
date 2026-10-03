import { afterEach, describe, expect, it, vi } from "vitest";
import { draftNextMove } from "./next-move";
import { DRAFT_MODEL } from "./anthropic";
import type { HelixLead } from "./lead-ai";
import { claudeResponse, isolateSecrets } from "./test-env";

const LEAD = {
  id: "lead-1",
  name: "Maya Chen",
  email: "maya@northwindhvac.com",
  source: "website",
  message: "Ready to start this month if it plugs into our CRM.",
  classification: "lead",
  score: 88,
  tier: "hot",
  confidence: 0.9,
  reasoning: "",
  fields: [],
  needsReview: false,
  engine: "claude",
  createdAt: new Date().toISOString(),
  runId: "r",
  crmStatus: "not_sent",
} as HelixLead;

let restore: () => void;

afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

describe("draftNextMove", () => {
  it("refuses to fake a draft without a key", async () => {
    restore = isolateSecrets();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await draftNextMove(LEAD, "operator");
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a draft built from the lead's own data", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test" });
    const fetchMock = vi.fn(async () =>
      claudeResponse(
        JSON.stringify({
          action: "Email Maya",
          channel: "email",
          subject: "Starting this month",
          message: "Hi Maya, you said you are ready to start this month.",
          rationale: "She wrote 'Ready to start this month'.",
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await draftNextMove(LEAD, "operator");
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.model).toBe(DRAFT_MODEL);
    expect(body.messages[0].content).toContain("Ready to start this month");
    expect(res).toMatchObject({ ok: true, draft: { status: "draft", channel: "email", action: "Email Maya" } });
  });
});
