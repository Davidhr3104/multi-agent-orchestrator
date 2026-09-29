import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDemoGate } from "./demo-gate";

const original = process.env.HELIX_DESK_SEED;
beforeEach(() => {
  delete process.env.HELIX_DESK_SEED;
  createDemoGate("t").reset();
});
afterEach(() => {
  if (original === undefined) delete process.env.HELIX_DESK_SEED;
  else process.env.HELIX_DESK_SEED = original;
});

describe("createDemoGate", () => {
  it("starts unknown and not suspended, so the first real read is never blocked", () => {
    const gate = createDemoGate("t");
    expect(gate.mode()).toBe("unknown");
    expect(gate.suspended()).toBe(false);
  });

  it("suspends the data layer in demo mode", () => {
    const gate = createDemoGate("t");
    gate.evaluate({ connected: false, remoteRecords: 0 });
    expect(gate.mode()).toBe("demo");
    expect(gate.suspended()).toBe(true);
  });

  it("goes live and un-suspends when an integration connects, reporting the change", () => {
    const gate = createDemoGate("t");
    gate.evaluate({ connected: false, remoteRecords: 0 });
    const changed = gate.evaluate({ connected: true, remoteRecords: 0 });
    expect(changed).toBe(true);
    expect(gate.mode()).toBe("live");
    expect(gate.suspended()).toBe(false);
  });

  it("goes live when real records already exist remotely", () => {
    const gate = createDemoGate("t");
    gate.evaluate({ connected: false, remoteRecords: 3 });
    expect(gate.mode()).toBe("live");
  });

  it("does not report a change when nothing changed", () => {
    const gate = createDemoGate("t");
    gate.evaluate({ connected: false, remoteRecords: 0 });
    expect(gate.evaluate({ connected: false, remoteRecords: 0 })).toBe(false);
  });

  it("stays live once the operator chose their own data, even with no records yet", () => {
    const gate = createDemoGate("t");
    gate.evaluate({ connected: false, remoteRecords: 0 });
    gate.goLive();
    gate.evaluate({ connected: false, remoteRecords: 0 });
    expect(gate.mode()).toBe("live");
  });

  it("keeps separate state per desk name", () => {
    const a = createDemoGate("a");
    const b = createDemoGate("b");
    a.reset();
    b.reset();
    a.evaluate({ connected: true, remoteRecords: 0 });
    expect(b.mode()).toBe("unknown");
  });

  it("never enters demo when demo is disabled for the deployment", () => {
    process.env.HELIX_DESK_SEED = "off";
    const gate = createDemoGate("t");
    gate.evaluate({ connected: false, remoteRecords: 0 });
    expect(gate.mode()).toBe("live");
  });
});
