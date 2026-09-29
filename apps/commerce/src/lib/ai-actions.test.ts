import { beforeEach, describe, expect, it } from "vitest";
import { restoreDeskActions, runDeskAction, runWithPolicy } from "@helix/core";
import { commerceActions } from "./ai-actions";
import { getOrder, listReorders, loadDemoCatalog } from "./store";

const ctx = { actor: "Helix AI · approved by test" };
const SOFIA = "order-shopifyOrder1003"; // critical, awaiting review
const MARCUS = "order-shopifyOrder1002"; // low risk, unfulfilled
const NEWCUST = "order-shopifyOrder1005"; // critical, awaiting review

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("commerce actions on the demo desk", () => {
  it("holds an order and fully undoes it, including clearing the review decision", async () => {
    const before = await getOrder(SOFIA);
    expect(before?.reviewDecision).toBeUndefined();

    const ran = await runDeskAction(commerceActions, { action: "hold_orders", targetIds: [SOFIA] }, ctx);
    expect(ran.done).toEqual([SOFIA]);
    expect((await getOrder(SOFIA))?.reviewDecision).toBe("flagged");

    // The undo entry goes over JSON to the browser and back, so round-trip it like the client does.
    const back = await restoreDeskActions(commerceActions, JSON.parse(JSON.stringify(ran.undo)), ctx);
    expect(back.done).toEqual([SOFIA]);
    const after = await getOrder(SOFIA);
    expect(after?.reviewDecision).toBeUndefined();
    expect(after?.reviewedBy).toBeUndefined();
    expect(after?.requiresReview).toBe(before?.requiresReview);
  });

  it("approves a clean low-risk order on its own", async () => {
    const r = await runWithPolicy(commerceActions, { action: "approve_orders", summary: "s", targets: [{ id: MARCUS, label: "Marcus" }] }, ctx, { canAutoRun: true });
    expect("executed" in r).toBe(true);
    expect((await getOrder(MARCUS))?.fulfillmentStatus).toBe("fulfilled");
  });

  it("refuses to approve a critical-risk order without a human, and changes nothing", async () => {
    const r = await runWithPolicy(commerceActions, { action: "approve_orders", summary: "s", targets: [{ id: NEWCUST, label: "New" }] }, ctx, { canAutoRun: true });
    expect("proposal" in r && r.reasons.join(" ")).toMatch(/above low fraud risk/i);
    expect((await getOrder(NEWCUST))?.fulfillmentStatus).toBe("unfulfilled");
  });

  it("always asks before cancelling", async () => {
    const r = await runWithPolicy(commerceActions, { action: "cancel_orders", summary: "s", targets: [{ id: MARCUS, label: "Marcus" }] }, ctx, { canAutoRun: true });
    expect("proposal" in r).toBe(true);
    expect((await getOrder(MARCUS))?.fulfillmentStatus).toBe("unfulfilled");
  });

  it("drafts a reorder without sending anything, and undo cancels the draft", async () => {
    const product = "product-dshopifyProduct6";
    const ran = await runDeskAction(commerceActions, { action: "create_reorders", targetIds: [product] }, ctx);
    expect(ran.done).toEqual([product]);
    expect((await listReorders()).filter((r) => r.productId === product && r.status === "draft")).toHaveLength(1);

    await restoreDeskActions(commerceActions, ran.undo, ctx);
    expect((await listReorders()).filter((r) => r.productId === product && r.status === "draft")).toHaveLength(0);
  });

  it("reports a missing order as a failure instead of pretending it worked", async () => {
    const r = await runDeskAction(commerceActions, { action: "hold_orders", targetIds: ["nope"] }, ctx);
    expect(r.done).toEqual([]);
    expect(r.failed).toEqual([{ id: "nope", error: "Not found" }]);
  });

  it("rejects a tampered undo entry", async () => {
    const back = await restoreDeskActions(commerceActions, [{ action: "hold_orders", id: SOFIA, data: { fulfillmentStatus: 5 } }], ctx);
    expect(back.done).toEqual([]);
    expect(back.failed).toHaveLength(1);
  });
});
