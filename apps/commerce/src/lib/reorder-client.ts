import type { ReorderRequest, StoredProduct } from "@helix/core";
import { OPERATOR_REQUIRED } from "@/components/operator-notice";

export type DraftResult = { created: ReorderRequest[]; failures: string[]; operatorError: string | null };

/**
 * Creates draft reorder requests through /api/reorders, one per product, after the operator has
 * confirmed. Stops at the first 401 so the caller can show the unlock notice.
 */
export async function createDraftReorders(items: readonly Pick<StoredProduct, "id" | "title">[]): Promise<DraftResult> {
  const out: DraftResult = { created: [], failures: [], operatorError: null };
  try {
    for (const p of items) {
      const res = await fetch("/api/reorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { reorder?: ReorderRequest; error?: string };
      if (res.status === 401) {
        out.operatorError = data.error ?? OPERATOR_REQUIRED;
        break;
      }
      if (!res.ok || !data.reorder) {
        out.failures.push(`${p.title}: ${data.error ?? `HTTP ${res.status}`}`);
        continue;
      }
      out.created.push(data.reorder);
    }
  } catch (err) {
    out.failures.push(err instanceof Error ? err.message : "Request failed");
  }
  return out;
}

/** Toast text that reports exactly what the API did. */
export function draftResultMessage(result: DraftResult, requested: number): string | null {
  if (result.created.length === 0) return null;
  const units = result.created.reduce((s, r) => s + r.quantitySuggested, 0);
  return `Created ${result.created.length} of ${requested} draft reorder ${requested === 1 ? "request" : "requests"} (${units} units). Drafts only — nothing was sent to a supplier or Shopify.`;
}
