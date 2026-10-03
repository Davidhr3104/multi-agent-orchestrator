import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inventedNumbers } from "./ai-claude";
import { factCheck, listingFacts, writeListingCopy, writeMatchAlert } from "./ai-copy";
import { aiUsageTotals, estimateUsd, resetAiUsage } from "./ai-usage";
import { writeMarketBrief } from "./market-brief";
import { getLead, getProperty, loadDemoCatalog } from "./store";
import type { UsMarket } from "./us-market";

const claudeReply = (text: string, input = 1200, output = 300) =>
  vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: input, output_tokens: output } }), { status: 200 }));
const asFetch = (f: unknown) => f as typeof fetch;

beforeEach(async () => {
  process.env.HELIX_SECRETS_PATH = "__no_such_file__.json";
  delete process.env.ANTHROPIC_API_KEY;
  resetAiUsage();
  await loadDemoCatalog();
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("fact check", () => {
  it("accepts figures from the facts, including shorthands, and flags invented ones", () => {
    const facts = "Asking price: $485,000\nBedrooms: 2\nSize: 98 m²";
    expect(inventedNumbers("Offered at $485k with 2 bedrooms and 98 m²", facts)).toEqual([]);
    expect(inventedNumbers("Only 5 minutes from the metro, 3 parking spots", facts)).toEqual([5, 3]);
  });

  it("flags features the listing doesn't have", () => {
    expect(factCheck("Enjoy the pool and the gym", "Amenities: Gym")).toMatch(/features .*pool/);
    expect(factCheck("A gym in the building", "Amenities: Gym")).toBeNull();
  });
});

describe("listing copy", () => {
  it("uses the labelled template without a key and never calls Claude", async () => {
    const p = (await getProperty("prop-riverside-loft"))!;
    const f = vi.fn();
    const r = await writeListingCopy(p, asFetch(f));
    expect(r.engine).toBe("template");
    expect(r.note).toMatch(/Template copy/);
    expect(f).not.toHaveBeenCalled();
  });

  it("returns Claude's copy when it only uses the listing's facts, and records the estimated cost", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const p = (await getProperty("prop-riverside-loft"))!;
    const f = claudeReply(JSON.stringify({ portal: "Riverside Loft with Terrace: 2 bedrooms, 2 bathrooms, 98 m², terrace, gym and parking. $485,000.", social: "New in Riverside. #Riverside #Loft", message: "Want to see the Riverside loft?" }));
    const r = await writeListingCopy(p, asFetch(f));
    expect(r.engine).toBe("claude");
    expect(r.copy[0].text).toMatch(/98 m²/);
    expect(r.cost).toEqual({ inputTokens: 1200, outputTokens: 300, estUsd: estimateUsd(1200, 300) });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.messages[0].content).toContain(listingFacts(p));
    expect(aiUsageTotals()).toMatchObject({ calls: 1, inputTokens: 1200, outputTokens: 300 });
    expect(aiUsageTotals().byFeature.listing_copy?.calls).toBe(1);
  });

  it("discards Claude's copy if it invents an amenity or a number", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const p = (await getProperty("prop-riverside-loft"))!;
    const f = claudeReply(JSON.stringify({ portal: "Stunning loft with a rooftop pool, 5 minutes from downtown.", social: "x", message: "y" }));
    const r = await writeListingCopy(p, asFetch(f));
    expect(r.engine).toBe("template");
    expect(r.note).toMatch(/discarded/);
    expect(aiUsageTotals().calls).toBe(1);
  });
});

describe("match explanation and alert", () => {
  it("keeps the computed fit and uses Claude's wording when it checks out", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const [lead, p] = [(await getLead("lead-ana-torres"))!, (await getProperty("prop-riverside-loft"))!];
    const f = claudeReply(
      JSON.stringify({ explanation: "Fit 100/100: within her $520,000 budget, in Riverside, 2 bedrooms.", subject: "A Riverside loft within your budget", body: "Hi Ana, the Riverside Loft with Terrace is $485,000 with 2 bedrooms. Would you like a viewing this week?" })
    );
    const r = await writeMatchAlert(lead, p, "friendly", asFetch(f));
    expect(r.engine).toBe("claude");
    expect(r.body).toMatch(/^Hi Ana/);
    const prompt = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).messages[0].content as string;
    expect(prompt).toMatch(/Fit score computed by the desk: 100\/100/);
  });

  it("falls back to the template when Claude is unavailable", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const [lead, p] = [(await getLead("lead-ana-torres"))!, (await getProperty("prop-riverside-loft"))!];
    const f = vi.fn(async () => new Response("overloaded", { status: 529 }));
    const r = await writeMatchAlert(lead, p, "friendly", asFetch(f));
    expect(r.engine).toBe("template");
    expect(r.note).toMatch(/529/);
    expect(r.body).toMatch(/^Hi Ana/);
    expect(aiUsageTotals().calls).toBe(0);
  });
});

describe("market brief", () => {
  const market: UsMarket = {
    latestMonth: "202608",
    origin: "snapshot",
    fetchedAt: "",
    states: [
      {
        id: "FL",
        name: "Florida",
        latest: { month: "202608", active: 150000, newListings: 30000, pending: 50000, price: 420000, dom: 70, pendingRatio: 0.33, reducedShare: 0.3, activeYy: 0.2, newYy: 0.05, priceYy: -0.02, domYy: 0.1 },
        history: [],
      },
    ],
  };

  it("needs a key, and cites the month from the facts", async () => {
    expect(await writeMarketBrief(market)).toMatchObject({ ok: false, month: "Aug 2026" });
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const good = claudeReply("In Aug 2026, Realtor.com counted 150,000 homes for sale in Florida, +20.0% vs last year, with a median asking price of $420,000.");
    const r = await writeMarketBrief(market, [], asFetch(good));
    expect(r.ok).toBe(true);
    const bad = claudeReply("In Aug 2026 Florida had 999,999 homes for sale.");
    expect(await writeMarketBrief(market, [], asFetch(bad))).toMatchObject({ ok: false, error: expect.stringMatching(/discarded/) });
  });
});
