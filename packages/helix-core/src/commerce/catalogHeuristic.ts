import type { CatalogEnrichResult, CatalogIssue, CatalogRowInput } from "./types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function slugTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function enrichCatalogHeuristic(row: CatalogRowInput): CatalogEnrichResult {
  const issues: CatalogIssue[] = [];
  if (!row.sku.trim()) issues.push({ field: "sku", message: "SKU missing — cannot upsert a catalog row." });
  if (!row.title.trim()) issues.push({ field: "title", message: "Title missing." });
  if (!(row.price > 0)) issues.push({ field: "price", message: "Price missing or zero." });
  if (row.inventory == null) issues.push({ field: "inventory", message: "Inventory not provided." });
  if (!row.description?.trim()) issues.push({ field: "description", message: "Description thin — SEO copy is a draft." });

  const filled = 5 - issues.length;
  const completeness = clamp01(filled / 5);
  const seoTitle = (row.title.trim() || "Untitled product").slice(0, 70);
  const seoDescription = (
    row.description?.trim() ||
    `${seoTitle}${row.vendor ? ` by ${row.vendor}` : ""}. Review before publishing to the storefront.`
  ).slice(0, 160);
  const tags = [row.vendor, row.sku, seoTitle.split(" ")[0]]
    .filter((t): t is string => Boolean(t && t.trim()))
    .map(slugTag)
    .filter(Boolean)
    .slice(0, 6);

  return {
    seoTitle,
    seoDescription,
    tags,
    completeness,
    issues,
    needsReview: completeness < 0.8 || issues.some((i) => i.field === "sku" || i.field === "title" || i.field === "price"),
    engine: "heuristic",
    demoMode: true,
  };
}
