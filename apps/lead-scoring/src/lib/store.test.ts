import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredLead } from "@helix/core";

const ENV_KEYS = ["HELIX_DESK_SEED", "GHL_API_KEY", "GHL_LOCATION_ID"] as const;
const saved: Record<string, string | undefined> = {};

function realLead(id: string, name = "Real Customer"): StoredLead {
  return {
    id,
    name,
    email: `${id}@client.com`,
    classification: "lead",
    score: 80,
    tier: "hot",
    confidence: 0.9,
    reasoning: "",
    fields: [],
    needsReview: false,
    engine: "heuristic",
    createdAt: new Date().toISOString(),
    runId: "r",
    crmStatus: "not_sent",
    source: "web",
    message: "",
    pipelineStage: "new",
  } as StoredLead;
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.doUnmock("./supabase-leads");
});

/** Loads a fresh store, optionally pretending Supabase is configured with per-org rows. */
async function loadStore(remote?: Record<string, StoredLead[]>) {
  const upsert = vi.fn(async () => undefined);
  if (remote) {
    vi.doMock("./supabase-leads", () => ({
      isSupabaseConfigured: () => true,
      supabaseListLeads: async (orgId: string) => remote[orgId] ?? [],
      supabaseUpsertLead: upsert,
    }));
  } else {
    vi.doMock("./supabase-leads", () => ({
      isSupabaseConfigured: () => false,
      supabaseListLeads: async () => null,
      supabaseUpsertLead: upsert,
    }));
  }
  const store = await import("./store");
  return { store, upsert };
}

describe("desk mode without any integration (local / fresh deployment)", () => {
  it("shows the demo leads on first open", async () => {
    const { store } = await loadStore();
    const leads = await store.listLeads();
    expect(leads.length).toBeGreaterThanOrEqual(5);
    expect(leads.every((l) => l.id.startsWith("seed-"))).toBe(true);
    expect((await store.deskStatus()).mode).toBe("demo");
  });

  it("stays empty and live when demo is turned off", async () => {
    process.env.HELIX_DESK_SEED = "off";
    const { store } = await loadStore();
    expect(await store.listLeads()).toEqual([]);
    expect((await store.deskStatus()).mode).toBe("live");
  });

  it("stores a real intake lead outside the demo sandbox and flips the desk to live", async () => {
    const { store } = await loadStore();
    expect((await store.deskStatus()).mode).toBe("demo");
    await store.saveLead(realLead("lead-intake-1", "Form Visitor"), undefined, { real: true });
    const leads = await store.listLeads();
    expect(leads.map((l) => l.id)).toEqual(["lead-intake-1"]);
    expect((await store.deskStatus()).mode).toBe("live");
  });

  it("switches to live, with no demo leads, once the CRM is connected", async () => {
    process.env.GHL_API_KEY = "k";
    process.env.GHL_LOCATION_ID = "loc";
    const { store } = await loadStore();
    expect(await store.listLeads()).toEqual([]);
    expect((await store.deskStatus()).connected).toBe(true);
  });
});

describe("multi-tenant deployment (Supabase configured)", () => {
  it("gives a guest only the demo sandbox — never another tenant's leads", async () => {
    const { store } = await loadStore({ org1: [realLead("real-1", "Secret Customer")] });
    // A signed-in member loads their real data first, which warms the shared caches.
    await store.listLeads("org1");

    const guest = await store.listLeads(undefined);
    expect(guest.map((l) => l.name)).not.toContain("Secret Customer");
    expect(guest.every((l) => l.id.startsWith("seed-"))).toBe(true);
    expect(await store.getLead("real-1", undefined)).toBeNull();
  });

  it("shows an org with real leads only its own data, with no demo records mixed in", async () => {
    const { store } = await loadStore({ org1: [realLead("real-1")] });
    const leads = await store.listLeads("org1");
    expect(leads.map((l) => l.id)).toEqual(["real-1"]);
    expect((await store.deskStatus("org1")).mode).toBe("live");
  });

  it("shows demo data to an org that has nothing yet", async () => {
    const { store } = await loadStore({ org2: [] });
    const leads = await store.listLeads("org2");
    expect(leads.every((l) => l.id.startsWith("seed-"))).toBe(true);
    expect((await store.deskStatus("org2")).mode).toBe("demo");
  });

  it("never writes demo-mode changes to Supabase", async () => {
    const { store, upsert } = await loadStore({ org2: [] });
    const [first] = await store.listLeads("org2");
    await store.patchLead(first.id, { pipelineStage: "contacted" }, "org2");
    expect(upsert).not.toHaveBeenCalled();
    expect((await store.getLead(first.id, "org2"))?.pipelineStage).toBe("contacted");
  });

  it("does write real changes to Supabase for a live org", async () => {
    const { store, upsert } = await loadStore({ org1: [realLead("real-1")] });
    await store.listLeads("org1");
    await store.patchLead("real-1", { pipelineStage: "contacted" }, "org1");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
