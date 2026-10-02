import { beforeEach, describe, expect, it } from "vitest";
import { handleExecuteBody, runWithPolicy } from "@helix/core";
import { realEstateActions } from "./ai-actions";
import { buyersToAlert, isCold, reactivationDraft } from "./outreach";
import { getLead, getProperty, listDrafts, listLeads, listProperties, loadDemoCatalog } from "./store";

const ctx = { actor: "You" };
const target = (id: string) => [{ id, label: id }];

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("outreach drafts", () => {
  it("alerts only open buyers the listing fits with no concerns", async () => {
    const p = (await getProperty("prop-riverside-loft"))!;
    const fits = buyersToAlert(p, await listLeads());
    expect(fits.length).toBeGreaterThan(0);
    for (const f of fits) {
      expect(f.fit).toBeGreaterThanOrEqual(70);
      expect(["closed", "archived"]).not.toContain(f.lead.stage);
    }
  });

  it("builds a check-in from the buyer's own brief", async () => {
    const lead = (await getLead("lead-noah-fischer"))!;
    expect(isCold(lead, Date.now())).toBe(true);
    const d = reactivationDraft(lead, await listProperties(), Date.now());
    expect(d.body).toContain("Hi Noah");
    expect(d.why[0]).toMatch(/No contact in \d+ days/);
    expect(d.status).toBe("pending");
  });
});

describe("real estate desk actions", () => {
  it("drafts match alerts on its own, rejects duplicates, and Undo removes them", async () => {
    const out = await runWithPolicy(realEstateActions, { action: "draft_match_alerts", summary: "x", targets: target("prop-riverside-loft") }, ctx, { canAutoRun: true });
    expect("executed" in out).toBe(true);
    const created = await listDrafts();
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((d) => d.kind === "new_match" && d.status === "pending")).toBe(true);

    const again = await handleExecuteBody(realEstateActions, { action: "draft_match_alerts", targetIds: ["prop-riverside-loft"] }, ctx);
    expect((again.body.failed as { error: string }[])[0].error).toMatch(/already has a draft/);

    expect(again.body.done).toEqual([]);

    if (!("executed" in out)) throw new Error("expected the draft to run");
    const undo = await handleExecuteBody(realEstateActions, { action: "restore", entries: out.executed.undo }, ctx);
    expect(undo.status).toBe(200);
    expect(await listDrafts()).toEqual([]);
  });

  it("never auto-runs an approval, and approving says nothing was sent", async () => {
    await handleExecuteBody(realEstateActions, { action: "draft_reactivation", targetIds: ["lead-noah-fischer"] }, ctx);
    const [d] = await listDrafts();
    const out = await runWithPolicy(realEstateActions, { action: "approve_draft", summary: "x", targets: target(d.id) }, ctx, { canAutoRun: true });
    expect("proposal" in out).toBe(true);
    expect((await listDrafts())[0].status).toBe("pending");

    const r = await handleExecuteBody(realEstateActions, { action: "approve_draft", targetIds: [d.id] }, ctx);
    expect(r.body.resultText).toMatch(/Not sent/);
    const approved = (await listDrafts())[0];
    expect(approved.status).toBe("approved");
    expect(approved.decidedBy).toBe("You");
  });

  it("refuses a check-in for a buyer contacted recently", async () => {
    const r = await handleExecuteBody(realEstateActions, { action: "draft_reactivation", targetIds: ["lead-ana-torres"] }, ctx);
    expect((r.body.failed as { error: string }[])[0].error).toMatch(/contacted recently/);
  });

  it("moves a buyer along the pipeline alone, with Undo", async () => {
    const out = await runWithPolicy(realEstateActions, { action: "move_stage", summary: "x", targets: target("lead-ana-torres"), params: { stage: "visit" } }, ctx, { canAutoRun: true });
    if (!("executed" in out)) throw new Error("expected the move to run");
    expect((await getLead("lead-ana-torres"))?.stage).toBe("visit");
    await handleExecuteBody(realEstateActions, { action: "restore", entries: out.executed.undo }, ctx);
    expect((await getLead("lead-ana-torres"))?.stage).toBe("new");
  });

  it("asks before closing or archiving a buyer, and rejects unknown stages", async () => {
    const out = await runWithPolicy(realEstateActions, { action: "move_stage", summary: "x", targets: target("lead-ana-torres"), params: { stage: "archived" } }, ctx, { canAutoRun: true });
    expect("proposal" in out).toBe(true);
    expect((await getLead("lead-ana-torres"))?.stage).toBe("new");
    const bad = await handleExecuteBody(realEstateActions, { action: "move_stage", targetIds: ["lead-ana-torres"], params: { stage: "won" } }, ctx);
    expect(bad.status).toBe(400);
  });

  it("rejects undo data for a different draft", async () => {
    await handleExecuteBody(realEstateActions, { action: "draft_reactivation", targetIds: ["lead-noah-fischer"] }, ctx);
    const [d] = await listDrafts();
    const r = await handleExecuteBody(realEstateActions, { action: "dismiss_draft", targetIds: [d.id] }, ctx);
    const entry = (r.body.undo as { action: string; id: string; data: unknown }[])[0];
    const bad = await handleExecuteBody(realEstateActions, { action: "restore", entries: [{ ...entry, id: "draft-other" }] }, ctx);
    expect((bad.body.failed as unknown[]).length).toBe(1);
  });
});
