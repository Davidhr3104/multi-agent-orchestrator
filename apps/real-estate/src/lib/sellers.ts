import type { ScoredLead } from "./store";
import type { Property, Seller, SellerStage } from "./types";

export const SELLER_STAGE_LABEL: Record<SellerStage, string> = {
  prospect: "Prospect",
  valuation: "Price opinion",
  agreement: "Agreement",
  listed: "Listed",
  lost: "Lost",
};

/** Stages shown as pipeline columns; "lost" is listed separately. */
export const SELLER_BOARD: SellerStage[] = ["prospect", "valuation", "agreement", "listed"];

export type DeskComps = { basis: Property[]; sameKind: boolean; minPerSqm: number; maxPerSqm: number; low: number; high: number };

/**
 * Price-per-m² range from the agent's own listings in the same zone (same kind when there are at least two).
 * It's a conversation starter, not a valuation: no sales records or AVM are connected.
 */
export function deskComps(s: Pick<Seller, "zone" | "kind" | "sqm" | "propertyId">, props: Property[]): DeskComps | null {
  const zone = props.filter((p) => p.zone === s.zone && p.status !== "draft" && p.id !== s.propertyId && p.sqm > 0);
  const kind = zone.filter((p) => p.kind === s.kind);
  const sameKind = kind.length >= 2;
  const basis = sameKind ? kind : zone;
  if (basis.length === 0 || s.sqm <= 0) return null;
  const per = basis.map((p) => p.price / p.sqm);
  const minPerSqm = Math.round(Math.min(...per));
  const maxPerSqm = Math.round(Math.max(...per));
  const round = (n: number) => Math.round(n / 5_000) * 5_000;
  return { basis, sameKind, minPerSqm, maxPerSqm, low: round(minPerSqm * s.sqm), high: round(maxPerSqm * s.sqm) };
}

/** Open buyers whose brief this seller's property could fit: zone, bedrooms and budget (within 5% of the ask). */
export function buyersForSeller(s: Pick<Seller, "zone" | "beds" | "askingPrice">, leads: ScoredLead[]): ScoredLead[] {
  return leads.filter((l) => {
    if (l.stage === "closed" || l.stage === "archived" || l.budget <= 0) return false;
    if (l.zones.length && !l.zones.includes(s.zone)) return false;
    if (l.bedsMin > s.beds) return false;
    return s.askingPrice === null || l.budget >= s.askingPrice * 0.95;
  });
}
