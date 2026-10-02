import { describe, expect, it } from "vitest";
import { toCsv, toPdf } from "./export-doc";

const row = {
  id: "p1",
  scheduledFor: "2026-10-01T14:00:00.000Z",
  channel: "Instagram",
  pillar: "Product",
  status: "Approved",
  score: 100,
  caption: 'Huila lot, "small batch"',
  hashtags: "#coffee",
  approvedBy: "Marta",
};

describe("calendar export", () => {
  it("quotes captions that contain commas or quotes", () => {
    const csv = toCsv([row]);
    expect(csv.startsWith("\uFEFFscheduledFor,")).toBe(true);
    expect(csv).toContain('"Huila lot, ""small batch"""');
  });

  it("builds a PDF that names the post and points the font at the right object", () => {
    const pdf = new TextDecoder().decode(toPdf("October grid", [row]));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Huila lot");
    expect(pdf).toContain("/F1 5 0 R");
    expect(pdf).toContain("startxref");
  });
});
