import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Download, Info, MessageSquareWarning, Route } from "lucide-react";
import { Avatar } from "@/components/bits";
import { ScheduleShowingForm } from "@/components/showing-forms";
import { ShowingStatusBadge } from "@/components/showing-bits";
import { matchProperties } from "@/lib/scoring";
import { TONE_BORDER, TodayTimeline, ToneLegend, UpNextCard } from "@/components/showing-day";
import { needsFeedback, sameDay, weekStart } from "@/lib/showings";
import { SHOWING_TONE_LABEL, showingTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { listLeads, listProperties, listShowings } from "@/lib/store";
import { fmtDay, fmtTime, fmtWhen, ymd } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const offset = Math.max(-52, Math.min(52, Number(Array.isArray(sp.w) ? sp.w[0] : sp.w) || 0));
  const initialLead = typeof sp.lead === "string" ? sp.lead : undefined;
  const [showings, leads, props] = await Promise.all([listShowings(), listLeads(), listProperties()]);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const propById = new Map(props.map((p) => [p.id, p]));
  const start = weekStart(now, offset);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const inWeek = showings.filter((s) => Date.parse(s.startsAt) >= start.getTime() && Date.parse(s.startsAt) < end.getTime());
  const pending = showings.filter((s) => needsFeedback(s, now));
  const upcoming = showings.filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const todays = showings.filter((s) => sameDay(Date.parse(s.startsAt), now));
  const routeStops = todays
    .filter((s) => s.status === "scheduled")
    .map((s) => propById.get(s.propertyId))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const zoneHops = routeStops.slice(1).filter((p, i) => p.zone !== routeStops[i].zone).length;
  const place = (p: (typeof routeStops)[number]) => encodeURIComponent(`${p.address}, ${p.zone}`);
  const mapsUrl =
    routeStops.length >= 2
      ? `https://www.google.com/maps/dir/?api=1&origin=${place(routeStops[0])}&destination=${place(routeStops[routeStops.length - 1])}${
          routeStops.length > 2 ? `&waypoints=${routeStops.slice(1, -1).map(place).join("%7C")}` : ""
        }`
      : "";

  const open = leads.filter((l) => l.stage !== "closed" && l.stage !== "archived");
  const active = props.filter((p) => p.status === "active");
  const bestFor = Object.fromEntries(open.map((l) => [l.id, matchProperties(l, active, active.length).map((m) => ({ id: m.property.id, fit: m.fit }))]));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {upcoming.length} upcoming showing{upcoming.length === 1 ? "" : "s"} · {pending.length} waiting for feedback
          </p>
        </div>
        <nav aria-label="Week" className="flex items-center gap-1">
          <Link href={`/calendar?w=${offset - 1}`} aria-label="Previous week" className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href="/calendar"
            className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold ${offset === 0 ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            This week
          </Link>
          <Link href={`/calendar?w=${offset + 1}`} aria-label="Next week" className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200 ring-1 ring-amber-400/25">
        <Info className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          Two-way sync with Google or Outlook isn&apos;t connected yet, so moving or cancelling a showing here notifies nobody. Until it is, export an .ics file and import
          it into your calendar — a one-time copy, not a sync.
        </p>
        <a href="/api/calendar/ics" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-amber-400/15 px-3 font-semibold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-400/25">
          <Download className="size-3.5" aria-hidden /> Export upcoming (.ics)
        </a>
        <Link href="/settings#integrations" className="font-semibold underline-offset-2 hover:underline">
          Integrations →
        </Link>
      </div>

      <section aria-labelledby="today-h" className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card/80 p-4 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="today-h" className="text-lg font-semibold text-foreground">
              Today · {fmtDay(new Date(now))}
            </h2>
            <p className="text-xs text-muted-foreground">
              {todays.length} showing{todays.length === 1 ? "" : "s"} · red line is now
            </p>
          </div>
          <TodayTimeline showings={todays} leadById={leadById} propById={propById} now={now} />
          <div className="mt-4">
            <ToneLegend />
          </div>
          {routeStops.length >= 2 ? (
            <div className="mt-4 rounded-lg bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Route className="size-4 text-primary" aria-hidden /> Today&apos;s route · {routeStops.length} stops · {zoneHops} zone change{zoneHops === 1 ? "" : "s"}
                </p>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
                  Open in Google Maps →
                </a>
              </div>
              <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                {routeStops.map((p, i) => (
                  <li key={`${p.id}-${i}`}>
                    <span className="tabular font-mono text-foreground">{i + 1}.</span> {p.title} · {p.address}, {p.zone}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-muted-foreground">In visit order. The desk has no map distances — Google Maps works out the drive.</p>
            </div>
          ) : null}
        </div>
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Up next</h2>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-border bg-card/80 px-4 py-6 text-center text-sm text-muted-foreground">Nothing booked ahead.</p>
          ) : (
            upcoming.slice(0, 3).map((s) => <UpNextCard key={s.id} s={s} lead={leadById.get(s.leadId)} prop={propById.get(s.propertyId)} now={now} />)
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            WhatsApp, Call and Email open the app on your own device with the buyer&apos;s number or address — Helix doesn&apos;t send anything. Phone numbers on the demo desk are fictional.
          </p>
        </div>
      </section>

      {pending.length ? (
        <section id="feedback" aria-labelledby="fb-h" className="scroll-mt-6 rounded-xl border border-primary/30 bg-card/80">
          <h2 id="fb-h" className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
            <MessageSquareWarning className="size-4 text-primary" aria-hidden /> How did it go? Record feedback while it&apos;s fresh
          </h2>
          <ul className="divide-y divide-border">
            {pending.map((s) => {
              const lead = leadById.get(s.leadId);
              return (
                <li key={s.id} data-ai-id={s.id}>
                  <Link href={`/calendar/${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-accent/40">
                    <Avatar name={lead?.name ?? "?"} size="sm" />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold text-foreground">{lead?.name ?? "Unknown buyer"}</span>
                      <span className="text-muted-foreground"> · {propById.get(s.propertyId)?.title ?? "Unknown listing"}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtWhen(s.startsAt)}</span>
                    <span className="text-xs font-semibold text-primary">Add feedback →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-label={`Week of ${fmtDay(start)}`} className="flex snap-x gap-2 overflow-x-auto pb-2 2xl:grid 2xl:grid-cols-7 2xl:overflow-visible">
        {days.map((d) => {
          const today = sameDay(d.getTime(), now);
          const list = inWeek.filter((s) => sameDay(Date.parse(s.startsAt), d.getTime()));
          return (
            <div key={d.toISOString()} className={`flex min-h-48 w-52 shrink-0 snap-start flex-col rounded-xl border bg-card/60 2xl:w-auto ${today ? "border-primary/50" : "border-border"}`}>
              <h3 className={`border-b border-border px-3 py-2 text-xs font-semibold tracking-wider uppercase ${today ? "text-primary" : "text-muted-foreground"}`}>
                {fmtDay(d)}
                {today ? " · Today" : ""}
              </h3>
              <ul className="flex-1 space-y-2 p-2">
                {list.map((s) => {
                  const lead = leadById.get(s.leadId);
                  const prop = propById.get(s.propertyId);
                  const late = needsFeedback(s, now);
                  const tone = showingTone(s, now);
                  return (
                    <li key={s.id} data-ai-id={s.id}>
                      <Link
                        href={`/calendar/${s.id}`}
                        title={SHOWING_TONE_LABEL[tone]}
                        className={cn(
                          "block rounded-lg border border-l-4 p-2.5 transition hover:border-primary/50",
                          s.status === "cancelled" ? "border-border/60 opacity-60" : late ? "border-sky-400/30 bg-sky-500/5" : "border-border bg-background/70",
                          TONE_BORDER[tone]
                        )}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-1">
                          <span className="tabular font-mono text-xs font-semibold text-foreground">{fmtTime(s.startsAt)}</span>
                          <ShowingStatusBadge status={s.status} late={late} />
                        </span>
                        <span className="mt-1 block truncate text-sm font-semibold text-foreground">{lead?.name ?? "Unknown buyer"}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{prop?.title ?? "Unknown listing"}</span>
                      </Link>
                    </li>
                  );
                })}
                {list.length === 0 ? <li className="px-1 py-4 text-center text-[11px] text-muted-foreground">No showings</li> : null}
              </ul>
            </div>
          );
        })}
      </section>

      <section id="schedule" aria-labelledby="book-h" className="space-y-3 rounded-xl border border-border bg-card/80 p-5">
        <div>
          <h2 id="book-h" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CalendarClock className="size-5 text-primary" aria-hidden /> Book a showing
          </h2>
          <p className="text-xs text-muted-foreground">Listings are ordered by fit for the buyer you pick. Helix refuses overlapping slots and listings that aren&apos;t active.</p>
        </div>
        <ScheduleShowingForm
          leads={open.map((l) => ({ id: l.id, name: l.name }))}
          properties={active.map((p) => ({ id: p.id, title: p.title, zone: p.zone, price: p.price }))}
          bestFor={bestFor}
          initialLead={initialLead}
          defaultDate={ymd(new Date(now))}
        />
      </section>
    </>
  );
}
