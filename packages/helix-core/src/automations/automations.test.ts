import { describe, expect, it } from "vitest";
import { dueRun, isValidTimeZone, lastDailyRun, nextDailyRun, parseClock, runKey } from "./schedule";
import { deriveStatus, validateSpec, type ValidationContext } from "./validate";
import type { AutomationSpec } from "./types";

const base: AutomationSpec = {
  id: "auto-1",
  name: "Daily digest",
  origin: "user",
  status: "draft",
  trigger: { kind: "daily", time: "21:00", tz: "America/Mexico_City" },
  steps: [
    { type: "source", node: "inbox.daily_digest" },
    { type: "send", channel: "whatsapp", to: "+5215512345678" },
  ],
  createdBy: "chat",
  createdAt: "2026-10-06T12:00:00.000Z",
  updatedAt: "2026-10-06T12:00:00.000Z",
  confirmedAt: null,
  missing: [],
};

const ctx = (over: Partial<ValidationContext> = {}): ValidationContext => ({
  nodes: { "inbox.daily_digest": { kind: "source", label: "Daily digest" } },
  channels: {
    whatsapp: { tool: "twilio", label: "WhatsApp (Twilio)", connected: true, connectUrl: "/settings#keys", needsRecipient: true },
    slack: { tool: "slack", label: "Slack", connected: false, connectUrl: "/integrations", needsRecipient: false },
    in_app: { tool: "helix", label: "In-app", connected: true, connectUrl: "/automations", needsRecipient: false },
  },
  settings: { timezone: "America/Mexico_City" },
  ...over,
});

