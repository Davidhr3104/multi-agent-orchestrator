import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleExecuteBody } from "@helix/core";
import { realEstateActions } from "./ai-actions";
import { upsertHubspotContact } from "./hubspot";
import { channelReady, sendEmailResend, sendTwilio, toE164 } from "./messaging";
import { sendApprovedDraft } from "./outreach-send";
import { getLead, listDrafts, loadDemoCatalog } from "./store";

const ENV = ["RESEND_API_KEY", "RESEND_FROM", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "TWILIO_WHATSAPP_FROM", "HUBSPOT_TOKEN"];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
type Call = [string, RequestInit];

beforeEach(() => {
  process.env.HELIX_SECRETS_PATH = "__no_such_file__.json";
  for (const k of ENV) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV) delete process.env[k];
});

describe("Resend adapter", () => {
  it("does nothing without credentials", async () => {
    const f = vi.fn();
    const r = await sendEmailResend({ to: "a@b.co", subject: "s", text: "t" }, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, notConfigured: true });
    expect(f).not.toHaveBeenCalled();
    expect(channelReady("email")).toBe(false);
  });

  it("posts the email and reports the provider id", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "Agent <agent@agency.test>";
    const f = vi.fn(async () => json({ id: "email_123" }));
    const r = await sendEmailResend({ to: "buyer@x.test", subject: "Hello", text: "Body" }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, provider: "resend", providerId: "email_123" });
    const [url, init] = f.mock.calls[0] as unknown as Call;
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(String(init.body))).toEqual({ from: "Agent <agent@agency.test>", to: ["buyer@x.test"], subject: "Hello", text: "Body" });
  });

  it("does not claim success when Resend refuses", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@agency.test";
    const f = vi.fn(async () => json({ message: "Domain not verified" }, 403));
    const r = await sendEmailResend({ to: "buyer@x.test", subject: "Hello", text: "Body" }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, error: "Resend refused the email (403): Domain not verified." });
  });
});

