import Link from "next/link";
import { Info, UserPlus } from "lucide-react";
import { Avatar, KIND_LABEL, money } from "@/components/bits";
import { PropertyCover } from "@/components/property-cover";
import { AddSellerForm, SellerStageSelect } from "@/components/seller-forms";
import { SellerProgress } from "@/components/seller-progress";
import { SellerQualify } from "@/components/seller-qualify";
import { SELLER_BOARD, SELLER_STAGE_LABEL, buyersForSeller } from "@/lib/sellers";
import { contactRecency } from "@/lib/status";
import { listLeads, listProperties, listSellers } from "@/lib/store";

export const dynamic = "force-dynamic";

const SELLER_COVER: [string, string] = ["#1e293b", "#c9a24b"];

export default async function SellersPage() {
  const [sellers, leads, props] = await Promise.all([listSellers(), listLeads(), listProperties()]);
  const zones = [...new Set(props.map((p) => p.zone))].sort();
  const lost = sellers.filter((s) => s.stage === "lost");
  const working = sellers.filter((s) => s.stage !== "listed" && s.stage !== "lost").length;
  const propById = new Map(props.map((p) => [p.id, p]));
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Sellers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The listing side: {working} owner{working === 1 ? "" : "s"} you&apos;re working to win, and the sellers behind your listings.
          </p>
        </div>
        <a href="#add-seller" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/40 px-4 text-sm font-semibold text-primary transition hover:bg-primary/10">
          <UserPlus className="size-4" aria-hidden /> Add a seller
        </a>
      </header>

      <p className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Price ranges here come from your own listings&apos; price per m² — not a valuation. No sales records or AVM are connected, and nothing is sent to owners
          from this page.
        </span>
      </p>

      <SellerQualify prospects={sellers.filter((s) => s.stage === "prospect")} leads={leads} props={props} />

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="grid min-w-[56rem] grid-cols-4 gap-3">
          {SELLER_BOARD.map((stage) => {
            const col = sellers.filter((s) => s.stage === stage);
            return (
              <section key={stage} aria-labelledby={`col-${stage}`} className="flex min-h-48 flex-col rounded-xl border border-border bg-card/60">
                <h2 id={`col-${stage}`} className="flex items-center justify-between border-b border-border px-3 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {SELLER_STAGE_LABEL[stage]}
                  <span className="tabular rounded-full bg-muted px-2 py-px font-mono text-[11px] text-foreground">{col.length}</span>
                </h2>
                <ul className="flex-1 space-y-2 p-2">
                  {col.length === 0 ? <li className="px-2 py-6 text-center text-xs text-muted-foreground">Nobody here</li> : null}
                  {col.map((s) => {
                    const fits = buyersForSeller(s, leads).length;
                    const listing = s.propertyId ? propById.get(s.propertyId) : undefined;
                    return (
                      <li key={s.id} data-ai-id={s.id} className="overflow-hidden rounded-lg border border-border bg-background/50">
                        <Link href={`/sellers/${s.id}`} className="flex items-center gap-2.5 px-3 pt-3 pb-2.5 hover:text-primary">
                          <Avatar name={s.name} size="sm" recency={contactRecency(s.lastContactAt, now)} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">{s.name}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">Owner · {s.source}</span>
                          </span>
                        </Link>
                        <div className="flex gap-2.5 border-t border-border bg-card/40 px-3 py-2.5">
                          <PropertyCover kind={s.kind} cover={listing?.cover ?? SELLER_COVER} className="h-12 w-14 shrink-0 rounded-md" />
                          <div className="min-w-0 text-xs">
                            <p className="truncate font-medium text-foreground">
                              {KIND_LABEL[s.kind]} · {s.zone}
                            </p>
                            <p className="truncate text-muted-foreground">{s.address}</p>
                            <p className="tabular font-mono text-sm text-foreground">{s.askingPrice ? money(s.askingPrice) : "Price not stated"}</p>
                          </div>
                        </div>
                        <div className="space-y-2 border-t border-border px-3 py-2.5">
                          <SellerProgress stage={s.stage} />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              {stage === "listed" ? (s.propertyId ? "On your desk" : "Listed") : `${fits} buyer${fits === 1 ? "" : "s"} could fit`}
                            </span>
                            <SellerStageSelect id={s.id} name={s.name} stage={s.stage} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {lost.length ? (
        <p className="text-xs text-muted-foreground">
          Lost ({lost.length}):{" "}
          {lost.map((s, i) => (
            <span key={s.id}>
              {i ? ", " : ""}
              <Link href={`/sellers/${s.id}`} className="text-foreground hover:text-primary">
                {s.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      <section id="add-seller" className="scroll-mt-6 rounded-xl border border-border bg-card/80 p-5" aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-lg font-semibold text-foreground">
          Add a seller
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">New owners start as prospects. You can undo right after adding.</p>
        <AddSellerForm zones={zones} />
      </section>
    </>
  );
}
