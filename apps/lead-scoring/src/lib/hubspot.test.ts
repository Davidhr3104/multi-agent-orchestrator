import { afterEach, describe, expect, it, vi } from "vitest";
import { upsertHubspotContact } from "./hubspot";
import { isolateSecrets, jsonResponse } from "./test-env";

const LEAD = { name: "Maya Chen", email: "maya@northwindhvac.com", phone: "+1 555 0100", company: "Northwind" };

let restore: () => void;

afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

type Call = [string, RequestInit];

describe("upsertHubspotContact", () => {
  it("does nothing and reports mocked without HUBSPOT_TOKEN", async () => {
    restore = isolateSecrets();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await upsertHubspotContact(LEAD);
    expect(res).toMatchObject({ ok: false, mocked: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates an existing contact addressed by email", async () => {
    restore = isolateSecrets({ HUBSPOT_TOKEN: "pat-test" });
    const fetchMock = vi.fn(async () => jsonResponse({ id: "101" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await upsertHubspotContact(LEAD);
    expect(res).toEqual({ ok: true, contactId: "101", created: false });
    const [url, init] = fetchMock.mock.calls[0] as unknown as Call;
    expect(url).toBe(
      "https://api.hubapi.com/crm/v3/objects/contacts/maya%40northwindhvac.com?idProperty=email"
    );
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pat-test");
    expect(JSON.parse(String(init.body)).properties).toEqual({
      email: "maya@northwindhvac.com",
      firstname: "Maya",
      lastname: "Chen",
      phone: "+1 555 0100",
      company: "Northwind",
    });
  });

  it("creates the contact when the email is not in HubSpot yet", async () => {
    restore = isolateSecrets({ HUBSPOT_TOKEN: "pat-test" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "resource not found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ id: "202" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const res = await upsertHubspotContact(LEAD);
    expect(res).toEqual({ ok: true, contactId: "202", created: true });
    const [url, init] = fetchMock.mock.calls[1] as unknown as Call;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(init.method).toBe("POST");
  });

  it("surfaces HubSpot errors instead of claiming a sync", async () => {
    restore = isolateSecrets({ HUBSPOT_TOKEN: "bad" });
    const fetchMock = vi.fn(async () => jsonResponse({ message: "Authentication credentials not found" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const res = await upsertHubspotContact(LEAD);
    expect(res).toMatchObject({ ok: false, status: 401, error: "Authentication credentials not found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a network failure as not synced", async () => {
    restore = isolateSecrets({ HUBSPOT_TOKEN: "pat-test" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNRESET"))));
    const res = await upsertHubspotContact(LEAD);
    expect(res).toMatchObject({ ok: false, error: "ECONNRESET" });
  });
});
