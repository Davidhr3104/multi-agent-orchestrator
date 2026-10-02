import type { Pillar } from "./types";

export type StockFrame = { id: string; pillar: Pillar; label: string; url: string };

/** Curated stills, one set per content pillar. These are stock frames, not generated images. */
export const STOCK: StockFrame[] = [
  { id: "product-bag", pillar: "product", label: "Product still, morning light", url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=70" },
  { id: "product-pour", pillar: "product", label: "Pour shot on a counter", url: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=70" },
  { id: "bts-hands", pillar: "behind_the_scenes", label: "Hands at work", url: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=70" },
  { id: "bts-team", pillar: "behind_the_scenes", label: "Team in the workspace", url: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=70" },
  { id: "edu-notes", pillar: "education", label: "Notes and a desk", url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=70" },
  { id: "edu-board", pillar: "education", label: "Explanation on a board", url: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=70" },
  { id: "community-table", pillar: "community", label: "People around a table", url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=70" },
  { id: "community-toast", pillar: "community", label: "A shared moment", url: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=70" },
  { id: "promo-gift", pillar: "promo", label: "A gift-ready still", url: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=70" },
  { id: "promo-bag", pillar: "promo", label: "Packaged offer", url: "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=70" },
];

export function stockForPillar(pillar: Pillar): StockFrame[] {
  return STOCK.filter((s) => s.pillar === pillar);
}

export function stockById(id: string): StockFrame | undefined {
  return STOCK.find((s) => s.id === id);
}

/** A prompt a person can paste into an image model. This desk does not generate the image. */
export function visualPrompt(pillar: Pillar, caption: string, brand: string): string {
  const scene = caption.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "").slice(0, 140);
  const pillarLine: Record<Pillar, string> = {
    product: "a clear product still",
    behind_the_scenes: "a candid behind-the-scenes moment",
    education: "a clean teaching scene",
    community: "people together, unposed",
    promo: "a simple offer still with no fake discount badges",
  };
  return `Editorial photo for ${brand}: ${pillarLine[pillar]}. Scene inspired by: ${scene}. Natural light, no logos, no text overlay.`;
}
