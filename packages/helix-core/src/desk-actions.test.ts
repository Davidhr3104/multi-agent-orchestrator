import { describe, expect, it, vi } from "vitest";
import { handleExecuteBody, restoreDeskActions, runDeskAction, runWithPolicy, type DeskActionRegistry } from "./desk-actions";

type Ctx = { db: Map<string, { status: string }> };

function makeRegistry(level: "auto" | "confirm" = "auto", reasons: string[] = []) {
  const assess = vi.fn(async () => ({ level, reasons }));
  const registry: DeskActionRegistry<Ctx> = {
    hold: {
      name: "hold",
      assess,
      snapshot: async (id, ctx) => (ctx.db.has(id) ? { ...ctx.db.get(id)! } : null),
      apply: async (id, _p, ctx) => {
        const row = ctx.db.get(id);
        if (!row) return false;
        row.status = "held";
        return true;
      },
      restore: async (id, data, ctx) => {
        if (!ctx.db.has(id)) return false;
        ctx.db.set(id, data as { status: string });
        return true;
      },
      resultText: (done, failed) => `Held ${done.length}.${failed ? ` ${failed} failed.` : ""}`,
      announce: (labels) => `Helix AI held ${labels.join(", ")}`,
    },
    strict: {
      name: "strict",
      assess: async () => ({ level: "auto", reasons: [] }),
      snapshot: async () => ({}),
      apply: async () => true,
      restore: async () => true,
      resultText: () => "",
      announce: () => "",
      validate: (p) => (typeof p.note === "string" ? null : "note is required"),
    },
  };
  return { registry, assess };
}

const fresh = (): Ctx => ({ db: new Map([["a", { status: "open" }], ["b", { status: "open" }]]) });

describe("runDeskAction", () => {
  it("applies to every target, snapshots first, and reports each failure", async () => {
    const { registry } = makeRegistry();
    const ctx = fresh();
    const r = await runDeskAction(registry, { action: "hold", targetIds: ["a", "ghost", "b"] }, ctx);
    expect(r.done).toEqual(["a", "b"]);
    expect(r.failed).toEqual([{ id: "ghost", error: "Not found" }]);
    expect(r.undo).toEqual([
      { action: "hold", id: "a", data: { status: "open" } },
      { action: "hold", id: "b", data: { status: "open" } },
    ]);
    expect(r.resultText).toBe("Held 2. 1 failed.");
    expect(ctx.db.get("a")?.status).toBe("held");
  });

  it("turns a throwing apply into a visible failure instead of aborting the batch", async () => {
    const { registry } = makeRegistry();
    registry.hold.apply = async (id) => {
      if (id === "a") throw new Error("db down");
      return true;
    };
    const r = await runDeskAction(registry, { action: "hold", targetIds: ["a", "b"] }, fresh());
    expect(r.failed).toEqual([{ id: "a", error: "db down" }]);
    expect(r.done).toEqual(["b"]);
  });

  it("rejects unknown actions and invalid params before touching anything", async () => {
    const { registry } = makeRegistry();
    await expect(runDeskAction(registry, { action: "nope", targetIds: ["a"] }, fresh())).rejects.toThrow(/unsupported/i);
    await expect(runDeskAction(registry, { action: "strict", targetIds: ["a"], params: {} }, fresh())).rejects.toThrow(/note is required/);
  });
});

describe("restoreDeskActions", () => {
  it("undoes what an action did", async () => {
    const { registry } = makeRegistry();
    const ctx = fresh();
    const r = await runDeskAction(registry, { action: "hold", targetIds: ["a"] }, ctx);
    const back = await restoreDeskActions(registry, r.undo, ctx);
    expect(back.done).toEqual(["a"]);
    expect(ctx.db.get("a")?.status).toBe("open");
  });

  it("refuses malformed or unknown entries loudly", async () => {
    const { registry } = makeRegistry();
    const back = await restoreDeskActions(registry, [null, { action: "zzz", id: "a" }, { action: "hold" }], fresh());
    expect(back.done).toEqual([]);
    expect(back.failed).toHaveLength(3);
  });
});

