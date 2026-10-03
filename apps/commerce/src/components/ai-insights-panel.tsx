"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { AiCostTotals } from "@/lib/claude-usage";
import type { RestockReport } from "@/lib/restock";
import type { StoreSummary } from "@/lib/store-summary";
import { EngineBadge, SourceBadge } from "@/components/ai-badges";
import { ApiErrorLine } from "@/components/operator-notice";

type WithSync<T> = T & { lastShopifySyncAt: string | null };
type Usage = AiCostTotals & { model: string; pricing: { inputUsdPerMTok: number; outputUsdPerMTok: number } };

async function post<T>(url: string): Promise<{ data?: T; error?: string }> {
  const res = await fetch(url, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  return res.ok ? { data: body } : { error: body.error ?? `HTTP ${res.status}` };
}

export function AiCostLine({ refreshKey = 0 }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    void fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((d: Usage) => setUsage(d));
  }, [refreshKey]);
  if (!usage) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      Estimated Claude cost (Helix insights, this server instance): <span className="font-mono text-foreground">${usage.estimatedUsd.toFixed(4)}</span> ·{" "}
      {usage.calls} call{usage.calls === 1 ? "" : "s"} · {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out tokens. Estimate at $
      {usage.pricing.inputUsdPerMTok}/$
      {usage.pricing.outputUsdPerMTok} per million tokens ({usage.model}); your Anthropic invoice is authoritative. Per-order scoring calls are not metered yet.
    </p>
  );
}

export function AiInsightsPanel() {
  const [summary, setSummary] = useState<WithSync<StoreSummary> | null>(null);
  const [restock, setRestock] = useState<WithSync<RestockReport> | null>(null);
  const [busy, setBusy] = useState<"summary" | "restock" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costKey, setCostKey] = useState(0);

  const run = useCallback(async (kind: "summary" | "restock") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "summary") {
        const r = await post<WithSync<StoreSummary>>("/api/ai/store-summary");
        if (r.data) setSummary(r.data);
        else setError(r.error ?? "Failed");
      } else {
        const r = await post<WithSync<RestockReport>>("/api/ai/restock");
        if (r.data) setRestock(r.data);
        else setError(r.error ?? "Failed");
      }
    } finally {
      setBusy(null);
      setCostKey((k) => k + 1);
    }
  }, []);

  return (
    <section className="glass-panel space-y-4 rounded-xl p-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI on your store data</h2>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy !== null}
            onClick={() => void run("summary")}
            className="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-black/[0.04] disabled:opacity-50 dark:hover:bg-white/[0.06]"
          >
            {busy === "summary" ? "Writing…" : "Daily summary"}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => void run("restock")}
            className="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-black/[0.04] disabled:opacity-50 dark:hover:bg-white/[0.06]"
          >
            {busy === "restock" ? "Computing…" : "Restock suggestions"}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Every number is computed by Helix from your orders and products; Claude only writes the prose. If Claude cites a number that is not in the data, its text is discarded.
      </p>
      {error ? <ApiErrorLine error={error} /> : null}

      {summary ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">Daily store summary</span>
            <EngineBadge engine={summary.engine} />
            <SourceBadge source={summary.source} lastSyncAt={summary.lastShopifySyncAt} />
          </div>
          <p className="leading-relaxed text-secondary-foreground">{summary.summary}</p>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span>orders {summary.metrics.windowHours}h: {summary.metrics.ordersInWindow}</span>
            {Object.entries(summary.metrics.revenueByCurrency).map(([cur, v]) => (
              <span key={cur}>
                revenue: {v.toFixed(2)} {cur}
              </span>
            ))}
            <span>awaiting review: {summary.metrics.awaitingReviewCount}</span>
            <span>at risk: {summary.metrics.atRiskUsd.toFixed(2)}</span>
            <span>low stock: {summary.metrics.lowStockCount}</span>
          </div>
          {summary.engineNote ? <p className="text-[11px] text-muted-foreground">{summary.engineNote}</p> : null}
        </div>
      ) : null}

      {restock ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">Restock suggestions (drafts)</span>
            <EngineBadge engine={restock.engine} />
            <SourceBadge source={restock.source} lastSyncAt={restock.lastShopifySyncAt} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Velocity = units sold ÷ {restock.observedDays} days ({restock.ordersInWindow} orders in the last {restock.windowDays} days). Quantity covers {restock.coverageDays} days of sales.
            Nothing is sent to a supplier — “Quick Restock PO” in the restock queue only records an internal draft.
          </p>
          {restock.lines.length === 0 ? (
            <p className="text-muted-foreground">No product is due for restock.</p>
          ) : (
            <ul className="space-y-1.5">
              {restock.lines.map((l) => (
                <li key={l.productId} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {l.title} <span className="font-mono text-muted-foreground">{l.sku}</span>
                    </span>
                    <span className="font-mono text-foreground">suggest {l.suggestedQuantity}</span>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    stock {l.currentInventory} · reorder pt {l.reorderPoint} · sold {l.unitsSold} · {l.perDay}/day · cover {l.daysOfCover ?? "—"} d
                  </p>
                  <p className="mt-1 text-secondary-foreground">{l.reasoning}</p>
                </li>
              ))}
            </ul>
          )}
          {restock.engineNote ? <p className="text-[11px] text-muted-foreground">{restock.engineNote}</p> : null}
        </div>
      ) : null}

      <AiCostLine refreshKey={costKey} />
    </section>
  );
}
