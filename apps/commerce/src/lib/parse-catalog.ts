import type { ProductInput } from "@helix/core";
import { parseCsv } from "@/lib/csv";

export const MAX_PRODUCT_IMPORT = 80;

function num(value: string | undefined, fallback = 0): number {
  const n = Number(String(value ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}

export function parseProductCatalogCsv(text: string): { inputs: ProductInput[] } | { error: string } {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { error: "CSV needs a header and at least one product row." };
  }
  if (rows.length > MAX_PRODUCT_IMPORT) {
    return { error: `Too many rows (${rows.length}). Max ${MAX_PRODUCT_IMPORT} per import.` };
  }

  const inputs: ProductInput[] = [];
  for (const row of rows) {
    const sku = (row.sku ?? "").trim();
    const title = (row.title ?? "").trim();
    if (!sku || !title) continue;
    const onHand = num(row.on_hand ?? row.inventory ?? row.currentinventory);
    const reorder = num(row.reorder_point ?? row.reorderpoint, 0);
    const price = num(row.price_usd ?? row.price, 0);
    const velocityRaw = row.sales_velocity ?? row.velocity;
    const salesVelocity =
      velocityRaw != null && velocityRaw !== ""
        ? num(velocityRaw, 1)
        : Math.max(0.3, Number((reorder / Math.max(onHand, 1)).toFixed(2)));
    inputs.push({
      shopifyProductId: `gid://shopify/Product/${sku}`,
      title,
      sku,
      currentInventory: onHand,
      reorderPoint: reorder,
      price,
      salesVelocity,
    });
  }
  if (inputs.length === 0) {
    return { error: "No rows with both sku and title." };
  }
  return { inputs };
}
