import { describe, expect, it } from "vitest";
import { describeRule } from "../components/routing-rules";

describe("describeRule", () => {
  it("reads an amount rule as a sentence, never as If \"1000\"", () => {
    const text = describeRule({ id: "r", ifContains: "", minAmount: 1000, then: "urgent", enabled: true });
    expect(text).toBe("When an email mentions an amount of $1,000 or more, mark it urgent.");
  });
  it("combines phrase, amount and destination", () => {
    const text = describeRule({ id: "r", ifContains: "invoice", minAmount: 500, then: "route", routeTo: "Finance", enabled: true });
    expect(text).toContain('"invoice"');
    expect(text).toContain("to Finance");
  });
});
