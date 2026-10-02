import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { Avatar, ScoreRing, money } from "@/components/bits";
import { PropertyCover } from "@/components/property-cover";
import { InterestLabel, ShowingStatusBadge } from "@/components/showing-bits";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { matchProperties } from "@/lib/scoring";
import { needsFeedback } from "@/lib/showings";
import { getLead, listProperties, listShowings } from "@/lib/store";
import { fmtWhen } from "@/lib/when";

export const dynamic = "force-dynamic";

const FIN: Record<string, string> = { cash: "Cash buyer", preapproved: "Pre-approved", needs_financing: "Needs financing", unknown: "Unknown" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const [props, allShowings] = await Promise.all([listProperties(), listShowings()]);
  const matches = matchProperties(lead, props);
  const propTitle = new Map(props.map((p) => [p.id, p.title]));
  const showings = allShowings.filter((s) => s.leadId === lead.id).reverse();
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();

  return (
    <>
      <Link href="/leads" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Leads
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar name={lead.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold text-foreground">{lead.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lead.email} · {lead.source}
            </p>
            <p className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground capitalize">Stage: {lead.stage}</span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">{FIN[lead.financing]}</span>
              {lead.budget > 0 ? <span className="tabular rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-primary">{money(lead.budget)}</span> : null}
            </p>
          </div>
          <ScoreRing score={lead.buyer.score} tier={lead.buyer.tier} size={84} />
        </div>
        <blockquote className="relative mt-5 border-l-2 border-primary/60 pl-4 text-sm leading-relaxed text-foreground/90 italic">“{lead.message}”</blockquote>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="why-heading">
          <h2 id="why-heading" className="text-lg font-semibold text-foreground">
            Why this score?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {lead.buyer.summary} Confidence {Math.round(lead.buyer.confidence * 100)}%.
          </p>
          <ul className="mt-4 space-y-3">
            {lead.buyer.factors.map((f) => (
              <li key={f.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-foreground">{f.label}</span>
                  <span className="tabular font-mono text-xs text-muted-foreground">
                    {f.points}/{f.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(f.points / f.max) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
            <div>
              <dt className="text-muted-foreground">Budget</dt>
              <dd className="tabular font-mono text-sm text-foreground">{lead.budget > 0 ? money(lead.budget) : "Not stated"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Financing</dt>
              <dd className="text-sm text-foreground">{FIN[lead.financing]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zones</dt>
              <dd className="text-sm text-foreground">{lead.zones.join(", ") || "Any"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Wants</dt>
              <dd className="text-sm text-foreground">{lead.bedsMin > 0 ? `${lead.bedsMin}+ bedrooms` : "Not stated"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card/80" aria-labelledby="match-heading">
          <div className="border-b border-border px-5 py-4">
            <h2 id="match-heading" className="text-lg font-semibold text-foreground">
              Best property matches
            </h2>
            <p className="text-xs text-muted-foreground">Top {matches.length} by fit with budget, zone and bedrooms</p>
          </div>
          {matches.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No active listing fits yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((m) => (
                <li key={m.property.id}>
                  <Link href={`/properties/${m.property.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none">
                    <PropertyCover kind={m.property.kind} cover={m.property.cover} photo={DEMO_PHOTOS[m.property.id]} photoAlt={`${m.property.title} — sample photo`} className="h-16 w-24 shrink-0 rounded-lg border border-border" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-foreground">{m.property.title}</span>
                        <span className="tabular shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary ring-1 ring-primary/30">fit {m.fit}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {money(m.property.price)} · {m.property.zone} · {m.property.beds} bd
                      </span>
                      {m.reasons.length ? <span className="block text-xs text-emerald-300/90">✓ {m.reasons.join(" · ")}</span> : null}
                      {m.concerns.length ? <span className="block text-xs text-amber-300/90">! {m.concerns.join(" · ")}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="show-h" className="rounded-xl border border-border bg-card/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="show-h" className="text-lg font-semibold text-foreground">
            Showings
          </h2>
          {lead.stage !== "closed" && lead.stage !== "archived" ? (
            <Link href={`/calendar?lead=${lead.id}#schedule`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <CalendarPlus className="size-4" aria-hidden /> Book a showing
            </Link>
          ) : null}
        </div>
        {showings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No showings yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {showings.map((s) => (
              <li key={s.id} data-ai-id={s.id}>
                <Link href={`/calendar/${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm transition hover:bg-accent/40">
                  <span className="tabular w-44 font-mono text-xs text-foreground">{fmtWhen(s.startsAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{propTitle.get(s.propertyId) ?? "Unknown listing"}</span>
                  {s.feedback ? <InterestLabel interest={s.feedback.interest} /> : null}
                  <ShowingStatusBadge status={s.status} late={needsFeedback(s, now)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