describe("clock + timezone parsing", () => {
  it("parses HH:MM and rejects nonsense", () => {
    expect(parseClock("21:00")).toEqual({ hour: 21, minute: 0 });
    expect(parseClock("07:05")).toEqual({ hour: 7, minute: 5 });
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("9pm")).toBeNull();
    expect(parseClock("21:60")).toBeNull();
  });
  it("accepts IANA zones only", () => {
    expect(isValidTimeZone("America/Mexico_City")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("daily schedule", () => {
  // Mexico City is UTC-6 all year since 2022 (no DST).
  it("next 9pm local is today when it is still earlier than 9pm", () => {
    const now = new Date("2026-10-06T18:00:00.000Z"); // 12:00 local
    expect(nextDailyRun("21:00", "America/Mexico_City", now).toISOString()).toBe("2026-10-07T03:00:00.000Z");
  });
  it("next 9pm local is tomorrow once 9pm has passed", () => {
    const now = new Date("2026-10-07T04:00:00.000Z"); // 22:00 local on Oct 6
    expect(nextDailyRun("21:00", "America/Mexico_City", now).toISOString()).toBe("2026-10-08T03:00:00.000Z");
  });
  it("the last scheduled run is the most recent 9pm at or before now", () => {
    const now = new Date("2026-10-07T04:00:00.000Z");
    expect(lastDailyRun("21:00", "America/Mexico_City", now).toISOString()).toBe("2026-10-07T03:00:00.000Z");
  });
  it("respects daylight saving: 09:00 New York is 13:00Z in summer and 14:00Z in winter", () => {
    expect(nextDailyRun("09:00", "America/New_York", new Date("2026-07-01T00:00:00Z")).toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(nextDailyRun("09:00", "America/New_York", new Date("2026-12-01T00:00:00Z")).toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });
});

describe("dueRun (idempotent scheduling)", () => {
  const spec = { ...base, status: "active" as const };
  it("is due right after the scheduled time and carries a stable key", () => {
    const now = new Date("2026-10-07T03:02:00.000Z");
    const d = dueRun(spec, new Set(), now);
    expect(d?.state).toBe("due");
    expect(d?.key).toBe(runKey(spec.id, "2026-10-07T03:00:00.000Z"));
  });
  it("is not due again once that key already ran (no double send)", () => {
    const now = new Date("2026-10-07T03:02:00.000Z");
    const key = runKey(spec.id, "2026-10-07T03:00:00.000Z");
    expect(dueRun(spec, new Set([key]), now)).toBeNull();
  });
  it("marks a run that was missed by more than the catch-up window as expired, never sends it late", () => {
    const now = new Date("2026-10-07T09:00:00.000Z"); // 6h after
    expect(dueRun(spec, new Set(), now, 3 * 3_600_000)?.state).toBe("expired");
  });
  it("ignores paused and draft automations", () => {
    const now = new Date("2026-10-07T03:02:00.000Z");
    expect(dueRun({ ...spec, status: "paused" }, new Set(), now)).toBeNull();
    expect(dueRun({ ...spec, status: "draft" }, new Set(), now)).toBeNull();
  });
  it("ignores manual triggers", () => {
    const now = new Date("2026-10-07T03:02:00.000Z");
    expect(dueRun({ ...spec, trigger: { kind: "manual" } }, new Set(), now)).toBeNull();
  });
});

describe("validateSpec", () => {
  it("is ok when every node, channel, recipient and the timezone are in place", () => {
    const v = validateSpec(base, ctx());
    expect(v.errors).toEqual([]);
    expect(v.missing).toEqual([]);
    expect(v.ok).toBe(true);
  });
  it("reports an unknown node as a hard error, not as something to connect", () => {
    const v = validateSpec({ ...base, steps: [{ type: "source", node: "inbox.nope" }, base.steps[1]] }, ctx());
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toMatch(/inbox\.nope/);
  });
  it("lists a disconnected channel with the link that connects it", () => {
    const spec = { ...base, steps: [base.steps[0], { type: "send" as const, channel: "slack" as const }] };
    const v = validateSpec(spec, ctx());
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual([{ kind: "connection", tool: "slack", label: "Slack", connectUrl: "/integrations" }]);
  });
  it("asks for the recipient when a phone channel has none", () => {
    const spec = { ...base, steps: [base.steps[0], { type: "send" as const, channel: "whatsapp" as const }] };
    const v = validateSpec(spec, ctx());
    expect(v.missing.map((m) => m.kind)).toEqual(["recipient"]);
  });
  it("rejects a recipient that is not an E.164 phone number", () => {
    const spec = { ...base, steps: [base.steps[0], { type: "send" as const, channel: "whatsapp" as const, to: "5512345678" }] };
    const v = validateSpec(spec, ctx());
    expect(v.missing.map((m) => m.kind)).toEqual(["recipient"]);
  });
  it("needs a timezone for a daily trigger and rejects an invalid one", () => {
    const noTz = validateSpec(base, ctx({ settings: { timezone: null } }));
    expect(noTz.missing.map((m) => m.kind)).toEqual(["setting"]);
    const bad = validateSpec({ ...base, trigger: { kind: "daily", time: "21:00", tz: "" } }, ctx({ settings: { timezone: "Nowhere/Land" } }));
    expect(bad.missing.map((m) => m.kind)).toEqual(["setting"]);
  });
  it("rejects a malformed time of day", () => {
    const v = validateSpec({ ...base, trigger: { kind: "daily", time: "9pm", tz: "UTC" } }, ctx());
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toMatch(/time/i);
  });
  it("requires at least one source and one send step", () => {
    expect(validateSpec({ ...base, steps: [base.steps[0]] }, ctx()).errors.join(" ")).toMatch(/send/i);
    expect(validateSpec({ ...base, steps: [base.steps[1]] }, ctx()).errors.join(" ")).toMatch(/source/i);
  });
  it("collects every missing item at once, once each", () => {
    const spec = { ...base, steps: [base.steps[0], { type: "send" as const, channel: "slack" as const }, { type: "send" as const, channel: "slack" as const }] };
    const v = validateSpec(spec, ctx({ settings: { timezone: null } }));
    expect(v.missing.map((m) => m.kind).sort()).toEqual(["connection", "setting"]);
  });
});

describe("deriveStatus (Helix never says active when it is not)", () => {
  it("is active only when the validation is clean and the user confirmed", () => {
    expect(deriveStatus("active", validateSpec(base, ctx()), true)).toBe("active");
  });
  it("is draft when anything is missing", () => {
    const spec = { ...base, steps: [base.steps[0], { type: "send" as const, channel: "slack" as const }] };
    expect(deriveStatus("active", validateSpec(spec, ctx()), true)).toBe("draft");
  });
  it("is draft when the user has not confirmed, even if everything is ready", () => {
    expect(deriveStatus("active", validateSpec(base, ctx()), false)).toBe("draft");
  });
  it("keeps paused when asked to pause", () => {
    expect(deriveStatus("paused", validateSpec(base, ctx()), true)).toBe("paused");
  });
});
