import { cn } from "@/lib/utils";

export function EngineBadge({ engine }: { engine: "claude" | "deterministic" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[9px] font-medium",
        engine === "claude" ? "bg-violet-500/10 text-violet-500 dark:text-violet-300" : "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.06]"
      )}
    >
      {engine === "claude" ? "Written by Claude" : "Deterministic (no Claude)"}
    </span>
  );
}

/** "Shopify" only means the records came from the real store; the sync time says when Shopify last answered. */
export function SourceBadge({ source, lastSyncAt }: { source: "shopify" | "demo"; lastSyncAt?: string | null }) {
  if (source === "demo") {
    return <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-300">Demo data</span>;
  }
  return (
    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-300">
      Real Shopify orders
      {lastSyncAt ? ` · Shopify last answered ${new Date(lastSyncAt).toLocaleString()}` : " · from storage (Shopify not queried in this session)"}
    </span>
  );
}
