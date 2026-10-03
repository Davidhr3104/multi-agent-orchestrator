"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReorderRequest, StoredOrder, StoredProduct } from "@helix/core";
import { Boxes, Download, Eye, LayoutGrid, Rows3, ShieldCheck, ShoppingCart, Sparkles, TriangleAlert, TrendingDown } from "lucide-react";
import { Donut } from "@helix/ui";
import { AiToast, DemoBanner, useAiDeskEvents } from "@/components/ai-desk-events";
import { DepletionChart } from "@/components/depletion-chart";
import { DeskChartCard, useDeskMode } from "@/components/desk-mode";
import { AskAiDrawer } from "@/components/ask-ai-drawer";
import { DenseTable, ProductCard } from "@/components/inventory-catalog";
import { ProductDetailDrawer } from "@/components/product-detail-drawer";
import { ApiErrorLine } from "@/components/operator-notice";
import { formatCurrency } from "@/lib/format";
import { createDraftReorders, draftResultMessage } from "@/lib/reorder-client";
import {
  CRITICAL_COVER_DAYS,
  HEALTH_COLOR,
  HEALTH_LABEL,
  HEALTH_ORDER,
  OVERSTOCK_COVER_DAYS,
  RESTOCK_COVERAGE_DAYS,
  RESTOCK_LEAD_DAYS,
  coverDays,
  depletionTrajectory,
  healthTier,
  inventoryCsv,
  openReorderFor,
  reorderSuggestion,
  revenueAtRisk,
  summarizeInventory,
  type HealthTier,
} from "@/lib/inventory-metrics";
import { cn } from "@/lib/utils";

type View = "cards" | "grid";
type StatusFilter = "all" | HealthTier;
type RestockFilter = "all" | "due" | "open" | "none";
type Sort = "risk" | "cover" | "revenue" | "units" | "name";

const TIER_RANK: Record<HealthTier, number> = { urgent: 0, watch: 1, optimal: 2, overstock: 3 };

const SORTS: Record<Sort, (a: StoredProduct, b: StoredProduct) => number> = {
  risk: (a, b) => TIER_RANK[healthTier(a)] - TIER_RANK[healthTier(b)] || (coverDays(a) ?? Infinity) - (coverDays(b) ?? Infinity),
  cover: (a, b) => (coverDays(a) ?? Infinity) - (coverDays(b) ?? Infinity),
  revenue: (a, b) => revenueAtRisk(b) - revenueAtRisk(a),
  units: (a, b) => b.currentInventory - a.currentInventory,
  name: (a, b) => a.title.localeCompare(b.title),
};

function names(list: readonly StoredProduct[], max = 2): string {
  const shown = list.slice(0, max).map((p) => p.title);
  const rest = list.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(" and ");
}

