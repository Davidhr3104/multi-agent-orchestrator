import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowCanvas, type FlowEdge, type FlowNode } from "./flow-canvas";

const nodes: FlowNode[] = [
  { id: "t", kind: "Trigger", title: "Every day at 9:00 pm", subtitle: "America/Mexico_City" },
  { id: "d", kind: "Data", title: "Daily inbox digest", chips: [{ label: "On success", tone: "ok" }, { label: "On fail", tone: "bad" }] },
  { id: "s", kind: "Send", title: "Slack", tone: "warn", chips: [{ label: "Not connected", tone: "warn" }], action: <a href="/settings">Connect</a> },
  { id: "r", kind: "History", title: "Record the run" },
];
const edges: FlowEdge[] = [
  { from: "t", to: "d" },
  { from: "d", to: "s" },
  { from: "s", to: "r" },
  { from: "d", to: "r", tone: "bad" },
];

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("FlowCanvas", () => {
  it("renders every node card with its kind, title, subtitle, chips and action", () => {
    const out = html(<FlowCanvas nodes={nodes} edges={edges} ariaLabel="Automation flow" />);
    expect(out).toContain('aria-label="Automation flow"');
    for (const t of ["Every day at 9:00 pm", "America/Mexico_City", "Daily inbox digest", "Slack", "Record the run", "On success", "On fail", "Not connected"]) expect(out).toContain(t);
    expect(out).toContain('href="/settings"');
    expect(out).toContain("Trigger");
  });

  it("draws one curve per valid edge and dashes the failure path", () => {
    const out = html(<FlowCanvas nodes={nodes} edges={edges} ariaLabel="x" />);
    expect((out.match(/<path /g) ?? []).length).toBe(4);
    expect(out).toContain("stroke-dasharray");
    expect(out).not.toMatch(/NaN|undefined/);
  });

  it("gives each curve its own gradient in user space so a perfectly horizontal line is still painted", () => {
    const out = html(<FlowCanvas nodes={nodes} edges={edges} ariaLabel="x" />);
    expect((out.match(/<linearGradient/g) ?? []).length).toBe(3);
    expect(out).toContain('gradientUnits="userSpaceOnUse"');
  });

  it("skips an edge to a node that does not exist instead of drawing garbage", () => {
    const out = html(<FlowCanvas nodes={nodes} edges={[...edges, { from: "t", to: "ghost" }]} ariaLabel="x" />);
    expect((out.match(/<path /g) ?? []).length).toBe(4);
    expect(out).not.toMatch(/NaN/);
  });

  it("says so when there is nothing to draw", () => {
    expect(html(<FlowCanvas nodes={[]} edges={[]} ariaLabel="x" />)).toContain("No steps yet");
  });

  it("scrolls sideways inside its own frame instead of widening the page", () => {
    expect(html(<FlowCanvas nodes={nodes} edges={edges} ariaLabel="x" />)).toContain("overflow-x:auto");
  });
});
