import Link from "next/link";
import { BadgeCheck, CalendarPlus, Download, EyeOff, Flame, Landmark, MessageCircle, MessageSquareWarning, Radar, Users } from "lucide-react";
import { DemoBanner } from "@/components/ai-desk-events";
import { Avatar, Sparkline, money } from "@/components/bits";
import { CommissionKpi } from "@/components/commission-kpi";
import { DashboardConsole } from "@/components/dashboard-console";
import { ListingShowcaseCard } from "@/components/listing-showcase";
import { RibbonKpi } from "@/components/ribbon-kpi";
import { ScoreExplain } from "@/components/score-explain";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { INTENT_LABEL, intentFor } from "@/lib/intent";
import { buyersToAlert, COLD_AFTER_DAYS, isCold } from "@/lib/outreach";
import { matchProperties } from "@/lib/scoring";
import { needsFeedback, sameDay } from "@/lib/showings";
import { contactRecency, phoneDigits } from "@/lib/status";
import { listDrafts, listLeads, listProperties, listShowings } from "@/lib/store";
import type { Financing } from "@/lib/types";
import { fmtTime } from "@/lib/when";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const NO_VISIT_DAYS = 15;
const avg = (ns: number[]) => (ns.length ? Math.round(ns.reduce((s, n) => s + n, 0) / ns.length) : null);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const compactMoney = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `$${Math.round(n / 1000)}k` : money(n));
const FINANCING: Record<Financing, { label: string; tone: string }> = {
  cash: { label: "Cash buyer", tone: "text-primary" },
  preapproved: { label: "Pre-approved", tone: "text-[var(--tertiary,#38bdf8)]" },
  needs_financing: { label: "Needs financing", tone: "text-amber-300" },
  unknown: { label: "Financing not stated", tone: "text-muted-foreground" },
};
const PANEL = "rounded-xl bg-card/90 p-6";

