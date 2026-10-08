import { describe, expect, it } from "vitest";
import type { AutomationRun, AutomationSpec } from "@helix/core/automations";
import { channelInfos } from "./catalog";
import { specToGraph } from "./graph";

const spec = (over: Partial<AutomationSpec> = {}): AutomationSpec => ({
  id: "auto-1",
  name: "Digest",
  origin: "user",
  status: "active",
  trigger: { kind: "daily", time: "21:00", tz: "America/Mexico_City" },
  steps: [
    { type: "source", node: "inbox.daily_digest" },
    { type: "send", channel: "slack" },
  ],
  createdBy: "chat",
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z",
  confirmedAt: "2026-10-06T00:00:00.000Z",
  missing: [],
  ...over,
});

const ready = channelInfos({ slack: true, twilio: true });
const none = channelInfos({ slack: false, twilio: false });

describe("specToGraph", () => {
  it("lays a routine out as trigger → data → send → record, chained", () => {
    const g = specToGraph(spec(), ready);
    expect(g.nodes.map((n) => n.kind)).toEqual(["Trigger", "Data", "Send", "History"]);
    expect(g.edges).toEqual([
      { from: "trigger", to: "step-0" },
      { from: "step-0", to: "step-1" },
      { from: "step-1", to: "record" },
    ]);
  });

  it("states the schedule and zone on the trigger", () => {
    const t = specToGraph(spec(), ready).nodes[0];
    expect(t.title).toBe("Every day at 9:00 pm");
    expect(t.subtitle).toBe("America/Mexico_City");
    expect(t.tone).toBeUndefined();
  });

  it("flags a missing time zone on the trigger with a way to fix it", () => {
    const t = specToGraph(spec({ trigger: { kind: "daily", time: "21:00", tz: "" } }), ready).nodes[0];
    expect(t.tone).toBe("warn");
    expect(t.chips?.map((c) => c.label)).toContain("Time zone missing");
    expect(t.action).toEqual({ label: "Set it", href: "#settings" });
  });

  it("marks a tool that is not connected, with the Connect link from the validator", () => {
    const send = specToGraph(spec(), none).nodes[2];
    expect(send.tone).toBe("warn");
    expect(send.chips?.map((c) => c.label)).toContain("Not connected");
    expect(send.action).toEqual({ label: "Connect", href: "/settings" });
  });

  it("shows a connected tool as connected, with no action", () => {
    const send = specToGraph(spec(), ready).nodes[2];
    expect(send.tone).toBeUndefined();
    expect(send.chips?.map((c) => c.label)).toContain("Connected");
    expect(send.action).toBeNull();
  });

  it("asks for the number on a phone channel that has none, and shows it when set", () => {
    const phone = spec({ steps: [{ type: "source", node: "inbox.daily_digest" }, { type: "send", channel: "whatsapp" }] });
    const missing = specToGraph(phone, ready).nodes[2];
    expect(missing.tone).toBe("warn");
    expect(missing.subtitle).toMatch(/number/i);
    const withNumber = spec({ steps: [{ type: "source", node: "inbox.daily_digest" }, { type: "send", channel: "whatsapp", to: "+5215512345678" }] });
    const ok = specToGraph(withNumber, ready).nodes[2];
    expect(ok.subtitle).toContain("+5215512345678");
    expect(ok.tone).toBeUndefined();
  });

  it("says where a failure goes on the steps that can fail", () => {
    const g = specToGraph(spec(), ready);
    expect(g.nodes[1].chips?.map((c) => c.label)).toEqual(["On success", "Fail → History"]);
  });

  it("reports the last run on the record node, in the person's words", () => {
    const run = (status: AutomationRun["status"], preview = false): AutomationRun => ({
      id: "r", automationId: "auto-1", key: "k", scheduledFor: null, startedAt: "x", finishedAt: "x", status, trigger: "manual", preview,
    });
    const label = (r?: AutomationRun) => specToGraph(spec(), ready, r).nodes[3].chips?.map((c) => c.label);
    expect(label()).toEqual(["No runs yet"]);
    expect(label(run("ok"))).toEqual(["Last run: sent"]);
    expect(label(run("ok", true))).toEqual(["Last run: preview"]);
    expect(label(run("failed"))).toEqual(["Last run: failed"]);
    expect(label(run("expired"))).toEqual(["Last run: missed"]);
  });

  it("handles a manual trigger", () => {
    const t = specToGraph(spec({ trigger: { kind: "manual" } }), ready).nodes[0];
    expect(t.title).toBe("Run on demand");
  });
});
