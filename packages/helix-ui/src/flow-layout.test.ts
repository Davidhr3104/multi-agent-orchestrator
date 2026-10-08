import { describe, expect, it } from "vitest";
import { GAP_X, NODE_H, NODE_W, PAD, edgePath, layoutFlow } from "./flow-layout";

describe("layoutFlow", () => {
  it("puts each node one column to the right of what feeds it", () => {
    const l = layoutFlow([{ id: "a" }, { id: "b" }, { id: "c" }], [{ from: "a", to: "b" }, { from: "b", to: "c" }]);
    expect(l.positions.get("a")?.col).toBe(0);
    expect(l.positions.get("b")?.col).toBe(1);
    expect(l.positions.get("c")?.col).toBe(2);
    expect(l.positions.get("b")?.x).toBe(PAD + NODE_W + GAP_X);
    expect(l.width).toBe(PAD * 2 + 3 * NODE_W + 2 * GAP_X);
  });

  it("stacks siblings in the same column and sizes the canvas to fit", () => {
    const l = layoutFlow([{ id: "a" }, { id: "b" }, { id: "c" }], [{ from: "a", to: "b" }, { from: "a", to: "c" }]);
    expect(l.positions.get("b")?.col).toBe(1);
    expect(l.positions.get("c")?.col).toBe(1);
    expect(l.positions.get("b")?.row).toBe(0);
    expect(l.positions.get("c")?.row).toBe(1);
    expect(l.height).toBeGreaterThan(PAD * 2 + 2 * NODE_H);
  });

  it("uses the longest path, so a join lands after both of its inputs", () => {
    const l = layoutFlow(
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "a", to: "d" }, { from: "c", to: "d" }]
    );
    expect(l.positions.get("d")?.col).toBe(3);
  });

  it("honours an explicit column and row", () => {
    const l = layoutFlow([{ id: "a" }, { id: "b", col: 3, row: 2 }], []);
    expect(l.positions.get("b")).toMatchObject({ col: 3, row: 2 });
  });

  it("ignores edges that point at unknown nodes and survives a cycle", () => {
    const l = layoutFlow([{ id: "a" }, { id: "b" }], [{ from: "a", to: "zzz" }, { from: "a", to: "b" }, { from: "b", to: "a" }]);
    expect(l.positions.size).toBe(2);
    expect(Number.isFinite(l.width) && Number.isFinite(l.height)).toBe(true);
  });

  it("an empty flow has a finite, small size", () => {
    const l = layoutFlow([], []);
    expect(l.positions.size).toBe(0);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });
});

describe("edgePath", () => {
  const at = (x: number, y: number) => ({ x, y, col: 0, row: 0 });
  it("leaves from the right edge and enters the left edge of the next node", () => {
    const d = edgePath(at(24, 24), at(340, 24));
    expect(d.startsWith(`M${24 + NODE_W},${24 + NODE_H / 2}`)).toBe(true);
    expect(d.endsWith(`340,${24 + NODE_H / 2}`)).toBe(true);
    expect(d).not.toMatch(/NaN/);
  });
  it("goes bottom to top between nodes stacked in one column", () => {
    const d = edgePath(at(24, 24), at(24, 160));
    expect(d.startsWith(`M${24 + NODE_W / 2},${24 + NODE_H}`)).toBe(true);
    expect(d).not.toMatch(/NaN/);
  });
});
