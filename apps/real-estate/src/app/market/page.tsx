import { MapPin, Home, Info, PlusSquare, TrendingUp } from "lucide-react";
import { Kpi } from "@/components/bits";
import { MarketBrief } from "@/components/market-brief";
import { UsMarketMap } from "@/components/us-market-map";
import { claudeReady } from "@/lib/ai-claude";
import { monthLabel, US_MARKET_SOURCE_PAGE } from "@/lib/us-market";
import { getUsMarket } from "@/lib/us-market-source";

export const dynamic = "force-dynamic";

const sum = (ns: (number | null)[]) => ns.reduce<number>((s, n) => s + (n ?? 0), 0);
const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "an earlier date");

export default async function MarketPage() {
  const market = await getUsMarket();

  if (!market) {
    return (
      <>
        <h1 className="text-3xl font-semibold text-foreground">US Market</h1>
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          Couldn&apos;t reach Realtor.com and no saved copy was found. Run <code className="font-mono">npm run market:snapshot</code> to save one.
        </p>
      </>
    );
  }

  const { states, latestMonth } = market;
  const month = monthLabel(latestMonth);
  const current = states.filter((s) => s.latest.month === latestMonth);
  const forSale = sum(current.map((s) => s.latest.active));
  const newListings = sum(current.map((s) => s.latest.newListings));
  const yearAgoForSale = sum(current.map((s) => (s.latest.active !== null && s.latest.activeYy !== null ? s.latest.active / (1 + s.latest.activeYy) : null)));
  const up = current.filter((s) => (s.latest.activeYy ?? 0) > 0).length;
  const leader = [...current].sort((a, b) => (b.latest.active ?? 0) - (a.latest.active ?? 0))[0];

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">US Market</h1>
        <p className="mt-1 text-sm text-muted-foreground">Homes for sale across the 50 states and DC — where inventory is, how fast it moves and where buyers are going under contract.</p>
      </header>

      <p className="flex gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-xs leading-relaxed text-sky-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Monthly figures from the{" "}
          <a href={US_MARKET_SOURCE_PAGE} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
            Realtor.com® residential listings data
          </a>
          , latest month <strong>{month}</strong>. Not real time — Realtor.com publishes once a month, and it counts listings on its site, not every home for sale
          or every sale closed. Prices are asking prices.{" "}
          {market.origin === "live"
            ? `Checked by this server ${fmtDate(market.fetchedAt)}.`
            : `Realtor.com couldn't be reached just now, so this is the saved copy from ${fmtDate(market.fetchedAt)}.`}
        </span>
      </p>

      <section aria-label="National totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi size="hero" label="Homes for sale" value={forSale.toLocaleString("en-US")} hint={`Sum of state counts · ${month}`} icon={Home} />
        <Kpi
          size="hero"
          label="Vs last year"
          value={yearAgoForSale ? `${forSale >= yearAgoForSale ? "+" : ""}${(((forSale - yearAgoForSale) / yearAgoForSale) * 100).toFixed(1)}%` : "—"}
          hint={`Inventory up in ${up} of ${current.length} states`}
          icon={TrendingUp}
        />
        <Kpi size="hero" label="New listings" value={newListings.toLocaleString("en-US")} hint={`Came on the market in ${month}`} icon={PlusSquare} />
        <Kpi size="hero" label="Most inventory" value={leader?.id ?? "—"} hint={leader ? `${leader.name} · ${leader.latest.active?.toLocaleString("en-US")} for sale` : ""} icon={MapPin} />
      </section>

      <MarketBrief month={month} claude={claudeReady()} />

      <UsMarketMap states={current} />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Buyer demand isn&apos;t published by state, so the demand view uses the pending ratio (homes under contract ÷ homes for sale) as a signal. Seeing
        individual homes for sale needs an MLS/IDX feed from your brokerage — connect one under Settings → Integrations when available.
      </p>
    </>
  );
}
