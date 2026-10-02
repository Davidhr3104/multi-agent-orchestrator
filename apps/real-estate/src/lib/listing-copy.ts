import type { Property, PropertyKind } from "./types";

export type ListingCopy = { key: "portal" | "social" | "message"; label: string; text: string };

const KIND: Record<PropertyKind, string> = { apartment: "apartment", house: "house", penthouse: "penthouse", townhouse: "townhouse", loft: "loft" };
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const tag = (s: string) => `#${s.replace(/[^A-Za-z0-9]/g, "")}`;

/**
 * Promotion copy built only from the listing's own fields — no adjectives or claims the agent didn't enter.
 * Helix doesn't publish it anywhere; the agent copies it into their portal, social account or chat.
 */
export function listingCopy(p: Property): ListingCopy[] {
  const specs = `${p.beds} bd · ${p.baths} ba · ${p.sqm} m²`;
  const extras = p.amenities.length ? p.amenities.join(", ") : "";
  const portal = [
    `${p.title} — ${p.zone}`,
    "",
    p.description,
    "",
    `• ${p.beds} bedrooms, ${p.baths} bathrooms, ${p.sqm} m²`,
    extras ? `• ${extras}` : "",
    `• ${p.address}, ${p.zone}`,
    "",
    `Asking ${usd(p.price)}. Message me to book a visit.`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  const social = [
    `New in ${p.zone}: ${p.title}.`,
    `${specs}${p.amenities.length ? ` · ${p.amenities.slice(0, 3).join(" · ")}` : ""}.`,
    `${usd(p.price)}. DM me to book a showing.`,
    "",
    `${tag(p.zone)} ${tag(KIND[p.kind])} ${tag(`${p.zone}RealEstate`)}`,
  ].join("\n");
  const message = `Hi! ${p.title} at ${p.address} (${p.zone}) is on my list: ${p.beds} bedrooms, ${p.sqm} m², ${usd(p.price)}. Want me to book you a visit?`;
  return [
    { key: "portal", label: "Portal listing", text: portal },
    { key: "social", label: "Social post", text: social },
    { key: "message", label: "Short message", text: message },
  ];
}
