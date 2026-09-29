import { beforeEach, describe, expect, it } from "vitest";
import { restoreDeskActions, runDeskAction, runWithPolicy } from "@helix/core";
import { legalActions } from "./ai-actions";
import { getCachedConflict, getRfp, listComms, loadDemoCatalog } from "./store";

const ctx = { actor: "Helix AI · approved by test" };
const SPI = "seed-SPIcodingforwo"; // has a partner decision (GO)
const CLINICAL = "seed-ClinicalNLPRFP"; // flagged for review, decision CONDITIONAL
const MEDICAL = "seed-Medicalrecorda";

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("legal actions on the demo desk", () => {
  it("adds a note on its own and undo removes exactly that note", async () => {
    const before = (await listComms(SPI)).length;
    const r = await runWithPolicy(legalActions, { action: "add_note", summary: "s", targets: [{ id: SPI, label: "SPI" }], params: { note: "client asked for E&O proof" } }, ctx, { canAutoRun: true });
    expect("executed" in r && r.executed.undoable).toBe(true);
    expect((await listComms(SPI)).length).toBe(before + 1);

    const undo = "executed" in r ? JSON.parse(JSON.stringify(r.executed.undo)) : [];
    const back = await restoreDeskActions(legalActions, undo, ctx);
    expect(back.done).toEqual([SPI]);
    expect((await listComms(SPI)).length).toBe(before);
  });

  it("rejects a note with no text before anything runs", async () => {
    await expect(runDeskAction(legalActions, { action: "add_note", targetIds: [SPI], params: { note: "  " } }, ctx)).rejects.toThrow(/note is required/);
  });

  it("runs a conflict check automatically and marks it as not undoable", async () => {
    const r = await runWithPolicy(legalActions, { action: "run_conflict_check", summary: "s", targets: [{ id: MEDICAL, label: "Medical" }] }, ctx, { canAutoRun: true });
    expect("executed" in r && r.executed.undoable).toBe(false);
    expect(getCachedConflict(MEDICAL)).toBeDefined();
  });

  it("asks before flagging an RFP that already has a partner decision", async () => {
    const r = await runWithPolicy(legalActions, { action: "flag_review", summary: "s", targets: [{ id: SPI, label: "SPI" }] }, ctx, { canAutoRun: true });
    expect("proposal" in r && r.reasons.join(" ")).toMatch(/already has a partner decision/i);
    expect((await getRfp(SPI))?.needsReview).toBe(false);
  });

  it("never records a partner decision without a human, and changes nothing", async () => {
    const r = await runWithPolicy(legalActions, { action: "record_decision", summary: "s", targets: [{ id: CLINICAL, label: "Clinical" }], params: { verdict: "NO-GO" } }, ctx, { canAutoRun: true });
    expect("proposal" in r && r.reasons.join(" ")).toMatch(/partner's decision/i);
    expect((await getRfp(CLINICAL))?.partnerDecision?.verdict).toBe("CONDITIONAL");
  });

  it("records the decision once confirmed, and undo restores the previous one", async () => {
    const ran = await runDeskAction(legalActions, { action: "record_decision", targetIds: [CLINICAL], params: { verdict: "NO-GO" } }, ctx);
    expect(ran.done).toEqual([CLINICAL]);
    const after = await getRfp(CLINICAL);
    expect(after?.partnerDecision?.verdict).toBe("NO-GO");
    expect(after?.partnerDecision?.decidedBy).toBe(ctx.actor);
    expect(after?.needsReview).toBe(false);

    await restoreDeskActions(legalActions, JSON.parse(JSON.stringify(ran.undo)), ctx);
    const back = await getRfp(CLINICAL);
    expect(back?.partnerDecision?.verdict).toBe("CONDITIONAL");
    expect(back?.needsReview).toBe(true);
  });

  it("rejects an invalid verdict and reports a missing RFP as a failure", async () => {
    await expect(runDeskAction(legalActions, { action: "record_decision", targetIds: [CLINICAL], params: { verdict: "MAYBE" } }, ctx)).rejects.toThrow(/verdict/);
    const r = await runDeskAction(legalActions, { action: "flag_review", targetIds: ["nope"] }, ctx);
    expect(r.failed).toEqual([{ id: "nope", error: "Not found" }]);
  });
});
