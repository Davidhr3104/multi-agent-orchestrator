import { describe, it, expect } from "vitest";
import { parseGhlWebhook, parseLeadIngest, tierFromScore } from "./pipeline";

describe("parseLeadIngest", () => {
  it("accepts attribution and home-services fields from snake or camel case", () => {
    const parsed = parseLeadIngest({
      name: "Maya Chen",
      email: "maya@northwindhvac.com",
      phone: "2145550101",
      trade: "HVAC",
      zip: "75001",
      campaign_id: "meta-hvac-dallas",
      utm_source: "facebook",
      utm_campaign: "summer-ac",
    });
    expect(typeof parsed).not.toBe("string");
    if (typeof parsed === "string") return;
    expect(parsed.phone).toBe("2145550101");
    expect(parsed.trade).toBe("HVAC");
    expect(parsed.campaignId).toBe("meta-hvac-dallas");
    expect(parsed.utmSource).toBe("facebook");
  });
});

describe("parseGhlWebhook", () => {
  it("maps nested GHL form payloads onto ingest fields", () => {
    const parsed = parseGhlWebhook({
      first_name: "Luis",
      last_name: "Ortega",
      email: "luis@ortegraland.com",
      phone: "4695550199",
      source: "Facebook Lead Form",
      campaign: { id: "ghl-land-01" },
      customData: { trade: "landscaping", zip: "75201", message: "Need weekly mow in Dallas." },
    });
    expect(typeof parsed).not.toBe("string");
    if (typeof parsed === "string") return;
    expect(parsed.name).toBe("Luis Ortega");
    expect(parsed.campaignId).toBe("ghl-land-01");
    expect(parsed.trade).toBe("landscaping");
    expect(parsed.message).toContain("weekly mow");
  });
});

describe("tierFromScore", () => {
  it("maps the catalog thresholds", () => {
    expect(tierFromScore(75)).toBe("hot");
    expect(tierFromScore(50)).toBe("warm");
    expect(tierFromScore(49)).toBe("cold");
  });
});
