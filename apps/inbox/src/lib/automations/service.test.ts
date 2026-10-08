import { describe, expect, it } from "vitest";
import type { AutomationRun, AutomationSpec } from "@helix/core/automations";
import { validationContext, type DeskConnections } from "./catalog";
import { buildSpec, parseAutomationRequest } from "./parse";
import {
  MAX_DEMO_AUTOMATIONS,
  chatReply,
  confirmAutomation,
  createAutomation,
  describeSchedule,
  doneKeys,
  emptyState,
  recordRun,
  removeAutomation,
  setPaused,
  setRecipient,
  setTimezone,
} from "./service";

const now = new Date("2026-10-06T12:00:00.000Z");
const none: DeskConnections = { slack: false, twilio: false };
const all: DeskConnections = { slack: true, twilio: true };
const spec = (text: string, tz: string | null = "America/Mexico_City", id = "auto-1"): AutomationSpec => buildSpec(parseAutomationRequest(text)!, { tz, now, id });

describe("creating from chat tells the truth about status", () => {
  it("with everything in place and the person's confirmation it is active", () => {
    const ctx = validationContext(all, "America/Mexico_City");
    const r = createAutomation(emptyState(), spec("daily summary at 9pm on slack"), ctx, { confirm: true, now, limit: 4 });
    expect(r.spec.status).toBe("active");
    expect(r.spec.missing).toEqual([]);
    expect(r.spec.confirmedAt).toBe(now.toISOString());
  });

  it("without the connector it is a draft that lists exactly what is missing", () => {
    const ctx = validationContext(none, "America/Mexico_City");
    const r = createAutomation(emptyState(), spec("daily summary at 9pm on slack"), ctx, { confirm: true, now, limit: 4 });
    expect(r.spec.status).toBe("draft");
    expect(r.spec.missing).toEqual([{ kind: "connection", tool: "slack", label: "Slack", connectUrl: "/settings" }]);
  });

  it("without confirmation it is a draft even when everything is connected", () => {
    const ctx = validationContext(all, "America/Mexico_City");
    const r = createAutomation(emptyState(), spec("daily summary at 9pm on slack"), ctx, { confirm: false, now, limit: 4 });
    expect(r.spec.status).toBe("draft");
    expect(r.spec.confirmedAt).toBeNull();
  });

  it("a WhatsApp request with no timezone, no number and no Twilio lists all three", () => {
    const ctx = validationContext(none, null);
    const r = createAutomation(emptyState(), spec("daily summary at 9pm on whatsapp", null), ctx, { confirm: true, now, limit: 4 });
    expect(r.spec.status).toBe("draft");
    expect(r.spec.missing.map((m) => m.kind).sort()).toEqual(["connection", "recipient", "setting"]);
  });

  it("enforces the demo limit with an explicit error", () => {
    const ctx = validationContext(all, "UTC");
    let state = emptyState();
    for (let i = 0; i < MAX_DEMO_AUTOMATIONS; i++) state = createAutomation(state, spec("daily summary at 9pm on slack", "UTC", `auto-${i}`), ctx, { confirm: true, now, limit: MAX_DEMO_AUTOMATIONS }).state;
    expect(() => createAutomation(state, spec("daily summary at 9pm on slack", "UTC", "auto-x"), ctx, { confirm: true, now, limit: MAX_DEMO_AUTOMATIONS })).toThrow(/limit/i);
  });
});

describe("finishing a draft activates it only when it is truly ready", () => {
  it("saving the timezone, the number and connecting Twilio turns a confirmed draft active", () => {
    let state = emptyState();
    const ctx0 = validationContext(none, null);
    state = createAutomation(state, spec("daily summary at 9pm on whatsapp", null), ctx0, { confirm: true, now, limit: 4 }).state;
    expect(state.automations[0].status).toBe("draft");

    state = setTimezone(state, "America/Mexico_City", validationContext(none, "America/Mexico_City"), now);
    expect(state.timezone).toBe("America/Mexico_City");
    expect(state.automations[0].status).toBe("draft");

    state = setRecipient(state, "auto-1", "+52 1 55 1234 5678", validationContext(none, "America/Mexico_City"), now);
    expect(state.automations[0].status).toBe("draft");

    const ready = validationContext(all, "America/Mexico_City");
    state = setTimezone(state, "America/Mexico_City", ready, now);
    expect(state.automations[0].status).toBe("active");
    expect(state.automations[0].trigger).toMatchObject({ tz: "America/Mexico_City" });
    expect(state.automations[0].steps[1]).toMatchObject({ channel: "whatsapp", to: "+5215512345678" });
  });

  it("rejects a malformed recipient and a bad timezone with an error, never silently", () => {
    const ctx = validationContext(all, "UTC");
    let state = createAutomation(emptyState(), spec("daily summary at 9pm on whatsapp", "UTC"), ctx, { confirm: true, now, limit: 4 }).state;
    expect(() => setRecipient(state, "auto-1", "12345", ctx, now)).toThrow(/phone/i);
    expect(() => setTimezone(state, "Mars/Base", ctx, now)).toThrow(/time zone/i);
    state = setRecipient(state, "auto-1", "+14155550123", ctx, now);
    expect(state.automations[0].status).toBe("active");
  });

  it("confirming a ready draft activates it", () => {
    const ctx = validationContext(all, "UTC");
    let state = createAutomation(emptyState(), spec("daily summary at 9pm on slack", "UTC"), ctx, { confirm: false, now, limit: 4 }).state;
    state = confirmAutomation(state, "auto-1", ctx, now);
    expect(state.automations[0].status).toBe("active");
  });
});