describe("Twilio adapter", () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM = "+15550001111";
  });

  it("normalises phone numbers to E.164", () => {
    expect(toE164("+1 555 010 0101")).toBe("+15550100101");
    expect(toE164("0034 600 123 456")).toBe("+34600123456");
    expect(toE164("555 0101")).toBeNull();
  });

  it("sends an SMS with basic auth and form encoding", async () => {
    const f = vi.fn(async () => json({ sid: "SM123", status: "queued" }, 201));
    const r = await sendTwilio({ to: "+1 555 010 0101", body: "Hi", channel: "sms" }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, provider: "twilio", providerId: "SM123" });
    const [url, init] = f.mock.calls[0] as unknown as Call;
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("AC_test:tok").toString("base64")}`);
    const form = new URLSearchParams(String(init.body));
    expect(form.get("To")).toBe("+15550100101");
    expect(form.get("From")).toBe("+15550001111");
    expect(form.get("Body")).toBe("Hi");
  });

  it("prefixes both ends for WhatsApp and prefers TWILIO_WHATSAPP_FROM", async () => {
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    const f = vi.fn(async () => json({ sid: "SM9" }, 201));
    await sendTwilio({ to: "+15550100101", body: "Hi", channel: "whatsapp" }, f as unknown as typeof fetch);
    const form = new URLSearchParams(String((f.mock.calls[0] as unknown as Call)[1].body));
    expect(form.get("To")).toBe("whatsapp:+15550100101");
    expect(form.get("From")).toBe("whatsapp:+14155238886");
  });

  it("rejects a number without a country code before calling Twilio", async () => {
    const f = vi.fn();
    const r = await sendTwilio({ to: "555 010 0101", body: "Hi", channel: "sms" }, f as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("sending an approved draft", () => {
  async function approvedDraftId() {
    await loadDemoCatalog();
    await handleExecuteBody(realEstateActions, { action: "draft_match_alerts", targetIds: ["prop-riverside-loft"] }, { actor: "You" });
    const d = (await listDrafts()).find((x) => x.leadId === "lead-ana-torres")!;
    return d.id;
  }

  it("refuses without explicit confirmation, and refuses a draft that isn't approved", async () => {
    const id = await approvedDraftId();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@agency.test";
    const f = vi.fn(async () => json({ id: "email_1" }));
    const noConfirm = await sendApprovedDraft({ draftId: id, channel: "email", confirm: "yes", actor: "You", fetchImpl: f as unknown as typeof fetch });
    expect(noConfirm.status).toBe(400);
    const pending = await sendApprovedDraft({ draftId: id, channel: "email", confirm: true, actor: "You", fetchImpl: f as unknown as typeof fetch });
    expect(pending.status).toBe(409);
    expect(pending.body.error).toMatch(/Approve the draft/);
    expect(f).not.toHaveBeenCalled();
  });

  it("without credentials says it was not sent", async () => {
    const id = await approvedDraftId();
    await handleExecuteBody(realEstateActions, { action: "approve_draft", targetIds: [id] }, { actor: "You" });
    const f = vi.fn();
    const r = await sendApprovedDraft({ draftId: id, channel: "whatsapp", confirm: true, actor: "You", fetchImpl: f as unknown as typeof fetch });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ sent: false, notConfigured: true });
    expect(String(r.body.error)).toMatch(/^Not sent/);
    expect(f).not.toHaveBeenCalled();
  });

  it("sends once when approved and confirmed, records the delivery, and blocks a duplicate", async () => {
    const id = await approvedDraftId();
    await handleExecuteBody(realEstateActions, { action: "approve_draft", targetIds: [id] }, { actor: "You" });
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@agency.test";
    const f = vi.fn(async () => json({ id: "email_42" }));
    const r = await sendApprovedDraft({ draftId: id, channel: "email", confirm: true, actor: "You", fetchImpl: f as unknown as typeof fetch });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sent: true, provider: "resend", providerId: "email_42", to: "ana.torres@example.com" });
    const d = (await listDrafts()).find((x) => x.id === id)!;
    expect(d.deliveries?.[0]).toMatchObject({ channel: "email", providerId: "email_42", by: "You" });
    expect((await getLead("lead-ana-torres"))?.lastContactAt).toBeDefined();
    const dup = await sendApprovedDraft({ draftId: id, channel: "email", confirm: true, actor: "You", fetchImpl: f as unknown as typeof fetch });
    expect(dup.status).toBe(409);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("records nothing when the provider fails", async () => {
    const id = await approvedDraftId();
    await handleExecuteBody(realEstateActions, { action: "approve_draft", targetIds: [id] }, { actor: "You" });
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@agency.test";
    const f = vi.fn(async () => json({ message: "rate limited" }, 429));
    const r = await sendApprovedDraft({ draftId: id, channel: "email", confirm: true, actor: "You", fetchImpl: f as unknown as typeof fetch });
    expect(r.status).toBe(502);
    expect(r.body.sent).toBe(false);
    expect((await listDrafts()).find((x) => x.id === id)?.deliveries).toBeUndefined();
  });
});

describe("HubSpot adapter", () => {
  it("upserts the contact by email", async () => {
    await loadDemoCatalog();
    const lead = (await getLead("lead-ana-torres"))!;
    expect(await upsertHubspotContact(lead, vi.fn() as unknown as typeof fetch)).toMatchObject({ ok: false, notConfigured: true });
    process.env.HUBSPOT_TOKEN = "pat-test";
    const f = vi.fn(async () => json({ status: "COMPLETE", results: [{ id: "901", new: true }] }));
    const r = await upsertHubspotContact(lead, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, contactId: "901", created: true });
    const [url, init] = f.mock.calls[0] as unknown as Call;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
    expect(JSON.parse(String(init.body))).toEqual({
      inputs: [{ idProperty: "email", id: "ana.torres@example.com", properties: { email: "ana.torres@example.com", firstname: "Ana", lastname: "Torres", phone: "+1 555 010 0101" } }],
    });
  });
});
