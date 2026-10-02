import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarPlus, ClipboardList, MessageSquareText } from "lucide-react";
import { Avatar, TierBadge, money } from "@/components/bits";
import { DeskActionButton } from "@/components/desk-action-button";
import { PropertyCover } from "@/components/property-cover";
import { Checklist, FeedbackForm, RescheduleControls } from "@/components/showing-forms";
import { InterestLabel, ShowingStatusBadge } from "@/components/showing-bits";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { fitFor } from "@/lib/scoring";
import { needsFeedback } from "@/lib/showings";
import { getLead, getProperty, getShowing } from "@/lib/store";
import { fmtWhen, hm, ymd } from "@/lib/when";

export const dynamic = "force-dynamic";

const FIN: Record<string, string> = { cash: "Cash buyer", preapproved: "Pre-approved", needs_financing: "Needs financing", unknown: "Financing unknown" };

export default async function ShowingPage({ params }: PageProps<"/calendar/[id]">) {
  const { id } = await params;
  const s = await getShowing(id);
  if (!s) notFound();
  const [lead, prop] = await Promise.all([getLead(s.leadId), getProperty(s.propertyId)]);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const who = `${lead?.name ?? "Buyer"} · ${prop?.title ?? "listing"}`;
  const fit = lead && prop ? fitFor(lead, prop) : null;
  const start = new Date(s.startsAt);
  const late = needsFeedback(s, now);
  const fb = s.feedback;
  const canAdvance = lead && ["new", "contacted", "visit"].includes(lead.stage);

  return (
    <>
      <Link href="/calendar" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Calendar
      </Link>

      <header data-ai-id={s.id} className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card/80 p-5">
        {prop ? <PropertyCover kind={prop.kind} cover={prop.cover} photo={DEMO_PHOTOS[prop.id]} photoAlt={`${prop.title} — sample photo`} className="h-24 w-36 shrink-0 rounded-xl border border-border" /> : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-2">
            <ShowingStatusBadge status={s.status} late={late} />
            <span className="text-xs text-muted-foreground">
              {s.durationMin} min · booked by {s.createdBy}
            </span>
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{fmtWhen(s.startsAt)}</h1>
          <p className="text-sm text-muted-foreground">
            {prop ? (
              <Link href={`/properties/${prop.id}`} className="text-primary hover:underline">
                {prop.title}
              </Link>
            ) : (
              "Listing removed"
            )}
            {prop ? ` · ${prop.address}, ${prop.zone} · ${money(prop.price)}` : ""}
          </p>
        </div>
        {lead ? (
          <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-primary/50">
            <Avatar name={lead.name} />
            <span>
              <span className="block text-sm font-semibold text-foreground">{lead.name}</span>
              <span className="block text-xs text-muted-foreground capitalize">Stage: {lead.stage}</span>
            </span>
            <TierBadge tier={lead.buyer.tier} score={lead.buyer.score} />
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="before-h" className="space-y-5 rounded-xl border border-border bg-card/80 p-5">
          <h2 id="before-h" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ClipboardList className="size-5 text-primary" aria-hidden /> Before the visit
          </h2>
          {lead ? (
            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
              <p className="text-muted-foreground">
                Brief: {lead.budget > 0 ? `up to ${money(lead.budget)}` : "no budget stated"} · {lead.zones.join(", ") || "any zone"} · {lead.bedsMin ? `${lead.bedsMin}+ bd` : "beds not stated"} ·{" "}
                {FIN[lead.financing]}
              </p>
              <p className="text-foreground/90 italic">“{lead.message}”</p>
              {fit ? (
                <p>
                  <span className="font-semibold text-primary">Fit {fit.fit}</span>
                  {fit.reasons.length ? <span className="text-emerald-300/90"> · ✓ {fit.reasons.join(" · ")}</span> : null}
                  {fit.concerns.length ? <span className="text-amber-300/90"> · ! {fit.concerns.join(" · ")}</span> : null}
                </p>
              ) : null}
            </div>
          ) : null}
          <Checklist showingId={s.id} label={who} items={s.checklist} editable={s.status === "scheduled"} />
          {s.status === "scheduled" ? (
            <div className="border-t border-border pt-4">
              <RescheduleControls showingId={s.id} label={who} date={ymd(start)} time={hm(start)} />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="after-h" className="space-y-4 rounded-xl border border-border bg-card/80 p-5">
          <h2 id="after-h" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <MessageSquareText className="size-5 text-primary" aria-hidden /> After the visit
          </h2>
          {s.status === "scheduled" ? (
            <FeedbackForm showingId={s.id} label={who} started={start.getTime() <= now} />
          ) : s.status === "cancelled" ? (
            <p className="text-sm text-muted-foreground">This showing was cancelled.</p>
          ) : s.status === "no_show" ? (
            <p className="text-sm text-muted-foreground">The buyer didn&apos;t show. Reach out before booking again.</p>
          ) : fb ? (
            <div className="space-y-3">
              <InterestLabel interest={fb.interest} />
              {fb.objections.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Objections">
                  {fb.objections.map((o) => (
                    <li key={o} className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-200">
                      {o}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No objections recorded.</p>
              )}
              {fb.notes ? <p className="rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground/90">{fb.notes}</p> : null}
              <p className="text-[11px] text-muted-foreground">
                Recorded by {fb.recordedBy} · {fmtWhen(fb.recordedAt)}
              </p>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Suggested next step</p>
                {fb.interest === "high" && canAdvance && lead ? (
                  <DeskActionButton action="move_stage" targetIds={[lead.id]} labels={[lead.name]} params={{ stage: "offer" }} variant="primary" busyLabel="Moving…">
                    <ArrowRight className="size-4" aria-hidden /> Move {lead.name} to Offer
                  </DeskActionButton>
                ) : fb.interest === "high" ? (
                  <p className="text-sm text-muted-foreground">Already at {lead?.stage ?? "a later stage"}.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {fb.interest === "medium" ? "Address the objections, or line up a closer match." : "Not the one — show them a better fit."}
                  </p>
                )}
                {lead && fb.interest !== "high" ? (
                  <Link href={`/calendar?lead=${lead.id}#schedule`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <CalendarPlus className="size-4" aria-hidden /> Book another showing for {lead.name}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
