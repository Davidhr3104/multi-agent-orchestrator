export const PRACTICE_OPTIONS = [
  "Personal injury",
  "Medical malpractice",
  "Workers' compensation",
  "Clinical analysis / BEAR",
  "SPI coding",
  "Mass tort",
] as const;

export const JURISDICTIONS = [
  "Texas",
  "California",
  "New York",
  "Florida",
  "Multi-state US",
  "Federal",
] as const;

export type StructuredProfile = {
  practiceAreas: string[];
  budgetMin: number;
  budgetMax: number;
  jurisdiction: string;
  exclusions: string[];
};

export const DEFAULT_STRUCTURED: StructuredProfile = {
  practiceAreas: ["Personal injury", "Clinical analysis / BEAR"],
  budgetMin: 25_000,
  budgetMax: 150_000,
  jurisdiction: "Texas",
  exclusions: ["Pure software / IT", "Government Kubernetes"],
};

export function parseProfile(text: string): StructuredProfile {
  const next = { ...DEFAULT_STRUCTURED, practiceAreas: [...DEFAULT_STRUCTURED.practiceAreas], exclusions: [...DEFAULT_STRUCTURED.exclusions] };
  if (!text.trim()) return next;
  const areas = text.match(/Practice areas:\s*(.+)/i);
  if (areas) {
    next.practiceAreas = areas[1]
      .split(/,|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const budget = text.match(/Budget:\s*\$?([\d,]+)\s*[–-]\s*\$?([\d,]+)/i);
  if (budget) {
    next.budgetMin = Number(budget[1].replace(/,/g, "")) || next.budgetMin;
    next.budgetMax = Number(budget[2].replace(/,/g, "")) || next.budgetMax;
  }
  const jur = text.match(/Jurisdiction:\s*(.+)/i);
  if (jur) next.jurisdiction = jur[1].trim();
  const ex = text.match(/Exclusions:\s*(.+)/i);
  if (ex) {
    next.exclusions = ex[1]
      .split(/,|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return next;
}

export function serializeProfile(p: StructuredProfile): string {
  const money = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return [
    `Injury / clinical RFP desk. We bid when the work matches this profile.`,
    `Practice areas: ${p.practiceAreas.join(", ") || "unspecified"}`,
    `Budget: ${money(p.budgetMin)}–${money(p.budgetMax)}`,
    `Jurisdiction: ${p.jurisdiction}`,
    `Exclusions: ${p.exclusions.join(", ") || "none"}`,
  ].join("\n");
}