describe("runWithPolicy", () => {
  const proposal = { action: "hold", summary: "Hold a", targets: [{ id: "a", label: "Order A" }] };

  it("runs an auto-cleared action immediately and returns an announcement and undo", async () => {
    const { registry } = makeRegistry("auto");
    const ctx = fresh();
    const r = await runWithPolicy(registry, proposal, ctx, { canAutoRun: true });
    expect("executed" in r && r.executed.announce).toBe("Helix AI held Order A");
    expect("executed" in r && r.executed.undo).toHaveLength(1);
    expect(ctx.db.get("a")?.status).toBe("held");
  });

  it("marks computed-only actions as not undoable, and normal ones as undoable", async () => {
    const { registry } = makeRegistry("auto");
    registry.hold.reversible = false;
    const ctx = fresh();
    const r = await runWithPolicy(registry, proposal, ctx, { canAutoRun: true });
    expect("executed" in r && r.executed.undoable).toBe(false);
    const { registry: normal } = makeRegistry("auto");
    const n = await runWithPolicy(normal, proposal, fresh(), { canAutoRun: true });
    expect("executed" in n && n.executed.undoable).toBe(true);
  });

  it("keeps a confirm-level action as a proposal with the reasons, and changes nothing", async () => {
    const { registry } = makeRegistry("confirm", ["High-risk order"]);
    const ctx = fresh();
    const r = await runWithPolicy(registry, proposal, ctx, { canAutoRun: true });
    expect("proposal" in r && r.reasons).toEqual(["High-risk order"]);
    expect(ctx.db.get("a")?.status).toBe("open");
  });

  it("does not auto-run when the caller lacks authorization, even for a safe action", async () => {
    const { registry } = makeRegistry("auto");
    const ctx = fresh();
    const r = await runWithPolicy(registry, proposal, ctx, { canAutoRun: false });
    expect("proposal" in r && r.reasons).toEqual(["Operator authorization required"]);
    expect(ctx.db.get("a")?.status).toBe("open");
  });

  it("treats a throwing policy, an unknown action, or no targets as needing confirmation", async () => {
    const { registry, assess } = makeRegistry("auto");
    assess.mockRejectedValueOnce(new Error("boom"));
    const ctx = fresh();
    const a = await runWithPolicy(registry, proposal, ctx, { canAutoRun: true });
    expect("proposal" in a && a.reasons[0]).toMatch(/risk check failed: boom/i);
    const b = await runWithPolicy(registry, { ...proposal, action: "ghost" }, ctx, { canAutoRun: true });
    expect("proposal" in b).toBe(true);
    const c = await runWithPolicy(registry, { ...proposal, targets: [] }, ctx, { canAutoRun: true });
    expect("proposal" in c).toBe(true);
    expect(ctx.db.get("a")?.status).toBe("open");
  });
});

describe("handleExecuteBody", () => {
  it("runs an action and returns the announcement built from the supplied labels", async () => {
    const { registry } = makeRegistry();
    const r = await handleExecuteBody(registry, { action: "hold", targetIds: ["a"], labels: ["Order A"] }, fresh());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ done: ["a"], announce: "Helix AI held Order A" });
  });

  it("restores undo entries", async () => {
    const { registry } = makeRegistry();
    const ctx = fresh();
    const ran = await handleExecuteBody(registry, { action: "hold", targetIds: ["a"] }, ctx);
    const back = await handleExecuteBody(registry, { action: "restore", entries: (ran.body as { undo: unknown[] }).undo }, ctx);
    expect(back.body).toMatchObject({ done: ["a"] });
    expect(ctx.db.get("a")?.status).toBe("open");
  });

  it("rejects malformed bodies with a 400 and a reason, and never runs anything", async () => {
    const { registry } = makeRegistry();
    const ctx = fresh();
    for (const body of [null, { action: "nope", targetIds: ["a"] }, { action: "hold" }, { action: "hold", targetIds: [1] }, { action: "hold", targetIds: [] }, { action: "restore", entries: [] }]) {
      expect((await handleExecuteBody(registry, body, ctx)).status).toBe(400);
    }
    expect(ctx.db.get("a")?.status).toBe("open");
  });

  it("reports validation failures from the action as a 400", async () => {
    const { registry } = makeRegistry();
    const r = await handleExecuteBody(registry, { action: "strict", targetIds: ["a"] }, fresh());
    expect(r).toMatchObject({ status: 400, body: { error: "note is required" } });
  });
});
