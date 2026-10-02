import { describe, expect, it } from "vitest";
import { intentFor } from "./intent";

describe("intentFor", () => {
  it("flags investors before anything else", () => {
    expect(intentFor({ message: "Investor looking for two rental-ready units, cash." }).intent).toBe("investor");
  });
  it("spots tenants", () => {
    expect(intentFor({ message: "Looking for a flat to rent near the river." }).intent).toBe("tenant");
  });
  it("labels families and relocations as end buyers", () => {
    expect(intentFor({ message: "We're relocating for work next month." }).intent).toBe("end_buyer");
  });
  it("stays unclear without a signal", () => {
    const r = intentFor({ message: "Send me your listings." });
    expect(r.intent).toBe("unclear");
    expect(r.why).toMatch(/No clear signal/);
  });
});
