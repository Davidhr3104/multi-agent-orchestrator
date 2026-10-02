import { beforeEach, describe, expect, it } from "vitest";
import { handleExecuteBody, runWithPolicy } from "@helix/core";
import { socialActions } from "./ai-actions";
import { getPost, loadDemoCatalog } from "./store";

const ctx = { actor: "Helix AI · approved by local" };
const target = (id: string) => [{ id, label: id }];

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("social desk actions", () => {
  it("never auto-runs an approval", async () => {
    const out = await runWithPolicy(socialActions, { action: "approve_post", summary: "x", targets: target("seed-ig-harvest-drop") }, ctx, { canAutoRun: true });
    expect("proposal" in out).toBe(true);
    expect((await getPost("seed-ig-harvest-drop"))?.status).toBe("needs_review");
  });

  it("approves after confirmation and Undo restores the post", async () => {
    const r = await handleExecuteBody(socialActions, { action: "approve_post", targetIds: ["seed-ig-harvest-drop"] }, ctx);
    expect(r.status).toBe(200);
    expect(r.body.resultText).toMatch(/Nothing was published/);
    expect((await getPost("seed-ig-harvest-drop"))?.status).toBe("approved");

    const undo = await handleExecuteBody(socialActions, { action: "restore", entries: r.body.undo }, ctx);
    expect(undo.status).toBe(200);
    const p = await getPost("seed-ig-harvest-drop");
    expect(p?.status).toBe("needs_review");
    expect(p?.approvedBy).toBeUndefined();
  });

  it("fails to approve a blocked post even when confirmed", async () => {
    const r = await handleExecuteBody(socialActions, { action: "approve_post", targetIds: ["seed-x-gamechanger"] }, ctx);
    expect(r.body.done).toEqual([]);
    expect((r.body.failed as { error: string }[])[0].error).toMatch(/Can't approve yet/);
  });

  it("sends a post back on its own (safe, with Undo)", async () => {
    const out = await runWithPolicy(socialActions, { action: "request_changes", summary: "x", targets: target("seed-x-cupping-thread"), params: { note: "Add a hashtag" } }, ctx, { canAutoRun: true });
    expect("executed" in out).toBe(true);
    const p = await getPost("seed-x-cupping-thread");
    expect(p?.status).toBe("changes");
    expect(p?.notes.at(-1)).toMatch(/Add a hashtag/);
  });

  it("asks before moving an approved post but moves a draft alone", async () => {
    const when = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const approved = await runWithPolicy(socialActions, { action: "reschedule_post", summary: "x", targets: target("seed-fb-open-house"), params: { when } }, ctx, { canAutoRun: true });
    expect("proposal" in approved).toBe(true);
    const draft = await runWithPolicy(socialActions, { action: "reschedule_post", summary: "x", targets: target("seed-tt-latte-art-fail"), params: { when } }, ctx, { canAutoRun: true });
    expect("executed" in draft).toBe(true);
    expect((await getPost("seed-tt-latte-art-fail"))?.scheduledFor).toBe(when);
  });

  it("rejects undo data for a different post", async () => {
    const r = await handleExecuteBody(socialActions, { action: "add_note", targetIds: ["seed-ig-water"], params: { note: "hi" } }, ctx);
    const entry = (r.body.undo as { action: string; id: string; data: unknown }[])[0];
    const bad = await handleExecuteBody(socialActions, { action: "restore", entries: [{ ...entry, id: "seed-ig-harvest-drop" }] }, ctx);
    expect((bad.body.failed as unknown[]).length).toBe(1);
  });
});
