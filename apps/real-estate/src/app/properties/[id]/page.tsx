import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, BellRing, MapPin, Maximize2, Megaphone, Tag } from "lucide-react";
import { Avatar, CoverChip, KIND_LABEL, StatusBadge, TierBadge, money } from "@/components/bits";
import { TonedDeskActionButton } from "@/components/draft-tone";
import { PromoCopy } from "@/components/promo-copy";
import { PropertyCover } from "@/components/property-cover";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { listingCopy } from "@/lib/listing-copy";
import { ALERT_MIN_FIT, buyersToAlert } from "@/lib/outreach";
import { matchProperties } from "@/lib/scoring";
import { getProperty, listDrafts, listLeads, listShowings } from "@/lib/store";
import { fmtWhen } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) notFound();

  const leads = await listLeads();
  const buyers = leads
    .filter((l) => l.stage !== "closed" && l.stage !== "archived")
    .map((l) => ({ l, m: matchProperties(l, [p], 1)[0] }))
    .filter((x) => x.m)
    .sort((a, b) => b.m.fit - a.m.fit || b.l.buyer.score - a.l.buyer.score)
    .slice(0, 5);
  const alerts = buyersToAlert(p, leads);
  const drafted = new Set((await listDrafts()).filter((d) => d.kind === "new_match" && d.propertyIds[0] === p.id).map((d) => d.leadId));
  const fresh = alerts.filter((b) => !drafted.has(b.lead.id));
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const upcoming = (await listShowings()).filter((s) => s.propertyId === p.id && s.status === "scheduled" && Date.parse(s.startsAt) > now);
  const photo = DEMO_PHOTOS[p.id];

  return (
    <>
      <Link href="/properties" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Properties
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <PropertyCover
            kind={p.kind}
            cover={p.cover}
            photo={photo}
            photoAlt={`${p.title} — sample photo`}
            className="h-80 rounded-2xl border border-border"
            artClassName="right-[8%] bottom-12 !h-[62%] opacity-90"
          >
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" aria-hidden />
            <CoverChip className="absolute top-3 left-3 py-1">
              {KIND_LABEL[p.kind]} · {p.zone}
            </CoverChip>
            <div className="absolute top-3 right-3">
              <StatusBadge status={p.status} onCover />
            </div>
            <div className="absolute inset-x-5 bottom-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold text-white drop-shadow">{p.title}</h1>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/80">
                  <MapPin className="size-4" aria-hidden /> {p.address} · {p.zone}
                </p>
              </div>
              <p className="tabular font-mono text-3xl font-semibold text-[#e3c274] drop-shadow">{money(p.price)}</p>
            </div>
          </PropertyCover>
          <p className="text-[11px] text-muted-foreground">
            {photo ? "Sample photo for the demo desk — replace it with the real listing photos." : "Illustration — listing photos appear here once they are uploaded."}
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: BedDouble, label: "Bedrooms", value: String(p.beds) },
              { icon: Bath, label: "Bathrooms", value: String(p.baths) },
              { icon: Maximize2, label: "Size", value: `${p.sqm} m²` },
              { icon: Tag, label: "Per m²", value: money(Math.round(p.price / p.sqm)) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card/80 p-3">
                <dt className="flex items-center gap-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                  <Icon className="size-3.5 text-primary" aria-hidden /> {label}
                </dt>
                <dd className="tabular mt-1 font-mono text-lg font-semibold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/90">{p.description}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Amenities">
            {p.amenities.map((a) => (
              <li key={a} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {a}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{p.status === "active" ? `On the market for ${p.daysOnMarket} days.` : `Status: ${p.status}.`}</p>
          <div className="rounded-xl border border-border bg-card/80 p-4">
            <h2 className="text-sm font-semibold text-foreground">Upcoming showings ({upcoming.length})</h2>
            {upcoming.length ? (
              <ul className="mt-2 space-y-1.5">
                {upcoming.map((s) => (
                  <li key={s.id} data-ai-id={s.id}>
                    <Link href={`/calendar/${s.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-primary">
                      <span className="text-foreground">{leadName.get(s.leadId) ?? "Unknown buyer"}</span>
                      <span className="tabular font-mono text-xs text-muted-foreground">{fmtWhen(s.startsAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">None booked. Book one from a buyer or the Calendar.</p>
            )}
          </div>
        </div>

        <section id="buyers" className="scroll-mt-6 self-start rounded-xl border border-border bg-card/80 lg:col-span-2" aria-labelledby="buyers-heading">
          <div className="border-b border-border px-5 py-4">
            <h2 id="buyers-heading" className="text-lg font-semibold text-foreground">
              Best buyers for this property
            </h2>
            <p className="text-xs text-muted-foreground">Ranked by how well the listing fits their brief</p>
          </div>
          <ul className="divide-y divide-border">
            {buyers.map(({ l, m }) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="block space-y-1 px-5 py-3.5 transition hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                      <Avatar name={l.name} size="sm" />
                      {l.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular font-mono text-xs text-muted-foreground">fit {m.fit}</span>
                      <TierBadge tier={l.buyer.tier} score={l.buyer.score} />
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{[...m.reasons.slice(0, 2), ...m.concerns.slice(0, 1)].join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border px-5 py-4">
            {fresh.length ? (
              <>
                <TonedDeskActionButton action="draft_match_alerts" targetIds={[p.id]} labels={[p.title]} variant="primary" busyLabel="Drafting…" className="w-full">
                  <BellRing className="size-4" aria-hidden /> Notify matching buyers ({fresh.length})
                </TonedDeskActionButton>
                <p className="text-[11px] text-muted-foreground">
                  Drafts a message for {fresh.map((b) => b.lead.name).join(", ")} (fit {ALERT_MIN_FIT}+, no concerns). You approve each one in Outreach; nothing is sent.
                </p>
              </>
            ) : alerts.length ? (
              <Link href="/outreach" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <BellRing className="size-4" aria-hidden /> Every strong-fit buyer already has a draft — review in Outreach
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                {p.status === "active" ? `No open buyer fits this listing at ${ALERT_MIN_FIT}+ with no concerns yet.` : "Buyer alerts are for active listings only."}
              </p>
            )}
          </div>
        </section>
      </div>

      <section id="promo" className="scroll-mt-6 rounded-xl border border-border bg-card/80 p-5" aria-labelledby="promo-heading">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="promo-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Megaphone className="size-4 text-primary" aria-hidden /> Promotion copy
            </h2>
            <p className="text-xs text-muted-foreground">
              Written only from this listing&apos;s own details — nothing added. Copy it into your portal, social account or chat; Helix doesn&apos;t publish anything.
            </p>
          </div>
        </div>
        {p.status === "active" || p.status === "draft" ? (
          <>
            {p.status === "draft" ? (
              <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                This listing is still a draft. Finish the photos and details before you promote it.
              </p>
            ) : null}
            <PromoCopy copy={listingCopy(p)} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This listing is {p.status}, so there&apos;s nothing to promote.</p>
        )}
      </section>
    </>
  );
}
