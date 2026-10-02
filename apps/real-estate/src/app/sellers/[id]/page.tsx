import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePlus2, Mail, Phone } from "lucide-react";
import { Avatar, KIND_LABEL, StatusBadge, TierBadge, money } from "@/components/bits";
import { DeskActionButton } from "@/components/desk-action-button";
import { SellerStageSelect } from "@/components/seller-forms";
import { SellerProgress } from "@/components/seller-progress";
import { SELLER_STAGE_LABEL, buyersForSeller, deskComps } from "@/lib/sellers";
import { getProperty, getSeller, listLeads, listProperties } from "@/lib/store";
import { fmtWhen } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function SellerPage({ params }: PageProps<"/sellers/[id]">) {
  const { id } = await params;
  const s = await getSeller(id);
  if (!s) notFound();
  const [leads, props, listing] = await Promise.all([listLeads(), listProperties(), s.propertyId ? getProperty(s.propertyId) : null]);
  const comps = deskComps(s, props);
  const buyers = buyersForSeller(s, leads).slice(0, 6);
  const canDraftListing = !s.propertyId && s.askingPrice !== null && (s.stage === "agreement" || s.stage === "valuation");

  return (
    <>
      <Link href="/sellers" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Sellers
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/80 p-5">
        <Avatar name={s.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-foreground">{s.name}</h1>
          <p className="text-sm text-muted-foreground">
            {KIND_LABEL[s.kind]} · {s.address}, {s.zone} · {s.sqm} m² · {s.beds} bd
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {s.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden /> {s.email}
              </span>
            ) : null}
            {s.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" aria-hidden /> {s.phone}
              </span>
            ) : null}
            <span>Source: {s.source}</span>
            <span>{s.lastContactAt ? `Last contact ${fmtWhen(s.lastContactAt)}` : "Not contacted yet"}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Owner&apos;s asking price</p>
          <p className="tabular font-mono text-2xl font-semibold text-foreground">{s.askingPrice ? money(s.askingPrice) : "Not stated"}</p>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            Stage <SellerStageSelect id={s.id} name={s.name} stage={s.stage} />
          </div>
        </div>
        <div className="w-full border-t border-border pt-4">
          <SellerProgress stage={s.stage} size="lg" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="price-heading">
          <h2 id="price-heading" className="text-lg font-semibold text-foreground">
            Price range from your listings
          </h2>
          {comps ? (
            <>
              <p className="tabular mt-2 font-mono text-2xl font-semibold text-foreground">
                {money(comps.low)} – {money(comps.high)}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.sqm} m² × {money(comps.minPerSqm)}–{money(comps.maxPerSqm)} per m², from {comps.basis.length} of your {comps.sameKind ? `${KIND_LABEL[s.kind].toLowerCase()} ` : ""}
                listings in {s.zone}.
              </p>
              {s.askingPrice ? (
                <p className="mt-2 text-sm text-foreground">
                  The owner&apos;s ask of {money(s.askingPrice)} is{" "}
                  {s.askingPrice > comps.high ? "above" : s.askingPrice < comps.low ? "below" : "inside"} this range.
                </p>
              ) : null}
              <ul className="mt-3 divide-y divide-border text-sm">
                {comps.basis.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/properties/${p.id}`} className="truncate text-foreground hover:text-primary">
                      {p.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular font-mono text-xs text-muted-foreground">{money(Math.round(p.price / p.sqm))}/m²</span>
                      <StatusBadge status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">You have no listings in {s.zone} to compare against yet.</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Not a valuation. Asking prices, not sold prices. Do a proper market analysis before quoting the owner.</p>
        </section>

        <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="buyers-heading">
          <h2 id="buyers-heading" className="text-lg font-semibold text-foreground">
            Buyers who could fit
          </h2>
          <p className="text-xs text-muted-foreground">
            Open buyers looking in {s.zone} (or anywhere) who need {s.beds} bedroom{s.beds === 1 ? "" : "s"} or fewer
            {s.askingPrice ? `, with a budget of at least ${money(Math.round(s.askingPrice * 0.95))}` : ""}.
          </p>
          {buyers.length ? (
            <ul className="mt-3 divide-y divide-border">
              {buyers.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                    <span className="flex items-center gap-2.5 text-sm text-foreground">
                      <Avatar name={l.name} size="sm" />
                      <span>
                        {l.name}
                        <span className="block text-xs text-muted-foreground">
                          {money(l.budget)} · {l.zones.join(", ") || "any zone"} · {l.stage}
                        </span>
                      </span>
                    </span>
                    <TierBadge tier={l.buyer.tier} score={l.buyer.score} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No open buyer fits this property yet.</p>
          )}
          {buyers.length ? <p className="mt-3 text-[11px] text-muted-foreground">Useful in the pitch: real demand on your books, not a promise of a sale.</p> : null}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="listing-heading">
        <h2 id="listing-heading" className="text-lg font-semibold text-foreground">
          Listing
        </h2>
        {listing ? (
          <p className="mt-2 text-sm text-foreground">
            <Link href={`/properties/${listing.id}`} className="font-semibold text-primary hover:underline">
              {listing.title}
            </Link>{" "}
            · {money(listing.price)} · <StatusBadge status={listing.status} />
          </p>
        ) : canDraftListing ? (
          <div className="mt-2 space-y-2">
            <DeskActionButton action="create_listing_from_seller" targetIds={[s.id]} labels={[s.name]} variant="primary" busyLabel="Drafting…">
              <FilePlus2 className="size-4" aria-hidden /> Draft the listing at {money(s.askingPrice!)}
            </DeskActionButton>
            <p className="text-[11px] text-muted-foreground">Creates a draft on this desk and moves {s.name} to Listed. Nothing is published; you can undo.</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {s.stage === "lost"
              ? "This seller was lost."
              : s.askingPrice === null
                ? "Agree an asking price with the owner first, then you can draft the listing from here."
                : `Move ${s.name} to ${SELLER_STAGE_LABEL.valuation} or ${SELLER_STAGE_LABEL.agreement} to draft the listing.`}
          </p>
        )}
        {s.notes ? <p className="mt-4 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground/90">{s.notes}</p> : null}
      </section>
    </>
  );
}
