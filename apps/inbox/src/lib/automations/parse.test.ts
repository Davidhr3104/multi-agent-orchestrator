import { describe, expect, it } from "vitest";
import { buildSpec, parseAutomationRequest } from "./parse";

describe("parseAutomationRequest", () => {
  it("understands the canonical sentence", () => {
    const p = parseAutomationRequest("Helix, send me a summary of my inbox every day at 9pm on WhatsApp");
    expect(p).toMatchObject({ source: "inbox.daily_digest", channel: "whatsapp", time: "21:00" });
  });
  it("handles am/pm, minutes and 24h clocks", () => {
    expect(parseAutomationRequest("send me a daily summary at 9:30 am")).toMatchObject({ time: "09:30" });
    expect(parseAutomationRequest("daily summary at 12am")).toMatchObject({ time: "00:00" });
    expect(parseAutomationRequest("daily summary at 12pm")).toMatchObject({ time: "12:00" });
    expect(parseAutomationRequest("daily summary at 18:45")).toMatchObject({ time: "18:45" });
  });
  it("understands Spanish", () => {
    const p = parseAutomationRequest("mándame un resumen del correo todos los días a las 9 pm por whatsapp");
    expect(p).toMatchObject({ source: "inbox.daily_digest", channel: "whatsapp", time: "21:00" });
  });
  it("picks the SLA source for breach requests", () => {
    expect(parseAutomationRequest("every day at 8am tell me which threads breached their SLA on slack")).toMatchObject({ source: "inbox.sla_breaches", channel: "slack", time: "08:00" });
  });
  it("defaults the channel to in-app and says so, never guesses an external one", () => {
    const p = parseAutomationRequest("send me a daily summary at 7pm");
    expect(p?.channel).toBe("in_app");
    expect(p?.channelWasDefault).toBe(true);
  });
  it("does not invent a time: it reports it as missing", () => {
    const p = parseAutomationRequest("send me a summary every day on slack");
    expect(p).not.toBeNull();
    expect(p?.time).toBeNull();
  });
  it("extracts a phone number as E.164", () => {
    const p = parseAutomationRequest("daily summary at 9pm to whatsapp +52 1 55 1234 5678");
    expect(p?.to).toBe("+5215512345678");
  });
  it("ignores ordinary questions and commands", () => {
    expect(parseAutomationRequest("what is urgent?")).toBeNull();
    expect(parseAutomationRequest("archive the HVAC newsletter")).toBeNull();
    expect(parseAutomationRequest("send Maya Chen the reply")).toBeNull();
    expect(parseAutomationRequest("summarize my inbox")).toBeNull();
  });
});

describe("buildSpec", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  it("always starts as an unconfirmed draft with the settings timezone", () => {
    const p = parseAutomationRequest("daily summary at 9pm on slack")!;
    const spec = buildSpec(p, { tz: "America/Mexico_City", now, id: "auto-test" });
    expect(spec).toMatchObject({
      id: "auto-test",
      origin: "user",
      status: "draft",
      createdBy: "chat",
      confirmedAt: null,
      trigger: { kind: "daily", time: "21:00", tz: "America/Mexico_City" },
    });
    expect(spec.steps).toEqual([{ type: "source", node: "inbox.daily_digest" }, { type: "send", channel: "slack" }]);
  });
  it("leaves the timezone blank (so validation asks for it) when none is saved", () => {
    const p = parseAutomationRequest("daily summary at 9pm on slack")!;
    expect(buildSpec(p, { tz: null, now, id: "x" }).trigger).toMatchObject({ tz: "" });
  });
  it("throws if there is no time, because a spec without one is meaningless", () => {
    const p = parseAutomationRequest("send me a summary every day on slack")!;
    expect(() => buildSpec(p, { tz: "UTC", now, id: "x" })).toThrow(/time/i);
  });
});
