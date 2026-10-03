import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/cron/social/route";
import { cronAuth, runSocialCron } from "./cron";
import { resetInsights } from "./insights";
import { json, mockFetch, saveEnv } from "./test-helpers";

let restore: () => void;
beforeEach(() => {
  restore = saveEnv();
  resetInsights();
  process.env.HELIX_DESK_SEED = "off";
  delete (globalThis as { __helixSocialDesk?: unknown }).__helixSocialDesk;
});
afterEach(() => restore());

describe("cron auth", () => {
  it("is closed without CRON_SECRET and checks the bearer token", () => {
    expect(cronAuth("Bearer anything", "")).toBe("no_secret");
    expect(cronAuth(null, "s3cret")).toBe("denied");
    expect(cronAuth("Bearer wrong", "s3cret")).toBe("denied");
    expect(cronAuth("Bearer s3cret", "s3cret")).toBe("ok");
  });

  it("route answers 503 without a secret, 401 with a wrong one, 200 with the right one", async () => {
    const url = "https://social.example/api/cron/social?task=refresh";
    expect((await GET(new Request(url, { headers: { authorization: "Bearer x" } }))).status).toBe(503);
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(new Request(url, { headers: { authorization: "Bearer x" } }))).status).toBe(401);
    const ok = await GET(new Request(url, { headers: { authorization: "Bearer s3cret" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ task: "refresh", insights: "not_configured", published: false });
  });
});

describe("weekly cron run", () => {
  it("refreshes insights, adds Claude drafts to review, writes the report, and never posts", async () => {
    process.env.HELIX_META_ACCESS_TOKEN = "t";
    process.env.HELIX_META_IG_USER_ID = "1784";
    process.env.HELIX_SOCIAL_PUBLISH = "live";
    process.env.ANTHROPIC_API_KEY = "k";
    const drafts = JSON.stringify({ drafts: [{ channel: "instagram", pillar: "education", caption: "Brew guide, part two.", hashtags: ["coffee"], inspiredBy: ["P1"] }] });
    let claudeCalls = 0;
    const { fetch, calls } = mockFetch(
      (c) => (c.url.includes("debug_token") ? json({ data: { is_valid: true, expires_at: 0, scopes: [] } }) : undefined),
      (c) => (c.url.includes("/1784/media?") ? json({ data: [{ id: "m1", caption: "Brew guide", like_count: 40, comments_count: 4, timestamp: "2026-09-30T10:00:00Z" }] }) : undefined),
      (c) => (c.url.includes("/m1/insights") ? json({ data: [{ name: "reach", values: [{ value: 800 }] }] }) : undefined),
      (c) => (c.url.includes("/1784/insights") ? json({ data: [] }) : undefined),
      (c) => (c.url.includes("/1784?") ? json({ id: "1784", username: "lumen" }) : undefined),
      (c) =>
        c.url === "https://api.anthropic.com/v1/messages"
          ? json({ content: [{ type: "text", text: ++claudeCalls === 1 ? drafts : "One post went out this week." }], usage: { input_tokens: 10, output_tokens: 5 } })
          : undefined
    );
    const result = await runSocialCron("weekly", fetch, new Date("2026-10-02T12:00:00Z"));
    expect(result).toMatchObject({ insights: "refreshed", realPosts: 1, draftsAdded: 1, published: false });
    expect(result.reportId).toBeTruthy();
    expect(calls.filter((c) => c.method === "POST" && c.url.includes("graph.facebook.com"))).toHaveLength(0);
  });
});
