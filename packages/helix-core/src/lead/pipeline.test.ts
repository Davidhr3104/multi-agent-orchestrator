import { describe, expect, it } from "vitest";
import { parseLeadIngest } from "./pipeline";

describe("parseLeadIngest", () => {
  it("accepts the Helix for Leads sample ingest shape", () => {
    const parsed = parseLeadIngest({
      name: "Maya Torres",
      email: "maya.torres@example-riveroak.com",
      phone: "+1-214-555-0142",
      company: "River Oak Properties",
      title: "Facilities Manager",
      source: "website-form",
      message: "Need quarterly HVAC maintenance quotes for a 42-unit multifamily property in Plano.",
      budget: 7000,
      timeline: "this-month",
      city: "Plano",
      state: "TX",
      tags: ["hvac", "multifamily", "inbound"],
    });
    expect(typeof parsed).toBe("object");
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.name).toBe("Maya Torres");
    expect(parsed.email).toBe("maya.torres@example-riveroak.com");
    expect(parsed.budget).toBe("7000");
    expect(parsed.region).toBe("Plano, TX");
    expect(parsed.message).toContain("HVAC");
    expect(parsed.message).toContain("Title: Facilities Manager");
    expect(parsed.message).toContain("Tags: hvac, multifamily, inbound");
  });
});
