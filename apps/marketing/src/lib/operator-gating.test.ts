import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as reviewPost } from "@/app/api/campaigns/[id]/review/route";
import { POST as executePost } from "@/app/api/ask-ai/execute/route";
import { POST as remapPost } from "@/app/api/leads/remap/route";
import { POST as syncPost } from "@/app/api/ads/sync/route";
import { POST as wastePost } from "@/app/api/waste-report/route";
import { POST as keysPost } from "@/app/api/settings/keys/route";
import { POST as deskPost } from "@/app/api/settings/desk/route";
import { deskWriteDenied, mayChangeDesk, mayWriteAds } from "./ai-desk";
import { clearDesk, currentDeskMode, getSnapshot, loadDemoCatalog } from "./store";

const KEY = "test-operator-key-123";
const AD_A = "ad-a-volume";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
const operator = { "x-helix-operator-key": KEY };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

let previousKey: string | undefined;
beforeAll(() => {
  previousKey = process.env.HELIX_OPERATOR_KEY;
  process.env.HELIX_OPERATOR_KEY = KEY;
});
afterAll(() => {
  if (previousKey === undefined) delete process.env.HELIX_OPERATOR_KEY;
  else process.env.HELIX_OPERATOR_KEY = previousKey;
});

describe("operator gating on the demo desk", () => {
  beforeAll(async () => {
    await loadDemoCatalog();
  });

  it("lets a visitor without the cookie change the demo desk", async () => {
    expect(currentDeskMode()).toBe("demo");
    const req = post("/api/x", {});
    expect(mayChangeDesk(req)).toBe(true);
    expect(deskWriteDenied(req)).toBeNull();
    expect(mayWriteAds(req)).toBe(false);

    const campaign = (await getSnapshot("7d")).campaigns.find((c) => c.campaignId === AD_A)!;
    const res = await reviewPost(post(`/api/campaigns/${campaign.id}/review`, { action: "pause" }), params(campaign.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { adsWrite: { attempted: boolean; detail: string } };
    expect(body.adsWrite.attempted).toBe(false);
    expect(body.adsWrite.detail).toMatch(/nothing was sent to the ad platform/i);

    const exec = await executePost(post("/api/ask-ai/execute", { action: "keep_campaign", targetIds: ["ad-d-thin"] }));
    expect(exec.status).not.toBe(401);
  });

  it("keeps real-provider and paid routes behind the operator key", async () => {
    for (const res of [
      await syncPost(post("/api/ads/sync", { source: "all" })),
      await wastePost(post("/api/waste-report", { window: "7d" })),
      await keysPost(post("/api/settings/keys", { META_ACCESS_TOKEN: "x" })),
      await deskPost(post("/api/settings/desk", { action: "empty" })),
    ]) {
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: string }).error).toBe("Operator unlock required.");
    }
    expect(currentDeskMode()).toBe("demo");
  });

  it("accepts a valid x-helix-operator-key header on paid routes", async () => {
    const res = await wastePost(post("/api/waste-report", { window: "7d" }, operator));
    expect(res.status).toBe(200);
  });
});

describe("operator gating on a live desk", () => {
  beforeAll(async () => {
    await clearDesk();
  });

  it("requires the operator for desk changes without the cookie", async () => {
    expect(currentDeskMode()).toBe("live");
    const req = post("/api/x", {});
    expect(mayChangeDesk(req)).toBe(false);
    expect(deskWriteDenied(req)?.status).toBe(401);

    const review = await reviewPost(post("/api/campaigns/x/review", { action: "keep" }), params("x"));
    expect(review.status).toBe(401);
    const remap = await remapPost(post("/api/leads/remap", { spendCampaignId: "a", leadCampaignId: "b" }));
    expect(remap.status).toBe(401);
    const exec = await executePost(post("/api/ask-ai/execute", { action: "keep_campaign", targetIds: ["x"] }));
    expect(exec.status).toBe(401);
    const sync = await syncPost(post("/api/ads/sync", { source: "all" }));
    expect(sync.status).toBe(401);
  });

  it("lets the operator through with a valid header", async () => {
    const req = post("/api/x", {}, operator);
    expect(mayChangeDesk(req)).toBe(true);
    expect(mayWriteAds(req)).toBe(true);
    const review = await reviewPost(post("/api/campaigns/x/review", { action: "keep" }, operator), params("x"));
    expect(review.status).toBe(404);
    const remap = await remapPost(post("/api/leads/remap", { spendCampaignId: "a", leadCampaignId: "b" }, operator));
    expect(remap.status).toBe(200);
    const bad = await reviewPost(post("/api/campaigns/x/review", { action: "keep" }, { "x-helix-operator-key": "wrong" }), params("x"));
    expect(bad.status).toBe(401);
  });
});
