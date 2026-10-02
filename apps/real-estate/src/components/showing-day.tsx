import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Avatar } from "@/components/bits";
import { PropertyCover } from "@/components/property-cover";
import { ShowingQuickActions } from "@/components/showing-quick-actions";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { endsAt } from "@/lib/showings";
import { SHOWING_TONE_LABEL, phoneDigits, showingTone, type ShowingTone } from "@/lib/status";
import type { Lead, Property, Showing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtTime, fmtWhen } from "@/lib/when";

export const TONE_BORDER: Record<ShowingTone, string> = {
  confirmed: "border-l-emerald-400",
  unconfirmed: "border-l-amber-400",
  feedback: "border-l-sky-400",
  completed: "border-l-slate-500",
  cancelled: "border-l-slate-700",
};

const TONE_FILL: Record<ShowingTone, string> = {
  confirmed: "bg-emerald-500/10",
  unconfirmed: "bg-amber-500/10",
  feedback: "bg-sky-500/10",
  completed: "bg-slate-500/10",
  cancelled: "bg-slate-800/40 opacity-60",
};

const TONE_TEXT: Record<ShowingTone, string> = {
  confirmed: "text-emerald-300",
  unconfirmed: "text-amber-300",
  feedback: "text-sky-300",
  completed: "text-slate-300",
  cancelled: "text-slate-400",
};

export function ToneLabel({ tone }: { tone: ShowingTone }) {
  return <span className={cn("text-[11px] font-semibold", TONE_TEXT[tone])}>{SHOWING_TONE_LABEL[tone]}</span>;
}

export function ToneLegend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {(["confirmed", "unconfirmed", "feedback", "completed"] as ShowingTone[]).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-1 rounded-full border-l-4", TONE_BORDER[t])} aria-hidden /> {SHOWING_TONE_LABEL[t]}
        </span>
      ))}
      <span>“Confirmed” = you ticked “Confirm the time with the buyer” on the visit checklist.</span>
    </p>
  );
}

const FIRST_HOUR = 8;
const LAST_HOUR = 21;
const HOUR_PX = 44;

const minutesOfDay = (t: number) => {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
};

/** Today from 8:00 to 21:00, with a red line at the current time. */
export function TodayTimeline({ showings, leadById, propById, now }: { showings: Showing[]; leadById: Map<string, Lead>; propById: Map<string, Property>; now: number }) {
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const top = (min: number) => ((min - FIRST_HOUR * 60) / 60) * HOUR_PX;
  const height = (LAST_HOUR - FIRST_HOUR) * HOUR_PX;
  const nowMin = minutesOfDay(now);
  const nowLabel = fmtTime(new Date(now).toISOString());
  const nowEdge = nowMin < FIRST_HOUR * 60 ? "before" : nowMin > LAST_HOUR * 60 ? "after" : null;
  const nowTop = top(Math.min(Math.max(nowMin, FIRST_HOUR * 60), LAST_HOUR * 60));
  return (
    <div className="relative ml-12" style={{ height }}>
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: top(h * 60) }}>
          <span className="tabular absolute -top-2 -left-12 w-10 text-right font-mono text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}:00</span>
        </div>
      ))}
      {showings.map((s) => {
        const start = Math.max(minutesOfDay(Date.parse(s.startsAt)), FIRST_HOUR * 60);
        const end = Math.min(minutesOfDay(endsAt(s)), LAST_HOUR * 60);
        if (end <= FIRST_HOUR * 60 || start >= LAST_HOUR * 60) return null;
        const tone = showingTone(s, now);
        return (
          <Link
            key={s.id}
            href={`/calendar/${s.id}`}
            data-ai-id={s.id}
            className={cn("absolute right-1 left-1 overflow-hidden rounded-md border-l-4 px-2.5 py-1 text-xs ring-1 ring-border transition hover:ring-primary/50", TONE_BORDER[tone], TONE_FILL[tone])}
            style={{ top: top(start) + 1, height: Math.max(top(end) - top(start) - 2, 22) }}
          >
            <span className="tabular font-mono font-semibold text-foreground">{fmtTime(s.startsAt)}</span>{" "}
            <span className="font-semibold text-foreground">{leadById.get(s.leadId)?.name ?? "Unknown buyer"}</span>
            <span className="text-muted-foreground"> · {propById.get(s.propertyId)?.title ?? "Unknown listing"}</span>{" "}
            <ToneLabel tone={tone} />
          </Link>
        );
      })}
      <div className="pointer-events-none absolute inset-x-0 z-10 flex -translate-y-1/2 items-center" style={{ top: nowTop }} role="img" aria-label={`Now, ${nowLabel}`}>
        <span className="-ml-1.5 size-3 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        <span className={cn("h-0.5 flex-1", nowEdge ? "bg-[repeating-linear-gradient(90deg,#ef4444_0_6px,transparent_6px_10px)]" : "bg-red-500")} />
        <span className="tabular ml-1 shrink-0 rounded bg-red-500 px-1.5 py-px font-mono text-[10px] font-semibold text-white">
          {nowEdge === "before" ? `Now ${nowLabel} · before ${FIRST_HOUR}:00` : nowEdge === "after" ? `Now ${nowLabel} · after ${LAST_HOUR}:00` : `Now ${nowLabel}`}
        </span>
      </div>
    </div>
  );
}

