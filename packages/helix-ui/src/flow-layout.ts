/** Pure layout for the flow canvas: where each node sits and how the curves between them are drawn. */

export const NODE_W = 216;
export const NODE_H = 128;
export const GAP_X = 56;
export const GAP_Y = 28;
export const PAD = 24;

export type LayoutNode = { id: string; col?: number; row?: number };
export type LayoutEdge = { from: string; to: string };
export type Pos = { x: number; y: number; col: number; row: number };
export type Layout = { positions: Map<string, Pos>; width: number; height: number };

/**
 * Columns come from the longest path of edges feeding a node, so a step always sits to the right of what
 * triggers it. Rows are the order within a column. An explicit `col`/`row` wins. Unknown endpoints are
 * ignored and the depth search is capped, so a bad or cyclic graph still renders.
 */
export function layoutFlow(nodes: readonly LayoutNode[], edges: readonly LayoutEdge[]): Layout {
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of valid) {
      const next = (depth.get(e.from) ?? 0) + 1;
      if (next > (depth.get(e.to) ?? 0) && next <= nodes.length) {
        depth.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const colOf = (n: LayoutNode) => n.col ?? depth.get(n.id) ?? 0;
  const used = new Map<number, number>();
  const positions = new Map<string, Pos>();
  let maxCol = 0;
  let maxRow = 0;
  for (const n of nodes) {
    const col = colOf(n);
    const row = n.row ?? used.get(col) ?? 0;
    used.set(col, Math.max((used.get(col) ?? 0), row + 1));
    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, row);
    positions.set(n.id, { x: PAD + col * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y), col, row });
  }
  const cols = nodes.length ? maxCol + 1 : 1;
  const rows = nodes.length ? maxRow + 1 : 1;
  return { positions, width: PAD * 2 + cols * NODE_W + (cols - 1) * GAP_X, height: PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y };
}

/** SVG cubic from one node to the next: right edge to left edge, or bottom to top when stacked in one column. */
export function edgePath(from: Pos, to: Pos): string {
  if (to.x > from.x) {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const dx = Math.max(40, (x2 - x1) / 2);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  }
  const x1 = from.x + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x + NODE_W / 2;
  const y2 = to.y;
  const dy = Math.max(30, Math.abs(y2 - y1) / 2);
  return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
}
