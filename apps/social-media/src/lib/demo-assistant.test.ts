import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoReply } from "./demo-assistant";
import { getBrand, listPosts, loadDemoCatalog } from "./store";

async function ask(q: string) {
  return buildDemoReply(q, await listPosts(), await getBrand(), Date.now());
}

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("social demo assistant", () => {
  it("summarizes the calendar and says nothing was published", async () => {
    const { answer } = await ask("Give me a summary");
    expect(answer).toMatch(/Lumen Roasters has \d+ posts/);
    expect(answer).toMatch(/Nothing has been published/);
  });

  it("lists the review queue with links and scores", async () => {
    const { answer } = await ask("What needs review?");
    expect(answer).toMatch(/\[[^\]]+\]\(\/posts\/seed-[a-z-]+\)/);
    expect(answer).toMatch(/readiness \d+\/100/);
  });

  it("explains a post found by channel and day", async () => {
    const { answer } = await ask("Explain the Instagram post today");
    expect(answer).toMatch(/\/posts\/seed-ig-harvest-drop/);
    expect(answer).toMatch(/Length: \d+\/25/);
  });

  it("proposes approval as a command for a ready post", async () => {
    const r = await ask("Approve the Instagram post today");
    expect(r.command).toBe(true);
    expect(r.proposal?.action).toBe("approve_post");
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["seed-ig-harvest-drop"]);
  });

  it("refuses to propose approving a blocked post", async () => {
    const r = await ask("approve the subscription game-changer post on x");
    expect(r.command).toBeUndefined();
    expect(r.answer).toMatch(/wouldn't approve/);
  });

  it("proposes sending a post back with the reason given", async () => {
    const r = await ask("Send back the LinkedIn sourcing post because too many hashtags");
    expect(r.proposal?.action).toBe("request_changes");
    expect(r.proposal?.params).toEqual({ note: "too many hashtags" });
  });

  it("proposes a reschedule with an ISO date", async () => {
    const r = await ask("Move the TikTok latte art post to +2 days");
    expect(r.proposal?.action).toBe("reschedule_post");
    expect(Number.isNaN(Date.parse(r.proposal?.params?.when as string))).toBe(false);
  });

  it("does not mistake 'the queue' for a submit command", async () => {
    const r = await ask("What's in the approval queue?");
    expect(r.command).toBeUndefined();
  });
});