describe("pause, resume, delete, history", () => {
  const ctx = validationContext(all, "UTC");
  const make = () => createAutomation(emptyState(), spec("daily summary at 9pm on slack", "UTC"), ctx, { confirm: true, now, limit: 4 }).state;

  it("pause keeps it paused and resume re-validates", () => {
    let state = setPaused(make(), "auto-1", true, ctx, now);
    expect(state.automations[0].status).toBe("paused");
    state = setPaused(state, "auto-1", false, ctx, now);
    expect(state.automations[0].status).toBe("active");
  });

  it("resuming after the connector disappeared leaves a draft that says why", () => {
    let state = setPaused(make(), "auto-1", true, ctx, now);
    state = setPaused(state, "auto-1", false, validationContext(none, "UTC"), now);
    expect(state.automations[0].status).toBe("draft");
    expect(state.automations[0].missing[0]).toMatchObject({ kind: "connection", tool: "slack" });
  });

  it("deleting an unknown id is an error, not a no-op", () => {
    expect(() => removeAutomation(make(), "nope")).toThrow(/not found/i);
    expect(removeAutomation(make(), "auto-1").automations).toEqual([]);
  });

  it("history keeps the newest runs and exposes the idempotency keys", () => {
    const run = (n: number): AutomationRun => ({
      id: `r${n}`, automationId: "auto-1", key: `auto-1@${n}`, scheduledFor: `${n}`, startedAt: "x", finishedAt: "x",
      status: "ok", trigger: "schedule", preview: false,
    });
    let state = make();
    for (let i = 0; i < 30; i++) state = recordRun(state, run(i));
    expect(state.runs).toHaveLength(20);
    expect(state.runs[0].id).toBe("r29");
    expect(doneKeys(state).has("auto-1@29")).toBe(true);
    expect(doneKeys(state).has("auto-1@0")).toBe(false);
  });
});

describe("chat wording is derived from the facts", () => {
  it("an active automation says exactly what it sends and when", () => {
    const ctx = validationContext(all, "America/Mexico_City");
    const r = createAutomation(emptyState(), spec("daily summary at 9pm on slack"), ctx, { confirm: true, now, limit: 4 });
    const text = chatReply(r.spec, r.validation);
    expect(text).toContain("active");
    expect(text).toContain("9:00 pm");
    expect(text).toContain("Slack");
    expect(text).toContain("threads received in the last 24 hours");
    expect(text).toContain("/automations");
  });

  it("a draft never says it is active and lists each missing thing with its link", () => {
    const ctx = validationContext(none, null);
    const r = createAutomation(emptyState(), spec("daily summary at 9pm on whatsapp", null), ctx, { confirm: true, now, limit: 4 });
    const text = chatReply(r.spec, r.validation);
    expect(text).not.toMatch(/is active|it's active|now active/i);
    expect(text).toContain("not active yet");
    expect(text).toContain("Connect WhatsApp (Twilio)");
    expect(text).toContain("](/settings)");
    expect(text).toMatch(/time zone/i);
    expect(text).toMatch(/number/i);
  });

  it("describes the schedule in 12h with the zone", () => {
    expect(describeSchedule({ kind: "daily", time: "21:00", tz: "America/Mexico_City" })).toBe("every day at 9:00 pm (America/Mexico_City)");
    expect(describeSchedule({ kind: "daily", time: "00:05", tz: "UTC" })).toBe("every day at 12:05 am (UTC)");
    expect(describeSchedule({ kind: "daily", time: "09:30", tz: "" })).toBe("every day at 9:30 am (time zone not set)");
    expect(describeSchedule({ kind: "manual" })).toBe("when you run it");
  });
});
