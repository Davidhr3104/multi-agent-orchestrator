import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTwilioConfigured, normalizePhone, sendTwilioMessage, twilioStatus } from "./twilio";

beforeEach(() => {
  vi.stubEnv("HELIX_SECRETS_PATH", "./.no-secrets-in-tests.json");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "");
  vi.stubEnv("TWILIO_FROM", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configure() {
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret-token");
  vi.stubEnv("TWILIO_FROM", "+15550001111");
}

describe("Twilio adapter", () => {
  it("reports not connected and never calls the network without all three variables", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
    expect(isTwilioConfigured()).toBe(false);
    expect(twilioStatus()).toEqual({ configured: false, from: null });
    const r = await sendTwilioMessage({ to: "+5215512345678", body: "hi", channel: "sms" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/not connected/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts an SMS to the Messages API with basic auth", async () => {
    configure();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "SM123", status: "queued" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendTwilioMessage({ to: "+52 1 55 1234 5678", body: "Confirmed for Tue 10:00", channel: "sms" });
    expect(r).toEqual({ ok: true, sid: "SM123", status: "queued", channel: "sms", to: "+5215512345678" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("ACtest:secret-token").toString("base64")}`);
    const form = new URLSearchParams(String(init.body));
    expect(form.get("To")).toBe("+5215512345678");
    expect(form.get("From")).toBe("+15550001111");
    expect(form.get("Body")).toBe("Confirmed for Tue 10:00");
  });

  it("prefixes both numbers with whatsapp: for WhatsApp", async () => {
    configure();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "SM9", status: "queued" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTwilioMessage({ to: "+5215512345678", body: "Hola", channel: "whatsapp" });
    const form = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(form.get("To")).toBe("whatsapp:+5215512345678");
    expect(form.get("From")).toBe("whatsapp:+15550001111");
  });

  it("rejects a bad number before calling Twilio and surfaces Twilio's own error", async () => {
    configure();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "The 'To' number is not a valid phone number.", code: 21211 }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const bad = await sendTwilioMessage({ to: "55-1234", body: "x", channel: "sms" });
    expect(!bad.ok && bad.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    const rejected = await sendTwilioMessage({ to: "+15005550001", body: "x", channel: "sms" });
    expect(!rejected.ok && rejected.error).toMatch(/not a valid phone number/);
  });

  it("normalizes phone formats to E.164", () => {
    expect(normalizePhone("whatsapp:+1 (555) 000-1111")).toBe("+15550001111");
    expect(normalizePhone("5550001111")).toBeNull();
  });
});