const CONTACT_BTN =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Thumbnail left, buyer and contact buttons right. The buttons open the agent's own WhatsApp or mail app; Helix sends nothing. */
export function UpNextCard({ s, lead, prop, now }: { s: Showing; lead?: Lead; prop?: Property; now: number }) {
  const tone = showingTone(s, now);
  const first = lead?.name.split(" ")[0] ?? "";
  const waText = prop ? `Hi ${first}, confirming our visit to ${prop.title} on ${fmtWhen(s.startsAt)}. Does that still work for you?` : "";
  const mailSubject = prop ? `Visit to ${prop.title} — ${fmtWhen(s.startsAt)}` : "Our visit";
  const label = `${lead?.name ?? "Buyer"} at ${prop?.title ?? "listing"}`;
  return (
    <article data-ai-id={s.id} className={cn("flex overflow-hidden rounded-xl border border-l-4 border-border bg-card/80", TONE_BORDER[tone])}>
      <Link href={`/calendar/${s.id}`} className="relative w-28 shrink-0 sm:w-32" aria-label={`Open showing: ${prop?.title ?? "listing"}`}>
        {prop ? <PropertyCover kind={prop.kind} cover={prop.cover} photo={DEMO_PHOTOS[prop.id]} photoAlt={`${prop.title} — sample photo`} className="h-full min-h-28" /> : <div className="h-full min-h-28 bg-muted" />}
        <span className="tabular absolute bottom-1.5 left-2 font-mono text-sm font-semibold text-white drop-shadow">{fmtTime(s.startsAt)}</span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2.5">
          <Avatar name={lead?.name ?? "?"} size="sm" />
          <div className="min-w-0 flex-1">
            <Link href={`/calendar/${s.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-primary">
              {lead?.name ?? "Unknown buyer"}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{prop?.title ?? "Unknown listing"}</p>
            <p className="text-[11px] text-muted-foreground">
              {fmtWhen(s.startsAt)} · <ToneLabel tone={tone} />
            </p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {lead?.phone ? (
            <>
              <a
                href={`https://wa.me/${phoneDigits(lead.phone)}?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(CONTACT_BTN, "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/25")}
              >
                <MessageCircle size={14} aria-hidden /> Ask to confirm
              </a>
              <a href={`tel:+${phoneDigits(lead.phone)}`} className={cn(CONTACT_BTN, "text-muted-foreground ring-border hover:text-foreground")}>
                <Phone size={14} aria-hidden /> Call
              </a>
            </>
          ) : null}
          {lead?.email ? (
            <a href={`mailto:${lead.email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(waText)}`} className={cn(CONTACT_BTN, "text-sky-300 ring-sky-500/30 hover:bg-sky-500/10")}>
              <Mail size={14} aria-hidden /> Email
            </a>
          ) : null}
          {!lead?.phone && !lead?.email ? <span className="text-[11px] text-muted-foreground">No phone or email on file.</span> : null}
        </div>
        {s.status === "scheduled" ? <ShowingQuickActions id={s.id} label={label} startsAt={s.startsAt} /> : null}
      </div>
    </article>
  );
}
