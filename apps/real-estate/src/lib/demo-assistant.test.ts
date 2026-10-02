import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoReply } from "./demo-assistant";
import { getZone, listLeads, listProperties, loadDemoCatalog } from "./store";

const NOW = Date.now();

async function ask(q: string) {
  return buildDemoReply(q, await listLeads(), await listProperties(), await getZone(), NOW).answer;
}

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("real estate demo assistant", () => {
  it("summarizes the pipeline with links to the hot buyers it names", async () => {
    const a = await ask("How is my pipeline doing?");
    expect(a).toMatch(/active listings/);
    expect(a).toMatch(/\[[^\]]+\]\(\/leads\/lead-[a-z-]+\)/);
  });

  it("ranks hot buyers best first and cites the fields behind the score", async () => {
    const a = await ask("Who are my hottest buyers?");
    expect(a).toMatch(/hot buyers, best first/);
    expect(a).toMatch(/score \d+/);
    expect(a).not.toContain("Liam O'Connor");
  });

  it("finds the best properties for a named buyer, with links, fit and reasons", async () => {
    const a = await ask("Best matches for Ana Torres");
    expect(a).toContain("[Ana Torres](/leads/lead-ana-torres)");
    expect(a.indexOf("Riverside Loft")).toBeGreaterThan(-1);
    expect(a).toMatch(/\(\/properties\/prop-riverside-loft\)/);
    expect(a).toMatch(/fit \d+/);
  });

  it("finds the best buyers for a named property", async () => {
    const a = await ask("Which buyers fit the Riverside Loft?");
    expect(a).toMatch(/Top buyers for \[Riverside Loft with Terrace\]/);
    expect(a).toMatch(/\(\/leads\/lead-/);
  });

  it("explains a buyer's score factor by factor", async () => {
    const a = await ask("Why did Sofia Reyes score so high?");
    expect(a).toMatch(/Budget: \d+\/25/);
    expect(a).toMatch(/Cash buyer/);
  });

  it("flags buyers who went cold with days since contact", async () => {
    const a = await ask("Which buyers went cold?");
    expect(a).toContain("Noah Fischer");
    expect(a).toMatch(/\d+ days/);
    expect(a).toMatch(/for your approval/);
  });

  it("turns 'notify buyers about <listing>' into a draft proposal for that listing", async () => {
    const r = buildDemoReply("Notify buyers about the Riverside loft", await listLeads(), await listProperties(), await getZone(), NOW);
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "draft_match_alerts", targets: [{ id: "prop-riverside-loft" }] });
  });

  it("proposes check-ins only for buyers who are actually cold", async () => {
    const r = buildDemoReply("Draft check-ins for cold buyers", await listLeads(), await listProperties(), await getZone(), NOW);
    expect(r.proposal?.action).toBe("draft_reactivation");
    expect(r.proposal?.targets.map((t) => t.label)).toContain("Noah Fischer");
    expect(r.proposal?.targets.map((t) => t.label)).not.toContain("Ana Torres");
  });

  it("asks which draft before approving a vague 'approve'", async () => {
    const r = buildDemoReply("approve", await listLeads(), await listProperties(), await getZone(), NOW);
    expect(r.proposal).toBeUndefined();
  });

  it("labels every market figure as demo data", async () => {
    const a = await ask("What's the market like in Riverside?");
    expect(a).toMatch(/DEMO DATA/);
    expect(a).toMatch(/per m²/);
  });

  it("shows help for anything else and handles an empty desk", async () => {
    expect(await ask("tell me a joke")).toMatch(/hottest buyers|summarize/i);
    expect(buildDemoReply("hi", [], [], null, NOW).answer).toMatch(/no properties or buyers/i);
  });
});
