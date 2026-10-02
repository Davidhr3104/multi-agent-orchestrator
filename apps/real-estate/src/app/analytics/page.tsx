import Link from "next/link";
import { Bot, CalendarCheck, Info, Send, TrendingDown, Users } from "lucide-react";
import { AreaChart, type AreaPoint } from "@/components/area-chart";
import { KIND_LABEL, Kpi, money } from "@/components/bits";
import { PrintButton } from "@/components/print-button";
import { buyersToAlert } from "@/lib/outreach";
import { listActivity, listDrafts, listLeads, listProperties, listShowings, listZones } from "@/lib/store";
import { LEAD_STAGES, type Interest, type LeadStage, type PropertyKind } from "@/lib/types";
import { fmtWhen } from "@/lib/when";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const WEEKS = 12;
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const avg = (ns: number[]) => (ns.length ? Math.round(ns.reduce((s, n) => s + n, 0) / ns.length) : null);

const ACTION_LABEL: Record<string, string> = {
  move_stage: "Moved a buyer's stage",
  schedule_showing: "Booked a showing",
  reschedule_showing: "Moved a showing",
  cancel_showing: "Cancelled a showing",
  record_feedback: "Recorded visit feedback",
  toggle_checklist: "Ticked the visit checklist",
  draft_match_alerts: "Drafted new-listing alerts",
  draft_reactivation: "Drafted check-ins",
  approve_draft: "Approved a draft",
  dismiss_draft: "Dismissed a draft",
  add_seller: "Added a seller",
  move_seller_stage: "Moved a seller's stage",
  create_listing_from_seller: "Drafted a listing from a seller",
};