function dayLabel(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InventoryPage() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [reorders, setReorders] = useState<ReorderRequest[]>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("cards");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [restock, setRestock] = useState<RestockFilter>("all");
  const [sort, setSort] = useState<Sort>("risk");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ title: string; items: StoredProduct[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState<string | undefined>(undefined);
  const preselected = useRef(false);
  const deskMode = useDeskMode();

  async function refresh() {
    const [productsRes, reordersRes, ordersRes] = await Promise.all([fetch("/api/products"), fetch("/api/reorders"), fetch("/api/orders")]);
    const p = (await productsRes.json()) as { products: StoredProduct[] };
    const r = (await reordersRes.json()) as { reorders: ReorderRequest[] };
    const o = (await ordersRes.json()) as { orders: StoredOrder[] };
    setProducts(p.products);
    setReorders(r.reorders);
    setOrders(o.orders);
    setLoaded(true);
    if (!preselected.current && p.products.length > 0) {
      preselected.current = true;
      setSelected(new Set(p.products.filter((x) => x.restockRecommended && !openReorderFor(r.reorders, x.id)).map((x) => x.id)));
    }
  }

  const { toast } = useAiDeskEvents(refresh);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const summary = useMemo(() => summarizeInventory(products), [products]);
  const trajectory = useMemo(() => depletionTrajectory(products, orders), [products, orders]);

  const due = useMemo(
    () => [...products].filter((p) => p.restockRecommended).sort(SORTS.risk),
    [products]
  );
  const dueWithoutPo = due.filter((p) => !openReorderFor(reorders, p.id));
  const planUnits = dueWithoutPo.reduce((s, p) => s + reorderSuggestion(p), 0);
  const planRisk = dueWithoutPo.reduce((s, p) => s + revenueAtRisk(p), 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .filter((p) => status === "all" || healthTier(p) === status)
      .filter((p) => {
        if (restock === "all") return true;
        const open = Boolean(openReorderFor(reorders, p.id));
        if (restock === "due") return p.restockRecommended && !open;
        return restock === "open" ? open : !open;
      })
      .sort(SORTS[sort]);
  }, [products, reorders, query, status, restock, sort]);

  const selectable = (p: StoredProduct) => reorderSuggestion(p) > 0 && !openReorderFor(reorders, p.id);
  const selectedItems = products.filter((p) => selected.has(p.id) && selectable(p));
  const selectedUnits = selectedItems.reduce((s, p) => s + reorderSuggestion(p), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of shown) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  function exportCsv() {
    const blob = new Blob([inventoryCsv(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Runs only after the operator confirms the dialog. Creates draft reorder requests, nothing more. */
  async function createDrafts(items: StoredProduct[]) {
    setBusy(true);
    setError(null);
    const result = await createDraftReorders(items);
    setBusy(false);
    setPending(null);
    const { created } = result;
    if (created.length) {
      setReorders((prev) => [...created, ...prev]);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of created) next.delete(r.productId);
        return next;
      });
      setNotice(draftResultMessage(result, items.length));
    }
    if (result.operatorError) setError(result.operatorError);
    else if (result.failures.length) setError(result.failures.join(" · "));
  }

  const modeChip = deskMode ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      <span className="size-1 rounded-full bg-primary" />
      {deskMode === "live" ? "Live store data" : "Demo data"}
    </span>
  ) : null;

  const firstStockout = trajectory.firstStockoutDay;
  const detail = products.find((p) => p.id === detailId) ?? null;

  function openDetail(p: StoredProduct) {
    setError(null);
    setDetailId(p.id);
  }

  function askAbout(p: StoredProduct) {
    setDetailId(null);
    setAskQuestion(`Tell me about ${p.title} (SKU ${p.sku}): current stock, sales velocity, recent orders, and whether I should reorder.`);
    setAskOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{modeChip}</div>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-foreground">Stock Risk Radar &amp; Visual Catalog</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.skuCount} SKUs tracked · trailing units/day {deskMode === "live" ? "from Shopify orders" : "from the store feed"} · reorders wait for your approval
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-black/[0.02] p-0.5 dark:bg-white/[0.03]" role="group" aria-label="Catalog view">
            {(
              [
                ["cards", "Visual cards", LayoutGrid],
                ["grid", "Dense grid", Rows3],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                  view === key ? "bg-primary/15 text-primary dark:text-emerald-300" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={shown.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={selectedItems.length === 0 || busy}
            onClick={() => setPending({ title: "Create purchase order drafts", items: selectedItems })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#059669]/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="size-3.5" />
            Create purchase order ({selectedItems.length} selected{selectedUnits ? ` · ${selectedUnits} units` : ""})
          </button>
        </div>
      </div>

      <DemoBanner message="You are exploring a sample store. Connect Shopify and this desk switches to your real catalog — the samples disappear." connectHref="/settings" connectLabel="Connect Shopify →" />
      <AiToast message={toast ?? notice} />
      {error ? <ApiErrorLine error={error} className="text-xs" /> : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Total units on hand"
          icon={<Boxes className="size-4" />}
          value={summary.totalUnits.toLocaleString("en-US")}
          unit="units"
          aside={`${summary.skuCount} SKUs`}
          bar={summary.totalUnits ? summary.unitsAboveReorder / summary.totalUnits : 0}
          barColor={HEALTH_COLOR.optimal}
          footer={[
            `${summary.totalUnits ? Math.round((summary.unitsAboveReorder / summary.totalUnits) * 100) : 0}% above reorder`,
            `${formatCurrency(summary.inventoryValue)} value`,
          ]}
        />
        <KpiTile
          label="Low stock alerts"
          icon={<TriangleAlert className="size-4" />}
          badge={summary.tiers.urgent > 0 ? { text: "Urgent", color: HEALTH_COLOR.urgent } : undefined}
          value={String(summary.lowStock.length)}
          valueColor={summary.lowStock.length ? HEALTH_COLOR.urgent : undefined}
          unit={summary.lowStock.length === 1 ? "SKU" : "SKUs"}
          aside={summary.tiers.urgent ? `${summary.tiers.urgent} under ${CRITICAL_COVER_DAYS}d` : undefined}
          asideColor={HEALTH_COLOR.urgent}
          bar={summary.skuCount ? summary.lowStock.length / summary.skuCount : 0}
          barColor={HEALTH_COLOR.urgent}
          footer={[
            summary.lowStock.length ? summary.lowStock.slice(0, 3).map((p) => p.sku).join(" · ") : "None below reorder point",
            `${summary.tiers.watch} watch`,
          ]}
          footerTitle={summary.lowStock.map((p) => p.title).join(", ")}
        />
        <KpiTile
          label={`Revenue at risk · ${RESTOCK_LEAD_DAYS}d`}
          icon={<TrendingDown className="size-4" />}
          value={formatCurrency(summary.revenueAtRisk)}
          valueColor={summary.revenueAtRisk > 0 ? HEALTH_COLOR.urgent : undefined}
          bar={summary.leadTimeDemandValue ? summary.revenueAtRisk / summary.leadTimeDemandValue : 0}
          barColor={HEALTH_COLOR.watch}
          footer={[
            summary.leadTimeDemandValue
              ? `${Math.round((summary.revenueAtRisk / summary.leadTimeDemandValue) * 100)}% of demand unfilled`
              : "No sales velocity",
            summary.worstAtRisk ? `Worst: ${summary.worstAtRisk.sku}` : "",
          ]}
          footerTitle={`Demand over the ${RESTOCK_LEAD_DAYS}-day restock lead time that current stock cannot fill, at unit price`}
        />
        <KpiTile
          label="Healthy inventory ratio"
          icon={<ShieldCheck className="size-4" />}
          value={summary.healthyPct === null ? "—" : `${summary.healthyPct}%`}
          valueColor={summary.healthyPct !== null && summary.healthyPct >= 50 ? HEALTH_COLOR.optimal : undefined}
          aside={`${summary.tiers.optimal} of ${summary.skuCount} SKUs`}
          bar={(summary.healthyPct ?? 0) / 100}
          barColor={HEALTH_COLOR.optimal}
          footer={[`Optimal = ${RESTOCK_LEAD_DAYS + 1}–${OVERSTOCK_COVER_DAYS}d cover`, `${summary.tiers.overstock} overstock`]}
        />
      </section>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <DeskChartCard
            title="Inventory depletion trajectory"
            subtitle={`All SKUs, units on hand · last 14 days reconstructed from orders, next 14 days projected at trailing velocity`}
            source="Source: today's inventory plus units sold since each day (order line items; restocks are not recorded), then each SKU depleting at its units/day until zero."
            className="h-full"
            action={
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-[#34d399]" />
                  History
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-2 border-dashed border-[#f87171]" />
                  Projection
                </span>
              </div>
            }
          >
            {loaded && products.length === 0 ? (
              <p className="py-16 text-center text-xs text-muted-foreground">No products yet.</p>
            ) : (
              <DepletionChart trajectory={trajectory} />
            )}
          </DeskChartCard>
        </div>
        <div className="min-w-0 lg:col-span-4">
          <DeskChartCard
            title="Stock health distribution"
            subtitle="SKUs by days of cover and reorder point"
            source={`Urgent: out or under ${CRITICAL_COVER_DAYS}d cover · Watch: at reorder point or ≤ ${RESTOCK_LEAD_DAYS}d · Overstock: over ${OVERSTOCK_COVER_DAYS}d, or idle above 2× reorder point.`}
            className="h-full"
          >
            {products.length === 0 ? (
              <p className="py-16 text-center text-xs text-muted-foreground">No products yet.</p>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div className="[&_ul]:hidden!">
                  <Donut
                    slices={HEALTH_ORDER.filter((t) => summary.tiers[t] > 0).map((t) => ({ label: HEALTH_LABEL[t], value: summary.tiers[t], color: HEALTH_COLOR[t] }))}
                    size={156}
                    thickness={20}
                    centerValue={summary.skuCount}
                    centerLabel="active SKUs"
                    ariaLabel="SKUs by stock health"
                  />
                </div>
                <ul className="grid w-full grid-cols-2 gap-2">
                  {(["optimal", "watch", "urgent", "overstock"] as const).map((t) => {
                    const n = summary.tiers[t];
                    const pct = summary.skuCount ? Math.round((n / summary.skuCount) * 100) : 0;
                    return (
                      <li key={t}>
                        <button
                          type="button"
                          onClick={() => setStatus((s) => (s === t ? "all" : t))}
                          aria-pressed={status === t}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition",
                            status === t ? "border-primary/40 bg-primary/10" : "border-border bg-black/[0.02] hover:border-primary/25 dark:bg-white/[0.02]",
                            n === 0 && "opacity-55"
                          )}
                        >
                          <span className="inline-flex items-center gap-2 text-secondary-foreground">
                            <span className="size-2 rounded-full" style={{ background: HEALTH_COLOR[t] }} />
                            {HEALTH_LABEL[t]}
                          </span>
                          <span className="font-mono tabular-nums">
                            <span className="font-semibold text-foreground">{n}</span>
                            <span className="ml-1 text-muted-foreground">{pct}%</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </DeskChartCard>
        </div>
      </div>

      <section className="glass-panel rounded-xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Restock recommendation</h2>
                <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-primary uppercase dark:text-emerald-300">
                  {products.some((p) => p.engine === "claude") ? "Claude forecast" : "Deterministic heuristic"} · trailing velocity
                </span>
              </div>
              <p className="text-xs leading-relaxed text-secondary-foreground">
                {due.length === 0 ? (
                  "No SKU is inside the restock lead time or below its reorder point."
                ) : dueWithoutPo.length === 0 ? (
                  <>Every SKU due for restock ({names(due)}) already has an open reorder request.</>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{names(dueWithoutPo)}</span>{" "}
                    {dueWithoutPo.length === 1 ? "is" : "are"} due for restock. Drafting the suggested{" "}
                    <span className="font-mono font-semibold text-primary tabular-nums dark:text-emerald-300">{planUnits} units</span> ({RESTOCK_COVERAGE_DAYS} days of sales or 2× reorder point) covers{" "}
                    <span className="font-mono font-semibold text-rose-400 tabular-nums">{formatCurrency(planRisk)}</span> of revenue at risk over the {RESTOCK_LEAD_DAYS}-day lead time
                    {firstStockout !== null ? <>; the first projected stockout is {firstStockout <= 0 ? "today" : dayLabel(firstStockout)}</> : null}.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={due.length === 0}
              onClick={() => setShowRationale((v) => !v)}
              aria-expanded={showRationale}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-50"
            >
              <Eye className="size-3.5" />
              {showRationale ? "Hide rationale" : "Inspect rationale"}
            </button>
            <button
              type="button"
              disabled={dueWithoutPo.length === 0 || busy}
              onClick={() => setPending({ title: "Approve restock plan", items: dueWithoutPo })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#059669]/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              Approve restock plan
            </button>
          </div>
        </div>
        {showRationale && due.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {due.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 rounded-md border border-border bg-black/[0.02] px-3 py-2 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-4 dark:bg-white/[0.02]">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {p.title} <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{p.reasoning}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {p.engine === "claude" ? "Claude" : "Heuristic"} · suggest <span className="text-foreground tabular-nums">+{reorderSuggestion(p)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Catalog velocity &amp; depletion</h2>
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
              Showing {shown.length} of {products.length} SKUs
            </span>
          </div>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">Select SKUs for a batch purchase order</p>
        </div>

        <div className="glass-panel flex flex-col gap-2 rounded-xl p-2 md:flex-row md:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by product or SKU…"
            aria-label="Filter products"
            className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)} options={[["all", "All statuses"], ...HEALTH_ORDER.map((t) => [t, HEALTH_LABEL[t]] as [string, string])]} />
            <FilterSelect
              label="Restock"
              value={restock}
              onChange={(v) => setRestock(v as RestockFilter)}
              options={[
                ["all", "All"],
                ["due", "Due, no PO"],
                ["open", "Open PO"],
                ["none", "No open PO"],
              ]}
            />
            <FilterSelect
              label="Sort"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                ["risk", "Highest risk first"],
                ["cover", "Lowest cover"],
                ["revenue", "Revenue at risk"],
                ["units", "Most units"],
                ["name", "Name"],
              ]}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="glass-panel rounded-xl px-4 py-10 text-center text-sm text-muted-foreground">
            {products.length === 0 ? (loaded ? "No products yet." : "Loading catalog…") : "No SKUs match these filters."}
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shown.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selected.has(p.id)}
                onToggle={() => toggle(p.id)}
                onOpen={() => openDetail(p)}
                reorders={reorders}
                busy={busy}
                onDraft={(product) => setPending({ title: "Draft purchase order", items: [product] })}
              />
            ))}
          </div>
        ) : (
          <DenseTable
            products={shown}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onOpen={openDetail}
            reorders={reorders}
            busy={busy}
            onDraft={(product) => setPending({ title: "Draft purchase order", items: [product] })}
          />
        )}
      </section>

      <ProductDetailDrawer
        product={detail}
        onOpenChange={(open) => !open && setDetailId(null)}
        orders={orders}
        reorders={reorders}
        busy={busy}
        error={detail ? error : null}
        onCreateDraft={(p) => createDrafts([p])}
        onAskAi={askAbout}
      />
      <AskAiDrawer open={askOpen} onOpenChange={setAskOpen} initialQuestion={askQuestion} />

      {pending ? (
        <ConfirmDrafts
          title={pending.title}
          items={pending.items.filter(selectable)}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={(items) => void createDrafts(items)}
        />
      ) : null}
    </div>
  );
}

function KpiTile({
  label,
  icon,
  badge,
  value,
  valueColor,
  unit,
  aside,
  asideColor,
  bar,
  barColor,
  footer,
  footerTitle,
}: {
  label: string;
  icon: ReactNode;
  badge?: { text: string; color: string };
  value: string;
  valueColor?: string;
  unit?: string;
  aside?: string;
  asideColor?: string;
  bar: number;
  barColor: string;
  footer: [string, string];
  footerTitle?: string;
}) {
  return (
    <div className="glass-panel flex flex-col rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</span>
        {badge ? (
          <span
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase"
            style={{ color: badge.color, borderColor: `${badge.color}55`, background: `${badge.color}14` }}
          >
            {badge.text}
          </span>
        ) : (
          <span className="text-muted-foreground">{icon}</span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-2xl leading-none font-semibold tracking-tight" style={{ color: valueColor }}>
            {value}
          </span>
          {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        </p>
        {aside ? (
          <span className="truncate font-mono text-[11px] tabular-nums" style={{ color: asideColor }}>
            <span className={asideColor ? undefined : "text-muted-foreground"}>{aside}</span>
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-1 rounded-full bg-black/[0.06] dark:bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, bar)) * 100)}%`, background: barColor }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate" title={footerTitle ?? footer[0]}>
          {footer[0]}
        </span>
        {footer[1] ? <span className="shrink-0 font-mono tabular-nums">{footer[1]}</span> : null}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground focus-within:border-primary/40">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent text-xs font-medium text-foreground focus:outline-none [&>option]:bg-background"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConfirmDrafts({
  title,
  items,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  items: StoredProduct[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (items: StoredProduct[]) => void;
}) {
  const units = items.reduce((s, p) => s + reorderSuggestion(p), 0);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-drafts-title">
      <div className="glass-panel w-full max-w-md rounded-xl p-5 shadow-2xl">
        <h2 id="confirm-drafts-title" className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {items.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">These SKUs already have open reorder requests or need no restock.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Creates {items.length} draft reorder {items.length === 1 ? "request" : "requests"} for you to track through ordered → received. Nothing is sent to a
              supplier or written to Shopify.
            </p>
            <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {items.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{p.title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {p.sku} · {Math.max(0, p.currentInventory)} on hand
                    </span>
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-primary tabular-nums dark:text-emerald-300">+{reorderSuggestion(p)} u</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right font-mono text-[11px] text-muted-foreground tabular-nums">Total {units} units</p>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:text-foreground disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || items.length === 0}
            onClick={() => onConfirm(items)}
            className="rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#059669]/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Creating…" : `Create ${items.length} draft${items.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
