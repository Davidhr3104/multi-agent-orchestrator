import type { AdPlatform, CampaignAction, StoredCampaign } from "@helix/core";

export function money(n: number | null | undefined, digits = 0) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function compactCount(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function platformLabel(platform: AdPlatform) {
  if (platform === "meta") return "Meta";
  if (platform === "google") return "Google";
  return "Other";
}

export function recLabel(c: StoredCampaign) {
  if (c.action === "pause") return "Pause";
  if (c.action === "scale") return "Scale";
  return c.needsReview ? "Keep · HITL" : "Keep";
}

export function recTone(action: CampaignAction) {
  if (action === "pause") {
    return {
      hex: "#D9605F",
      stroke: "#FF8585",
      text: "text-[#FB7185]",
      bg: "bg-[rgba(217,96,95,0.15)]",
      border: "border-[rgba(217,96,95,0.25)]",
      fill: "bg-[#D9605F]",
    };
  }
  if (action === "scale") {
    return {
      hex: "#3BAF7E",
      stroke: "#6EE7B7",
      text: "text-[#34D399]",
      bg: "bg-[rgba(59,175,126,0.15)]",
      border: "border-[rgba(59,175,126,0.25)]",
      fill: "bg-[#3BAF7E]",
    };
  }
  return {
    hex: "#D9A441",
    stroke: "#FDE047",
    text: "text-[#FBBF24]",
    bg: "bg-[rgba(217,164,65,0.15)]",
    border: "border-[rgba(217,164,65,0.25)]",
    fill: "bg-[#D9A441]",
  };
}

export function letterIndex(i: number) {
  return String.fromCharCode(65 + (i % 26));
}