function Panel({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card/80 p-5", className)}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal bar with the number always printed, never colour alone. */
function Bar({ label, value, max, detail, tone = "bg-primary", wide = false }: { label: string; value: number; max: number; detail?: string; tone?: string; wide?: boolean }) {
  return (
    <li className={cn("grid items-center gap-3 text-sm", wide ? "grid-cols-[minmax(0,12rem)_1fr_auto]" : "grid-cols-[7.5rem_1fr_auto]")}>
      <span className="truncate text-muted-foreground" title={label}>
        {label[0].toUpperCase() + label.slice(1)}
      </span>
      <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${max ? Math.max(value ? 3 : 0, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="tabular min-w-16 text-right font-mono text-xs text-foreground">
        {value}
        {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
      </span>
    </li>
  );
}

const INTEREST_TONE: Record<Interest, string> = { high: "bg-emerald-400", medium: "bg-sky-400", low: "bg-amber-400", none: "bg-slate-400" };

export default async function AnalyticsPage() {
  const [leads, props, showings, drafts, activity, market] = await Promise.all([listLeads(), listProperties(), listShowings(), listDrafts(), listActivity(), listZones()]);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();

  const byStage = Object.fromEntries(LEAD_STAGES.map((s) => [s, leads.filter((l) => l.stage === s).length])) as Record<LeadStage, number>;
  const funnel: LeadStage[] = ["new", "contacted", "visit", "offer", "closed"];
  const reachedAtLeast = funnel.map((s, i) => ({ stage: s, count: funnel.slice(i).reduce((n, x) => n + byStage[x], 0) }));
  const inFunnel = reachedAtLeast[0].count;

  const sources = [...new Set(leads.map((l) => l.source))]
    .map((src) => {
      const ls = leads.filter((l) => l.source === src);
      return { src, count: ls.length, hot: ls.filter((l) => l.buyer.tier === "hot").length, avgScore: avg(ls.map((l) => l.buyer.score)) ?? 0 };
    })
    .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore);
  const maxSource = Math.max(0, ...sources.map((s) => s.count));

  const last30 = showings.filter((s) => Date.parse(s.startsAt) <= now && Date.parse(s.startsAt) > now - 30 * DAY);
  const done = last30.filter((s) => s.status === "done");
  const noShow = last30.filter((s) => s.status === "no_show").length;
  const cancelled = showings.filter((s) => s.status === "cancelled" && Date.parse(s.startsAt) > now - 30 * DAY).length;
  const upcoming = showings.filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now).length;
  const interest = (["high", "medium", "low", "none"] as Interest[]).map((i) => ({ i, n: done.filter((s) => s.feedback?.interest === i).length }));
  const objections = new Map<string, number>();
  for (const s of done) for (const o of s.feedback?.objections ?? []) objections.set(o, (objections.get(o) ?? 0) + 1);
  const topObjections = [...objections].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const decided = drafts.filter((d) => d.status !== "pending");
  const approved = drafts.filter((d) => d.status === "approved").length;

  const zones = [...new Set(props.map((p) => p.zone))].map((z) => {
    const act = props.filter((p) => p.zone === z && p.status === "active");
    return { z, active: act.length, perSqm: avg(act.map((p) => p.price / p.sqm)), days: avg(act.map((p) => p.daysOnMarket)) };
  });

  const listed = props.filter((p) => p.status !== "draft" && p.daysOnMarket > 0);
  const kinds = (Object.keys(KIND_LABEL) as PropertyKind[]).filter((k) => listed.some((p) => p.kind === k));
  const zoneNames = [...new Set(listed.map((p) => p.zone))].sort();
  const domCell = (z: string, k: PropertyKind) => {
    const ps = listed.filter((p) => p.zone === z && p.kind === k);
    return ps.length ? { days: avg(ps.map((p) => p.daysOnMarket))!, n: ps.length } : null;
  };
  const maxDom = Math.max(1, ...listed.map((p) => p.daysOnMarket));
  const domTone = (d: number) => (d >= 45 ? "bg-rose-500/25 text-rose-200" : d >= 30 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/15 text-emerald-200");

  const marketZone = new Map(market.map((z) => [z.name, z]));
  const priceReview = props
    .filter((p) => p.status === "active")
    .map((p) => {
      const mz = marketZone.get(p.zone);
      const strong = buyersToAlert(p, leads).length;
      const seen = showings.some((s) => s.propertyId === p.id && s.status !== "cancelled" && Date.parse(s.startsAt) > now - 30 * DAY);
      return { p, mz, strong, seen };
    })
    .filter(({ p, mz, strong }) => mz && p.daysOnMarket > mz.medianDaysOnMarket && strong === 0)
    .sort((a, b) => b.p.daysOnMarket - a.p.daysOnMarket);

  const runs = activity.filter((a) => a.kind === "run");
  const undos = activity.filter((a) => a.kind === "undo").length;
  const proposed = activity.filter((a) => a.kind === "proposed").length;
  const viaChat = runs.filter((a) => a.via === "chat").length;
  const changes = runs.reduce((n, a) => n + a.done, 0);
  const weekly: AreaPoint[] = Array.from({ length: WEEKS }, (_, i) => {
    const end = now - (WEEKS - 1 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const added = leads.filter((l) => {
      const t = Date.parse(l.createdAt);
      return t > start && t <= end;
    });
    const hot = added.filter((l) => l.buyer.tier === "hot").length;
    return {
      label: `Week to ${new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      value: added.length,
      detail: added.length ? `${hot} of them hot now` : undefined,
    };
  });
  const weeklyTotal = weekly.reduce((n, w) => n + w.value, 0);
  const byAction = [...runs.reduce((m, a) => m.set(a.action, (m.get(a.action) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your pipeline, showings, outreach and what Helix actually did — all counted from this desk.</p>
        </div>
        <PrintButton label="Export report (PDF)" />
      </header>

      <p className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Every number below is counted from the records on this desk. Helix doesn&apos;t estimate revenue, commissions, hours saved or ROI — no sales or time
          data is connected to measure them honestly. The pipeline shows where buyers are today, not a conversion rate over time.
        </span>
      </p>

      <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi size="hero" label="Buyers in pipeline" value={String(inFunnel)} hint={`${byStage.archived} archived, not counted`} icon={Users} />
        <Kpi size="hero" label="Showings, last 30 days" value={String(last30.length)} hint={`${done.length} done · ${noShow} no-show · ${upcoming} upcoming`} icon={CalendarCheck} />
        <Kpi size="hero" label="Drafts approved" value={decided.length ? `${pct(approved, decided.length)}%` : "—"} hint={decided.length ? `${approved} of ${decided.length} decided drafts` : "No drafts decided yet"} icon={Send} />
        <Kpi size="hero" label="Helix actions run" value={String(runs.length)} hint={runs.length ? `${changes} records changed · ${undos} undone` : "Nothing yet since the desk loaded"} icon={Bot} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Inventory turnover" hint="Average days on market by zone and property type, from this desk's listed properties (drafts left out)." className="lg:col-span-3">
          {listed.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                    <th className="pb-1 font-semibold">Zone</th>
                    {kinds.map((k) => (
                      <th key={k} className="pb-1 text-center font-semibold">
                        {KIND_LABEL[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zoneNames.map((z) => (
                    <tr key={z}>
                      <th scope="row" className="pr-2 text-left font-medium text-foreground">
                        {z}
                      </th>
                      {kinds.map((k) => {
                        const c = domCell(z, k);
                        return (
                          <td key={k} className="text-center">
                            {c ? (
                              <span className={cn("tabular flex flex-col items-center rounded-md px-2 py-1.5 font-mono text-sm font-semibold", domTone(c.days))} title={`${c.n} listing${c.n === 1 ? "" : "s"}`}>
                                {c.days}d
                                <span className="h-1 w-full max-w-12 overflow-hidden rounded-full bg-black/20" aria-hidden>
                                  <span className="block h-full bg-current" style={{ width: `${(c.days / maxDom) * 100}%` }} />
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">Green under 30 days · amber 30–44 · red 45+. Includes reserved and sold listings&apos; time on market.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No listed properties yet.</p>
          )}
        </Panel>

        <Panel title="Price review candidates" hint="Active listings out longer than their zone's median with no strong-fit buyer on the desk." className="lg:col-span-2">
          {priceReview.length ? (
            <ul className="space-y-2.5">
              {priceReview.map(({ p, mz, seen }) => (
                <li key={p.id} className="rounded-lg bg-muted/40 p-3">
                  <Link href={`/properties/${p.id}`} className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground hover:text-primary">
                    <span className="flex items-center gap-1.5 truncate">
                      <TrendingDown className="size-4 shrink-0 text-amber-300" aria-hidden /> {p.title}
                    </span>
                    <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">{money(p.price)}</span>
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.daysOnMarket} days listed vs {mz!.medianDaysOnMarket} median in {p.zone} · {money(Math.round(p.price / p.sqm))}/m² vs {money(mz!.avgPricePerSqm)} zone avg ·{" "}
                    {seen ? "visited in the last 30 days" : "no visit in 30 days"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No listing meets the rule right now.</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">A rule over desk records and the demo zone figures — not a price prediction. You decide whether to talk price with the owner.</p>
        </Panel>
      </div>

      <Panel title="New buyers per week" hint={`Last ${WEEKS} weeks, by the date each lead was added to the desk. Hover or tab through the weeks for the numbers.`}>
        <AreaChart points={weekly} unit="new buyers" />
        <p className="mt-3 text-[11px] text-muted-foreground">
          {weeklyTotal} buyer{weeklyTotal === 1 ? "" : "s"} added in this window. Counts come from each lead&apos;s added date — nothing is projected.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Pipeline today" hint="Buyers at each stage or further along. Archived buyers are left out.">
          <ul className="space-y-2.5">
            {reachedAtLeast.map(({ stage, count }) => (
              <Bar key={stage} label={stage} value={count} max={inFunnel} detail={`${pct(count, inFunnel)}%`} />
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Right now: {funnel.map((s) => `${byStage[s]} ${s}`).join(" · ")}. Stage history starts being recorded in Helix&apos;s activity log, so a true conversion rate needs time.
          </p>
        </Panel>

        <Panel title="Lead sources" hint="How many buyers each source brought, and how good they look">
          <ul className="space-y-2.5">
            {sources.map((s) => (
              <Bar key={s.src} label={s.src} value={s.count} max={maxSource} detail={`${s.hot} hot · avg ${s.avgScore}`} tone="bg-sky-400" />
            ))}
          </ul>
        </Panel>

        <Panel title="Showings, last 30 days" hint="Interest recorded after each visit">
          {done.length ? (
            <>
              <ul className="space-y-2.5">
                {interest.map(({ i, n }) => (
                  <Bar key={i} label={i === "none" ? "no interest" : `${i} interest`} value={n} max={done.length} tone={INTEREST_TONE[i]} />
                ))}
              </ul>
              <h3 className="mt-5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Top objections</h3>
              {topObjections.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {topObjections.map(([o, n]) => (
                    <li key={o} className="rounded-full border border-border px-3 py-1 text-xs text-foreground">
                      {o} <span className="tabular font-mono text-muted-foreground">×{n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">None recorded.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No visits with feedback in the last 30 days.</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {noShow} no-show{noShow === 1 ? "" : "s"} and {cancelled} cancellation{cancelled === 1 ? "" : "s"} in the same period.
          </p>
        </Panel>

        <Panel title="Listings by zone" hint="Active listings on this desk">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                <th className="pb-2 font-semibold">Zone</th>
                <th className="pb-2 text-right font-semibold">Active</th>
                <th className="pb-2 text-right font-semibold">Avg per m²</th>
                <th className="pb-2 text-right font-semibold">Avg days listed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {zones.map((z) => (
                <tr key={z.z}>
                  <td className="py-2 text-foreground">{z.z}</td>
                  <td className="tabular py-2 text-right font-mono">{z.active}</td>
                  <td className="tabular py-2 text-right font-mono">{z.perSqm ? money(z.perSqm) : "—"}</td>
                  <td className="tabular py-2 text-right font-mono">{z.days ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="What Helix did" hint={`Actions run through Helix since this desk was loaded. ${viaChat} came from chat; the rest from buttons you clicked.`}>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <dl className="grid grid-cols-3 gap-3">
              {[
                { label: "Ran", value: runs.length },
                { label: "Asked you first", value: proposed },
                { label: "Undone", value: undos },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-background/40 p-3">
                  <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">{s.label}</dt>
                  <dd className="tabular font-mono text-xl font-semibold text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
            {byAction.length ? (
              <ul className="mt-4 space-y-2.5">
                {byAction.slice(0, 6).map(([a, n]) => (
                  <Bar key={a} label={ACTION_LABEL[a] ?? a} value={n} max={byAction[0][1]} tone="bg-violet-400" wide />
                ))}
              </ul>
            ) : null}
          </div>
          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Recent activity</h3>
            {activity.length ? (
              <ol className="mt-2 divide-y divide-border">
                {activity.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                    <span className="text-foreground">
                      {a.kind === "proposed" ? "Proposed: " : a.kind === "undo" ? "Undid: " : ""}
                      {ACTION_LABEL[a.action] ?? a.action}
                      {a.labels.length ? <span className="text-muted-foreground"> — {a.labels.slice(0, 3).join(", ")}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.actor} · {a.via} · {fmtWhen(a.at)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing yet. Actions appear here as you use Helix — try the <Link href="/outreach" className="text-primary hover:underline">Outreach</Link> desk or Ask Helix AI.
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">The log lives in memory with the desk and resets when the demo is reloaded.</p>
      </Panel>
    </>
  );
}
