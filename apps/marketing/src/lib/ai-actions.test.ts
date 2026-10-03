import { beforeEach, describe, expect, it } from "vitest";
import { restoreDeskActions, runDeskAction, runWithPolicy } from "@helix/core";
import { marketingActions } from "./ai-actions";
import { buildDemoReply } from "./demo-assistant";
import { getSnapshot, loadDemoCatalog } from "./store";

const ctx = { actor: "Helix AI · approved by test" };
const AD_D = "ad-d-thin";
const AD_A = "ad-a-volume";
const AD_B = "ad-b-quality";

const campaign = async (id: string) => (await getSnapshot("7d")).campaigns.find((c) => c.campaignId === id);

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("marketing actions on the demo desk", () => {
  it("keeps a campaign on its own, clearing its review flag, and undo puts the flag back", async () => {
    expect((await campaign(AD_D))?.needsReview).toBe(true);
    const r = await runWithPolicy(marketingActions, { action: "keep_campaign", summary: "s", targets: [{ id: AD_D, label: "Ad D" }] }, ctx, { canAutoRun: true });
    expect("executed" in r).toBe(true);
    expect((await campaign(AD_D))?.needsReview).toBe(false);

    const undo = "executed" in r ? JSON.parse(JSON.stringify(r.executed.undo)) : [];
    await restoreDeskActions(marketingActions, undo, ctx);
    expect((await campaign(AD_D))?.needsReview).toBe(true);
  });

  it("never pauses or scales without a person, and changes nothing", async () => {
    for (const action of ["pause_campaign", "scale_campaign"]) {
      const r = await runWithPolicy(marketingActions, { action, summary: "s", targets: [{ id: AD_A, label: "Ad A" }] }, ctx, { canAutoRun: true });
      expect("proposal" in r && r.reasons.join(" ")).toMatch(/sign-off/i);
    }
    expect((await campaign(AD_A))?.status).toBe("active");
  });

  it("pauses once confirmed (locally, since Meta is not connected) and undo restores it", async () => {
    const ran = await runDeskAction(marketingActions, { action: "pause_campaign", targetIds: [AD_A] }, ctx);
    expect(ran.done).toEqual([AD_A]);
    expect((await campaign(AD_A))?.status).toBe("paused");
    await restoreDeskActions(marketingActions, JSON.parse(JSON.stringify(ran.undo)), ctx);
    expect((await campaign(AD_A))?.status).toBe("active");
  });

  it("rejects tampered undo data and reports an unknown campaign as a failure", async () => {
    const back = await restoreDeskActions(marketingActions, [{ action: "keep_campaign", id: AD_D, data: { decision: { campaignId: "other", action: "pause", at: "x" } } }], ctx);
    expect(back.done).toEqual([]);
    const r = await runDeskAction(marketingActions, { action: "keep_campaign", targetIds: ["nope"] }, ctx);
    expect(r.failed).toEqual([{ id: "nope", error: "Not found" }]);
  });
});

describe("marketing demo assistant on the demo desk", () => {
  it("names where money is wasted, from the real numbers", async () => {
    const r = buildDemoReply("Where am I wasting spend?", await getSnapshot("7d"));
    expect(r.answer).toContain("Ad A — volume HVAC");
    expect(r.answer).toMatch(/spam/);
  });

  it("recommends scaling only the campaign with hot leads and no spam", async () => {
    const r = buildDemoReply("Which campaigns should I scale?", await getSnapshot("7d"));
    expect(r.answer).toContain("Ad B");
    expect(r.answer).not.toContain("Ad A —");
  });

  it("parses keep / pause / scale commands by 'Ad X' and proposes the matching action", async () => {
    const snap = await getSnapshot("7d");
    expect(buildDemoReply("Keep Ad D", snap).proposal).toMatchObject({ action: "keep_campaign", targets: [{ id: AD_D }] });
    expect(buildDemoReply("Pause Ad A", snap).proposal).toMatchObject({ action: "pause_campaign", targets: [{ id: AD_A }] });
    const scale = buildDemoReply("Scale Ad B", snap);
    expect(scale.command).toBe(true);
    expect(scale.proposal).toMatchObject({ action: "scale_campaign", targets: [{ id: AD_B }] });
  });

  it("answers 'which campaign should I pause and why' with the worst campaign, its spam spend and a confirmable pause", async () => {
    const snap = await getSnapshot("7d");
    const r = buildDemoReply("Which campaign should I pause and why?", snap);
    const ad = snap.campaigns.find((c) => c.campaignId === AD_A)!;
    expect(r.answer).toContain("Ad A — volume HVAC");
    expect(r.answer).toContain(`$${ad.metrics.spendOnSpam}`);
    expect(r.answer).not.toMatch(/I can summarize/);
    expect(r.proposal).toMatchObject({ action: "pause_campaign", targets: [{ id: AD_A }] });
    // it is a proposal the risk policy turns into a confirmation, never an executed change
    const gated = await runWithPolicy(marketingActions, r.proposal!, ctx, { canAutoRun: true });
    expect("proposal" in gated && gated.reasons.join(" ")).toMatch(/sign-off/i);
    expect((await campaign(AD_A))?.status).toBe("active");
  });

  it("does not propose a pause when no campaign leaks spend to spam", async () => {
    const snap = await getSnapshot("7d");
    const clean = { ...snap, campaigns: snap.campaigns.map((c) => ({ ...c, metrics: { ...c.metrics, spendOnSpam: 0 } })) };
    const r = buildDemoReply("Which campaign should I pause?", clean);
    expect(r.proposal).toBeUndefined();
    expect(r.answer).toMatch(/would not pause/i);
  });

  it("says so when no campaign matches instead of guessing", async () => {
    const r = buildDemoReply("Pause Ad Z", await getSnapshot("7d"));
    expect(r.proposal).toBeUndefined();
    expect(r.answer).toMatch(/couldn.t find/i);
  });
});