export default async function DashboardPage() {
  const [leads, props, drafts, showings] = await Promise.all([listLeads(), listProperties(), listDrafts(), listShowings()]);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const open = leads.filter((l) => l.stage !== "closed" && l.stage !== "archived");
  const hot = open.filter((l) => l.buyer.tier === "hot");
  const active = props.filter((p) => p.status === "active");
  const inPipeline = props.filter((p) => p.status === "active" || p.status === "reserved");
  const live = showings.filter((s) => s.status !== "cancelled");
  const visitedRecently = new Set(live.filter((s) => Date.parse(s.startsAt) > now - NO_VISIT_DAYS * DAY).map((s) => s.propertyId));
  const noVisit = active.filter((p) => p.daysOnMarket >= NO_VISIT_DAYS && !visitedRecently.has(p.id));
  const decided = drafts.filter((d) => d.status !== "pending");
  const approvedN = decided.filter((d) => d.status === "approved").length;
  const pending = drafts.length - decided.length;
  const awaitingList = showings.filter((s) => needsFeedback(s, now));
  const cold = open.filter((l) => isCold(l, now)).length;
  const todays = live.filter((s) => sameDay(Date.parse(s.startsAt), now));
  const nextToday = todays.find((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now);
  const booked = new Set(showings.filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now).map((s) => s.leadId));
  const hotUnbooked = hot.filter((l) => !booked.has(l.id));
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  const propTitle = new Map(props.map((p) => [p.id, p.title]));

  const weekly = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY;
    return leads.filter((l) => {
      const t = Date.parse(l.createdAt);
      return t > end - 7 * DAY && t <= end;
    }).length;
  });

  const perListing = active.map((p) => {
    const strong = buyersToAlert(p, leads);
    const showings30 = live.filter((s) => s.propertyId === p.id && Date.parse(s.startsAt) <= now && Date.parse(s.startsAt) > now - 30 * DAY).length;
    return { p, strong, showings30, photo: DEMO_PHOTOS[p.id] };
  });
  const featured = [...perListing].sort((a, b) => Number(!!b.photo) - Number(!!a.photo) || b.strong.length - a.strong.length).slice(0, 4);
  const covered = perListing.filter((x) => x.strong.length > 0).length;
  const coverage = active.length ? Math.round((covered / active.length) * 100) : 0;

  const brief = [
    hotUnbooked.length ? `${plural(hotUnbooked.length, "hot buyer")} with no showing booked — ${hotUnbooked.slice(0, 2).map((l) => l.name).join(", ")}${hotUnbooked.length > 2 ? "…" : ""}` : null,
    awaitingList.length ? `${plural(awaitingList.length, "visit")} waiting for feedback.` : null,
    pending ? `${plural(pending, "draft")} waiting for your approval — nothing is sent until you approve.` : null,
    cold ? `${plural(cold, "open buyer")} with no contact in ${COLD_AFTER_DAYS}+ days.` : null,
    todays.length ? `Today: ${plural(todays.length, "showing")}${nextToday ? `, next at ${fmtTime(nextToday.startsAt)}` : ", all done"}.` : null,
  ].filter((b): b is string => b !== null);

  const pool = [...open]
    .sort((a, b) => b.buyer.score - a.buyer.score)
    .slice(0, 5)
    .map((l) => ({ l, intent: intentFor(l).intent, top: matchProperties(l, props, 1)[0], recency: contactRecency(l.lastContactAt, now) }));

  const zoneRows = [...new Set(active.map((p) => p.zone))]
    .map((zone) => {
      const mine = active.filter((p) => p.zone === zone);
      const visited = mine.filter((p) => visitedRecently.has(p.id) || live.some((s) => s.propertyId === p.id && Date.parse(s.startsAt) > now - 30 * DAY && Date.parse(s.startsAt) <= now)).length;
      return { zone, n: mine.length, perSqm: avg(mine.map((p) => p.price / p.sqm)) ?? 0, days: avg(mine.map((p) => p.daysOnMarket)) ?? 0, visitedPct: Math.round((visited / mine.length) * 100) };
    })
    .sort((a, b) => b.perSqm - a.perSqm);
  const deskPerSqm = avg(active.map((p) => p.price / p.sqm));
  const domSorted = active.map((p) => p.daysOnMarket).sort((a, b) => a - b);
  const medianDom = domSorted.length ? domSorted[Math.floor(domSorted.length / 2)] : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl bg-card/90 p-6 lg:flex-row lg:items-center">
        <div className="pointer-events-none absolute -top-16 -right-16 size-80 rounded-full bg-primary/5 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-10 w-auto drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]" />
            <div>
              <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-[var(--gold-soft,var(--primary))] uppercase">Agent deal desk</span>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">Dashboard</h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 rounded-lg bg-background/80 px-4 py-2 sm:flex">
            <span className="size-2 rounded-full bg-[var(--tertiary,#38bdf8)]" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-[var(--tertiary,#38bdf8)] uppercase">Desk data</p>
              <p className="text-xs text-muted-foreground">
                {plural(props.length, "listing")} · {plural(leads.length, "buyer")} · no MLS or CRM connected yet
              </p>
            </div>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <a href="/api/export/properties" download className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-[var(--gold-soft,var(--primary))] transition hover:bg-muted">
            <Download className="size-4" aria-hidden /> Export listings (CSV)
          </a>
          <Link
            href="/calendar#schedule"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-amber-600 px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(251,191,36,0.35)] transition hover:brightness-110"
          >
            <CalendarPlus className="size-4" aria-hidden /> Book a showing
          </Link>
        </div>
      </section>

      <DemoBanner message="You are exploring a sample agency: 10 properties and 20 buyers, with sample photos. Import your own listings and this desk switches to your real data." />

      {awaitingList.length ? (
        <div role="region" aria-label="Feedback waiting" className="flex flex-wrap items-center gap-3 rounded-xl bg-sky-500/10 px-4 py-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            <MessageSquareWarning className="size-5" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-semibold">{plural(awaitingList.length, "visit")} ended without feedback.</span>{" "}
            <span className="text-muted-foreground">
              {awaitingList
                .slice(0, 2)
                .map((s) => `${leadName.get(s.leadId) ?? "A buyer"} at ${propTitle.get(s.propertyId) ?? "a listing"}`)
                .join(" · ")}
              {awaitingList.length > 2 ? ` and ${awaitingList.length - 2} more` : ""}. Notes feed the next matches.
            </span>
          </p>
          <Link
            href={awaitingList.length === 1 ? `/calendar/${awaitingList[0].id}` : "/calendar#feedback"}
            className="inline-flex min-h-9 items-center rounded-lg bg-sky-500 px-3.5 text-xs font-semibold text-white transition hover:bg-sky-400"
          >
            Record feedback →
          </Link>
        </div>
      ) : null}

      <section data-tour="re-kpis" aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <RibbonKpi
          label="Active list value"
          icon={Landmark}
          value={compactMoney(active.reduce((s, p) => s + p.price, 0))}
          foot={`Asking prices · ${plural(active.length, "active listing")}`}
          footRight={<span className="text-primary">{props.length - active.length} not active</span>}
        />
        <RibbonKpi
          label="Hot buyers"
          icon={Flame}
          value={`${open.length ? Math.round((hot.length / open.length) * 100) : 0}%`}
          foot={`${hot.length} of ${open.length} score 85+`}
          footRight={<Sparkline values={weekly} label="New buyers per week, last 8 weeks" className="w-16" />}
        />
        <CommissionKpi listValue={inPipeline.reduce((s, p) => s + p.price, 0)} listings={inPipeline.length} />
        <RibbonKpi
          label={`No visit ${NO_VISIT_DAYS}+ days`}
          icon={EyeOff}
          iconClassName="text-amber-300"
          value={String(noVisit.length)}
          foot={noVisit.length ? noVisit.map((p) => p.title).join(", ") : `Every listing out ${NO_VISIT_DAYS}+ days had a visit`}
        />
        <RibbonKpi
          label="Drafts approved"
          icon={BadgeCheck}
          value={decided.length ? `${Math.round((approvedN / decided.length) * 100)}%` : "—"}
          valueClassName={decided.length ? "text-primary" : undefined}
          foot={decided.length ? `${approvedN} of ${decided.length} decided` : "No drafts decided yet"}
          footRight={pending ? <span className="text-primary">{pending} pending</span> : undefined}
        />
      </section>

      <section className="grid items-stretch gap-6 lg:grid-cols-12">
        <DashboardConsole brief={brief.length ? brief : ["Nothing needs you right now — no feedback, drafts or cold buyers waiting."]} />
        <div className="group relative min-h-[320px] overflow-hidden rounded-xl bg-card/90 lg:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/helix-prism.jpg" alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-background via-background/30 to-transparent p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[var(--gold-soft,var(--primary))] uppercase backdrop-blur-md">
                <span className="size-2 rounded-full bg-primary" aria-hidden /> Helix matching engine
              </span>
              <span className="rounded bg-accent/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">Rules-based scoring</span>
            </div>
            <div className="rounded-lg bg-background/90 p-3 backdrop-blur-lg">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase">
                <span className="font-medium text-muted-foreground">Listings with a strong-fit buyer</span>
                <span className="tabular font-semibold text-[var(--tertiary,#38bdf8)]">{coverage}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-accent" role="img" aria-label={`${covered} of ${active.length} active listings have a strong-fit buyer`}>
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-600" style={{ width: `${coverage}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  {covered} of {plural(active.length, "active listing")} · {plural(open.length, "buyer")} scored
                </span>
                <span className="text-[var(--gold-soft,var(--primary))]">Fit = budget · zone · beds · availability</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="featured-heading" className="text-[22px] font-semibold text-foreground">
                Featured listings
              </h2>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--gold-soft,var(--primary))]">{active.length} active</span>
            </div>
            <p className="text-xs text-muted-foreground">Price per m², buyers who strongly fit and showings in the last 30 days — counted from this desk.</p>
          </div>
          <Link href="/properties" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted">
            All properties →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featured.map(({ p, strong, showings30, photo }) => (
            <ListingShowcaseCard key={p.id} p={p} photo={photo} strongFit={strong.length} showings30={showings30} best={strong[0] ? { name: strong[0].lead.name, fit: strong[0].fit } : undefined} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <div data-tour="re-hot" className={`${PANEL} xl:col-span-7`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Hottest buyers</h3>
                <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--tertiary,#38bdf8)]">Scored on this desk</span>
              </div>
              <p className="text-xs text-muted-foreground">Best score first, with budget, financing as stated in their record, and top listing match.</p>
            </div>
            <Link href="/leads" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-[var(--gold-soft,var(--primary))] transition hover:bg-muted">
              All leads →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead>
                <tr className="bg-background/60 text-[10px] tracking-wider text-muted-foreground uppercase">
                  <th className="rounded-l px-3 py-2.5 font-semibold">Buyer & intent</th>
                  <th className="px-3 py-2.5 font-semibold">Budget</th>
                  <th className="px-3 py-2.5 font-semibold">Top listing match</th>
                  <th className="px-3 py-2.5 font-semibold">Score</th>
                  <th className="rounded-r px-3 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/40">
                {pool.map(({ l, intent, top, recency }) => (
                  <tr key={l.id} data-ai-id={l.id} className="transition-colors hover:bg-accent/30">
                    <td className="px-3 py-3">
                      <Link href={`/leads/${l.id}`} className="flex items-center gap-2.5">
                        <Avatar name={l.name} size="sm" recency={recency} />
                        <span>
                          <span className="block text-sm font-medium text-foreground hover:text-primary">{l.name}</span>
                          <span className="text-muted-foreground">
                            {INTENT_LABEL[intent]} · {l.stage}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="tabular block text-sm font-semibold text-foreground">{l.budget > 0 ? compactMoney(l.budget) : "Not stated"}</span>
                      <span className={FINANCING[l.financing].tone}>{FINANCING[l.financing].label}</span>
                    </td>
                    <td className="px-3 py-3">
                      {top ? (
                        <>
                          <Link href={`/properties/${top.property.id}`} className="block font-medium text-foreground hover:text-primary">
                            {top.property.title}
                          </Link>
                          <span className="text-muted-foreground">{top.fit}% fit · {top.property.zone}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No listing fits yet</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ScoreExplain tier={l.buyer.tier} score={l.buyer.score} factors={l.buyer.factors} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {l.phone ? (
                          <a
                            href={`https://wa.me/${phoneDigits(l.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`WhatsApp ${l.name} from your own app`}
                            title="Opens your own WhatsApp — Helix sends nothing"
                            className="inline-flex size-7 items-center justify-center rounded bg-accent text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <MessageCircle className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                        <Link
                          href={`/calendar?lead=${l.id}#schedule`}
                          className="rounded bg-accent px-2.5 py-1 font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground"
                        >
                          Book
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div data-tour="re-market" className={`${PANEL} flex flex-col justify-between gap-4 xl:col-span-5`}>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Zone velocity</h3>
              <Radar className="size-[18px] text-primary" aria-hidden />
            </div>
            <p className="text-xs text-muted-foreground">Your active listings by zone: asking price per m², days listed and how many had a visit in the last 30 days.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-background/80 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Avg asking $/m²</p>
              <p className="tabular font-heading text-[22px] font-semibold text-primary">{deskPerSqm ? `${money(deskPerSqm)}` : "—"}</p>
              <p className="text-[10px] text-[var(--tertiary,#38bdf8)]">Across {plural(active.length, "active listing")}</p>
            </div>
            <div className="rounded-lg bg-background/80 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Median days listed</p>
              <p className="tabular font-heading text-[22px] font-semibold text-foreground">{medianDom === null ? "—" : `${medianDom} days`}</p>
              <p className="text-[10px] text-[var(--gold-soft,var(--primary))]">{noVisit.length ? `${noVisit.length} with no visit in ${NO_VISIT_DAYS}+ days` : "All recently visited"}</p>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {zoneRows.map((z) => (
              <li key={z.zone} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    {z.zone} <span className="font-normal text-muted-foreground">· {plural(z.n, "listing")} · {z.days}d avg</span>
                  </span>
                  <span className="tabular font-semibold text-[var(--gold-soft,var(--primary))]">
                    {z.visitedPct}% visited · {money(z.perSqm)}/m²
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent" aria-hidden>
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-600" style={{ width: `${Math.max(z.visitedPct, 2)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-background/40 p-2.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" aria-hidden /> Counted from this desk&apos;s listings and showings
            </span>
            <Link href="/market" className="font-semibold text-primary hover:underline">
              US market →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
