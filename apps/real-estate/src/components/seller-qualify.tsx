import Link from "next/link";
import { Check, CircleAlert, ClipboardCheck, X } from "lucide-react";
import { Avatar, KIND_LABEL, money } from "@/components/bits";
import { DeskActionButton } from "@/components/desk-action-button";
import { buyersForSeller, deskComps } from "@/lib/sellers";
import type { ScoredLead } from "@/lib/store";
import type { Property, Seller } from "@/lib/types";
import { cn } from "@/lib/utils";

type QualCheck = { label: string; ok: boolean | null; detail: string };

/** Four plain checks per prospect, all from desk records. "null" means there isn't enough on the desk to say. */
function checksFor(s: Seller, leads: ScoredLead[], props: Property[]): QualCheck[] {
  const comps = deskComps(s, props);
  const fits = buyersForSeller(s, leads).length;
  let price: QualCheck;
  if (!s.askingPrice) price = { label: "Price in line with your listings", ok: null, detail: "No asking price yet" };
  else if (!comps) price = { label: "Price in line with your listings", ok: null, detail: `No listings of yours in ${s.zone} to compare` };
  else {
    const over = s.askingPrice > comps.high * 1.1;
    const under = s.askingPrice < comps.low * 0.9;
    price = {
      label: "Price in line with your listings",
      ok: !over && !under,
      detail: `${money(s.askingPrice)} vs ${money(comps.low)}–${money(comps.high)} from ${comps.basis.length} desk listing${comps.basis.length === 1 ? "" : "s"}${over ? " — above range" : under ? " — below range" : ""}`,
    };
  }
  return [
    { label: "Asking price stated", ok: !!s.askingPrice, detail: s.askingPrice ? money(s.askingPrice) : "Ask the owner what they hope to get" },
    price,
    { label: "Buyers on the desk could fit", ok: fits > 0, detail: fits ? `${fits} open buyer${fits === 1 ? "" : "s"} match zone, beds and budget` : "No open buyer fits yet" },
    { label: "Reachable", ok: !!(s.phone || s.email), detail: [s.phone, s.email].filter(Boolean).join(" · ") || "No phone or email on file" },
  ];
}

function Mark({ ok }: { ok: boolean | null }) {
  if (ok === true)
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        <Check className="size-3" strokeWidth={3} aria-label="Pass" />
      </span>
    );
  if (ok === false)
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
        <X className="size-3" strokeWidth={3} aria-label="Fail" />
      </span>
    );
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
      <CircleAlert className="size-3" aria-label="Unknown" />
    </span>
  );
}

/**
 * Prospects are reviewed before they enter the pipeline: accept moves them to a price opinion, decline marks
 * them lost (asks first). Both are your clicks, with Undo; nothing is sent to the owner.
 */
export function SellerQualify({ prospects, leads, props }: { prospects: Seller[]; leads: ScoredLead[]; props: Property[] }) {
  return (
    <section id="qualify" aria-labelledby="qualify-h" className="scroll-mt-6 rounded-xl border border-border bg-card/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h2 id="qualify-h" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ClipboardCheck className="size-5 text-primary" aria-hidden /> Qualify new prospects
          </h2>
          <p className="text-xs text-muted-foreground">Check each owner before they enter your inventory. Accept moves them to a price opinion.</p>
        </div>
        <span className="tabular rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-foreground">{prospects.length} to review</span>
      </div>
      {prospects.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No prospects waiting. New owners you add land here first.</p>
      ) : (
        <ul className="divide-y divide-border">
          {prospects.map((s) => {
            const checks = checksFor(s, leads, props);
            const passed = checks.filter((c) => c.ok === true).length;
            return (
              <li key={s.id} data-ai-id={s.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,15rem)_1fr_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size="sm" />
                  <div className="min-w-0">
                    <Link href={`/sellers/${s.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-primary">
                      {s.name}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {KIND_LABEL[s.kind]} · {s.sqm} m² · {s.zone} · {s.source}
                    </p>
                    <p className={cn("tabular mt-0.5 font-mono text-[11px] font-semibold", passed >= 3 ? "text-emerald-300" : passed >= 2 ? "text-amber-300" : "text-rose-300")}>{passed}/4 checks pass</p>
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {checks.map((c) => (
                    <li key={c.label} className="flex items-start gap-2 text-xs">
                      <Mark ok={c.ok} />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{c.label}</span>
                        <span className="block truncate text-muted-foreground" title={c.detail}>
                          {c.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 lg:flex-col">
                  <DeskActionButton action="move_seller_stage" targetIds={[s.id]} labels={[s.name]} params={{ stage: "valuation" }} variant="primary" busyLabel="Accepting…">
                    <Check className="size-4" aria-hidden /> Accept
                  </DeskActionButton>
                  <DeskActionButton
                    action="move_seller_stage"
                    targetIds={[s.id]}
                    labels={[s.name]}
                    params={{ stage: "lost" }}
                    variant="ghost"
                    busyLabel="Declining…"
                    confirm={`Decline ${s.name}? They move to Lost and leave your pipeline. You can undo right after.`}
                  >
                    <X className="size-4" aria-hidden /> Decline
                  </DeskActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
