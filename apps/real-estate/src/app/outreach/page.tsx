import Link from "next/link";
import { Check, Home, Info, Mail, MailQuestion, MessageCircle, RotateCcw, Snowflake, X } from "lucide-react";
import { Avatar } from "@/components/bits";
import { BatchApproveBar, DraftSelect } from "@/components/batch-approve";
import { DeskActionButton } from "@/components/desk-action-button";
import { ToneSelect, TonedDeskActionButton } from "@/components/draft-tone";
import { DraftPreview } from "@/components/draft-preview";
import { PersonalizeButton, SendDraftControls } from "@/components/draft-send";
import { claudeReady } from "@/lib/ai-claude";
import { CHANNEL_LABEL, CHANNELS, channelReady, type Channel } from "@/lib/messaging";
import { COLD_AFTER_DAYS, isCold } from "@/lib/outreach";
import { listDrafts, listLeads, listProperties, type ScoredLead } from "@/lib/store";
import type { OutreachDraft, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

const KIND = {
  new_match: { label: "New listing alert", icon: Home },
  reactivation: { label: "Cold-buyer check-in", icon: Snowflake },
} as const;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function DraftCard({ d, lead, props, claude }: { d: OutreachDraft; lead: ScoredLead | undefined; props: Property[]; claude: boolean }) {
  const kind = KIND[d.kind];
  const name = lead?.name ?? "Unknown buyer";
  const label = `${name}: ${d.subject}`;
  return (
    <article data-ai-id={d.id} className="overflow-hidden rounded-2xl border border-border bg-card/80">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <DraftSelect id={d.id} label={label} />
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          {lead ? (
            <Link href={`/leads/${lead.id}`} className="font-semibold text-foreground hover:text-primary focus-visible:underline">
              {name}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{name}</span>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail size={14} className="text-sky-400" aria-label="Email" /> {lead?.email ?? "No email on file"}
            </span>
            {lead?.phone ? (
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={14} className="text-emerald-400" aria-label="WhatsApp" /> <span className="tabular font-mono">{lead.phone}</span>
              </span>
            ) : null}
            <span>drafted {when(d.createdAt)}</span>
          </p>
        </div>
        {d.writer === "claude" ? (
          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300 ring-1 ring-orange-500/30">Worded by Claude</span>
        ) : null}
        {d.queuedBy === "nightly" ? (
          <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/30">Nightly matching</span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          <kind.icon className="size-3.5" aria-hidden /> {kind.label}
        </span>
      </header>
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1fr_260px]">
        <DraftPreview subject={d.subject} body={d.body} to={lead?.email ?? "No email on file"} hasPhone={!!lead?.phone} />
        <aside className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Why this?</p>
            <ul className="mt-1.5 space-y-1 text-xs text-foreground">
              {d.why.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </div>
          {d.explanation && d.writer === "claude" ? (
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Claude&apos;s reading of the match</p>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{d.explanation}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">The fit score above is computed by the desk, not by Claude.</p>
            </div>
          ) : null}
          {props.length ? (
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Listings mentioned</p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {props.map((p) => (
                  <li key={p.id}>
                    <Link href={`/properties/${p.id}`} className="text-primary hover:underline">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/30 px-5 py-3">
        <p className="mr-auto text-[11px] text-muted-foreground">Approving records your sign-off; nothing is sent. Sending is a separate step you confirm for each message.</p>
        {d.kind === "new_match" ? <PersonalizeButton draftId={d.id} claude={claude} /> : null}
        <DeskActionButton action="dismiss_draft" targetIds={[d.id]} labels={[label]} variant="ghost" busyLabel="Dismissing…">
          <X className="size-4" aria-hidden /> Dismiss
        </DeskActionButton>
        <DeskActionButton action="approve_draft" targetIds={[d.id]} labels={[label]} variant="glow" busyLabel="Approving…">
          <Check className="size-4" aria-hidden /> Approve (not sent yet)
        </DeskActionButton>
      </footer>
    </article>
  );
}

export default async function OutreachPage() {
  const [drafts, leads, props] = await Promise.all([listDrafts(), listLeads(), listProperties()]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const propById = new Map(props.map((p) => [p.id, p]));
  const pending = drafts.filter((d) => d.status === "pending");
  const decided = drafts.filter((d) => d.status !== "pending");
  const waiting = new Set(pending.filter((d) => d.kind === "reactivation").map((d) => d.leadId));
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const cold = leads.filter((l) => isCold(l, now) && !waiting.has(l.id));
  const claude = claudeReady();
  const ready = Object.fromEntries(CHANNELS.map((c) => [c, channelReady(c)])) as Record<Channel, boolean>;
  const connected = CHANNELS.filter((c) => ready[c]).map((c) => CHANNEL_LABEL[c]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Outreach</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Helix drafts the messages; you approve each one. {pending.length} waiting · {decided.length} decided
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToneSelect />
          {cold.length ? (
            <TonedDeskActionButton action="draft_reactivation" targetIds={cold.map((l) => l.id)} labels={cold.map((l) => l.name)} variant="outline" busyLabel="Drafting…">
              <Snowflake className="size-4" aria-hidden /> Draft check-ins for {cold.length} cold buyer{cold.length === 1 ? "" : "s"}
            </TonedDeskActionButton>
          ) : null}
        </div>
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {connected.length
            ? `Connected for sending: ${connected.join(", ")}. A message goes out only after you approve the draft and then confirm the send for that buyer and channel.`
            : "No email, SMS or WhatsApp account is connected, so nothing is sent from this desk. Approving records your sign-off; copy the message into your own inbox to send it."}{" "}
          Cold means an open buyer with no contact in more than {COLD_AFTER_DAYS} days.
        </span>
      </p>

      <section aria-labelledby="pending-h" className="space-y-4">
        <h2 id="pending-h" className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Waiting for approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <MailQuestion className="mx-auto size-8 text-primary" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">No drafts waiting.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Open a listing and use <span className="text-foreground">Notify matching buyers</span>, draft check-ins for cold buyers above, or ask Helix AI:
              &ldquo;Notify buyers about the Riverside loft&rdquo;.
            </p>
          </div>
        ) : (
          <>
          <BatchApproveBar items={pending.map((d) => ({ id: d.id, kind: d.kind, label: `${leadById.get(d.leadId)?.name ?? "Unknown buyer"}: ${d.subject}` }))} />
          {pending.map((d) => (
            <DraftCard key={d.id} d={d} lead={leadById.get(d.leadId)} props={d.propertyIds.map((id) => propById.get(id)).filter((p): p is Property => !!p)} claude={claude} />
          ))}
          </>
        )}
      </section>

      {decided.length ? (
        <section aria-labelledby="history-h" className="space-y-3">
          <h2 id="history-h" className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Decided
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/80">
            {decided.map((d) => {
              const lead = leadById.get(d.leadId);
              const name = lead?.name ?? "Unknown buyer";
              const approved = d.status === "approved";
              const sent = d.deliveries?.length ?? 0;
              return (
                <li key={d.id} data-ai-id={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className={`inline-flex size-7 items-center justify-center rounded-full ${approved ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {approved ? <Check className="size-4" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{name}</span>
                    <span className="text-muted-foreground"> · {d.subject}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {approved ? (sent ? `Approved · sent on ${sent} channel${sent === 1 ? "" : "s"}` : "Approved — not sent yet") : "Dismissed"}
                    {d.decidedBy ? ` by ${d.decidedBy}` : ""}
                    {d.decidedAt ? ` · ${when(d.decidedAt)}` : ""}
                  </span>
                  {approved && lead ? (
                    <div className="basis-full pl-10">
                      <SendDraftControls draftId={d.id} leadName={name} email={lead.email} phone={lead.phone} subject={d.subject} body={d.body} ready={ready} deliveries={d.deliveries ?? []} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
