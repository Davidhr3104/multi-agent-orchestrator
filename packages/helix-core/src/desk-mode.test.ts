import { afterEach, describe, expect, it } from "vitest";
import { demoAvailable, isDemoRecordId, resolveDeskMode } from "./desk-mode";

const original = process.env.HELIX_DESK_SEED;
afterEach(() => {
  if (original === undefined) delete process.env.HELIX_DESK_SEED;
  else process.env.HELIX_DESK_SEED = original;
});

describe("demoAvailable", () => {
  it("is on by default and when set to demo", () => {
    delete process.env.HELIX_DESK_SEED;
    expect(demoAvailable()).toBe(true);
    process.env.HELIX_DESK_SEED = "demo";
    expect(demoAvailable()).toBe(true);
  });

  it("is off for off/empty, case- and space-insensitive", () => {
    for (const v of ["off", "OFF", " empty ", "Empty"]) {
      process.env.HELIX_DESK_SEED = v;
      expect(demoAvailable()).toBe(false);
    }
  });
});

describe("resolveDeskMode", () => {
  it("shows demo when nothing is connected and there are no real records", () => {
    delete process.env.HELIX_DESK_SEED;
    expect(resolveDeskMode({ connected: false, realRecords: 0 })).toBe("demo");
  });

  it("goes live as soon as an integration is connected", () => {
    delete process.env.HELIX_DESK_SEED;
    expect(resolveDeskMode({ connected: true, realRecords: 0 })).toBe("live");
  });

  it("goes live as soon as a real record exists", () => {
    delete process.env.HELIX_DESK_SEED;
    expect(resolveDeskMode({ connected: false, realRecords: 1 })).toBe("live");
  });

  it("stays live (empty) when demo is disabled, so a client desk never shows fake data", () => {
    process.env.HELIX_DESK_SEED = "off";
    expect(resolveDeskMode({ connected: false, realRecords: 0 })).toBe("live");
  });
});

describe("isDemoRecordId", () => {
  it("recognises seed ids only", () => {
    expect(isDemoRecordId("seed-mayanorthwin")).toBe(true);
    expect(isDemoRecordId("lead_123")).toBe(false);
  });
});
