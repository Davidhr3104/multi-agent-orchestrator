"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { Columns3, Rows3, Search, Snowflake, X } from "lucide-react";
import { Avatar, money } from "@/components/bits";
import { ScoreExplain } from "@/components/score-explain";
import { INTENT_LABEL, INTENTS, intentFor, type Intent } from "@/lib/intent";
import { contactRecency } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ScoredLead } from "@/lib/store";
import { LEAD_STAGES, type Financing, type LeadStage, type Tier } from "@/lib/types";

const FIN: Record<Financing, string> = { cash: "Cash", preapproved: "Pre-approved", needs_financing: "Needs financing", unknown: "Unknown" };
const STAGE_LABEL: Record<LeadStage, string> = { new: "New", contacted: "Contacted", visit: "Visit", offer: "Offer", closed: "Closed", archived: "Archived" };
const BOARD: LeadStage[] = ["new", "contacted", "visit", "offer", "closed"];
const INTENT_TONE: Record<Intent, string> = {
  investor: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
  end_buyer: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  tenant: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  unclear: "bg-muted text-muted-foreground ring-border",
};

function IntentChip({ lead }: { lead: ScoredLead }) {
  const { intent, why } = intentFor(lead);
  return (
    <span title={why} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", INTENT_TONE[intent])}>
      {INTENT_LABEL[intent]}
    </span>
  );
}

type Filters = {
  q: string;
  tier: Tier | "";
  zone: string;
  stage: LeadStage | "open" | "";
  financing: Financing | "";
  intent: Intent | "";
  min: string;
  max: string;
  cold: boolean;
  view: "table" | "pipeline";
};

const DEFAULTS: Filters = { q: "", tier: "", zone: "", stage: "open", financing: "", intent: "", min: "", max: "", cold: false, view: "table" };

/** Facets typed into the search box: zone:riverside stage:visit tier:hot intent:investor fin:cash <500k >300k */
type Facets = { text: string; zone?: string; stage?: LeadStage; tier?: Tier; intent?: Intent; financing?: Financing; min?: number; max?: number; tokens: string[] };

const amount = (s: string) => {
  const m = /^\$?(\d+(?:\.\d+)?)(k|m)?$/i.exec(s);
  if (!m) return undefined;
  return Math.round(Number(m[1]) * (m[2]?.toLowerCase() === "m" ? 1_000_000 : m[2] ? 1_000 : 1));
};

function parseFacets(q: string): Facets {
  const out: Facets = { text: "", tokens: [] };
  const free: string[] = [];
  for (const raw of q.trim().split(/\s+/).filter(Boolean)) {
    const t = raw.toLowerCase();
    const kv = /^(zone|stage|tier|intent|fin|financing):(.+)$/.exec(t);
    const cmp = /^(?:budget)?([<>])(.+)$/.exec(t);
    if (kv) {
      const [, k, v] = kv;
      if (k === "zone") out.zone = v;
      else if (k === "stage" && LEAD_STAGES.includes(v as LeadStage)) out.stage = v as LeadStage;
      else if (k === "tier" && ["hot", "warm", "cold"].includes(v)) out.tier = v as Tier;
      else if (k === "intent") out.intent = INTENTS.find((i) => i.startsWith(v.replace("-", "_")) || INTENT_LABEL[i].toLowerCase().startsWith(v));
      else if (k === "fin" || k === "financing") out.financing = (Object.keys(FIN) as Financing[]).find((f) => f.startsWith(v) || FIN[f].toLowerCase().startsWith(v));
      out.tokens.push(raw);
    } else if (cmp && amount(cmp[2]) !== undefined) {
      if (cmp[1] === "<") out.max = amount(cmp[2]);
      else out.min = amount(cmp[2]);
      out.tokens.push(raw);
    } else free.push(raw);
  }
  out.text = free.join(" ").toLowerCase();
  return out;
}

function fromParams(sp: Record<string, string | undefined>): Filters {
  return {
    q: sp.q ?? "",
    tier: (["hot", "warm", "cold"].includes(sp.tier ?? "") ? sp.tier : "") as Filters["tier"],
    intent: (INTENTS.includes(sp.intent as Intent) ? sp.intent : "") as Filters["intent"],
    zone: sp.zone ?? "",
    stage: (sp.stage === "" || sp.stage === "all" ? "" : LEAD_STAGES.includes(sp.stage as LeadStage) ? sp.stage : "open") as Filters["stage"],
    financing: (sp.financing && sp.financing in FIN ? sp.financing : "") as Filters["financing"],
    min: sp.min ?? "",
    max: sp.max ?? "",
    cold: sp.cold === "1",
    view: sp.view === "pipeline" ? "pipeline" : "table",
  };
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.tier) p.set("tier", f.tier);
  if (f.zone) p.set("zone", f.zone);
  if (f.stage !== "open") p.set("stage", f.stage || "all");
  if (f.financing) p.set("financing", f.financing);
  if (f.intent) p.set("intent", f.intent);
  if (f.min) p.set("min", f.min);
  if (f.max) p.set("max", f.max);
  if (f.cold) p.set("cold", "1");
  if (f.view !== "table") p.set("view", f.view);
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function moveStage(lead: ScoredLead, stage: LeadStage): Promise<string | null> {
  if ((stage === "closed" || stage === "archived") && !window.confirm(`Mark ${lead.name} as ${stage}? They'll drop out of matches and outreach. You can undo from Helix AI.`)) return null;
  const res = await fetch("/api/ask-ai/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "move_stage", targetIds: [lead.id], labels: [lead.name], params: { stage } }),
  });
  const body = (await res.json().catch(() => null)) as { error?: string; done?: string[]; failed?: { error: string }[]; resultText?: string } | null;
  if (!res.ok) return body?.error ?? `Request failed (${res.status})`;
  if (!body?.done?.length) return body?.failed?.[0]?.error ?? "Nothing changed.";
  window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message: body.resultText ?? "Moved.", ids: [lead.id] } }));
  window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
  return null;
}

const field = "h-10 rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LeadsWorkspace({ leads, coldIds, initial, now }: { leads: ScoredLead[]; coldIds: string[]; initial: Record<string, string | undefined>; now: number }) {
  const [f, setF] = useState<Filters>(() => fromParams(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);
  const cold = useMemo(() => new Set(coldIds), [coldIds]);
  const zones = useMemo(() => [...new Set(leads.flatMap((l) => l.zones))].sort(), [leads]);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${toQuery(f)}`);
  }, [f]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const facets = useMemo(() => parseFacets(f.q), [f.q]);

  const { shown, boardLeads } = useMemo(() => {
    const q = facets.text;
    const min = Math.max(Number(f.min) || 0, facets.min ?? 0);
    const max = Math.min(Number(f.max) || Infinity, facets.max ?? Infinity);
    const zoneHas = (l: ScoredLead, z: string) => l.zones.some((x) => x.toLowerCase().startsWith(z.toLowerCase()));
    const base = leads.filter(
      (l) =>
        (!q || `${l.name} ${l.email} ${l.message} ${l.source}`.toLowerCase().includes(q)) &&
        (!f.tier || l.buyer.tier === f.tier) &&
        (!facets.tier || l.buyer.tier === facets.tier) &&
        (!f.zone || l.zones.includes(f.zone)) &&
        (!facets.zone || zoneHas(l, facets.zone)) &&
        (!f.financing || l.financing === f.financing) &&
        (!facets.financing || l.financing === facets.financing) &&
        (!f.intent || intentFor(l).intent === f.intent) &&
        (!facets.intent || intentFor(l).intent === facets.intent) &&
        (!facets.stage || l.stage === facets.stage) &&
        l.budget >= min &&
        l.budget <= max &&
        (!f.cold || cold.has(l.id))
    );
    const isOpen = (l: ScoredLead) => l.stage !== "closed" && l.stage !== "archived";
    const byStage = (l: ScoredLead) => facets.stage !== undefined || f.stage === "" || (f.stage === "open" ? isOpen(l) : l.stage === f.stage);
    // The board is the pipeline itself, so "open stages" there still shows the Closed column.
    return { shown: base.filter(byStage), boardLeads: f.stage === "open" && !facets.stage ? base.filter((l) => l.stage !== "archived") : base.filter(byStage) };
  }, [leads, f, cold, facets]);

  const active = (Object.keys(DEFAULTS) as (keyof Filters)[]).filter((k) => k !== "view" && f[k] !== DEFAULTS[k]).length;

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...facets.tokens.map((t) => ({ key: `t-${t}`, label: t, clear: () => set("q", f.q.split(/\s+/).filter((w) => w !== t).join(" ")) })),
    ...(f.tier ? [{ key: "tier", label: `Tier: ${f.tier}`, clear: () => set("tier", "") }] : []),
    ...(f.zone ? [{ key: "zone", label: `Zone: ${f.zone}`, clear: () => set("zone", "") }] : []),
    ...(f.stage !== "open" ? [{ key: "stage", label: f.stage ? `Stage: ${STAGE_LABEL[f.stage]}` : "All stages", clear: () => set("stage", "open") }] : []),
    ...(f.financing ? [{ key: "fin", label: FIN[f.financing], clear: () => set("financing", "") }] : []),
    ...(f.intent ? [{ key: "intent", label: INTENT_LABEL[f.intent], clear: () => set("intent", "") }] : []),
    ...(f.min ? [{ key: "min", label: `≥ ${money(Number(f.min))}`, clear: () => set("min", "") }] : []),
    ...(f.max ? [{ key: "max", label: `≤ ${money(Number(f.max))}`, clear: () => set("max", "") }] : []),
    ...(f.cold ? [{ key: "cold", label: "No contact 30+ days", clear: () => set("cold", false) }] : []),
  ];

  async function move(lead: ScoredLead, stage: LeadStage) {
    if (lead.stage === stage) return;
    setBusy(lead.id);
    setError(null);
    try {
      const err = await moveStage(lead, stage);
      if (err) setError(`${lead.name}: ${err}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: DragEvent, stage: LeadStage) {
    e.preventDefault();
    setDragOver(null);
    const lead = leads.find((l) => l.id === e.dataTransfer.getData("text/plain"));
    if (lead) void move(lead, stage);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[260px] flex-1">
            <span className="sr-only">Search buyers. Add facets like zone:riverside, stage:visit, intent:investor, fin:cash, under 500k with &lt;500k</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Search or filter: zone:riverside stage:visit intent:investor <500k"
              className={cn(field, "h-11 w-full pl-9")}
            />
          </label>
          <div role="group" aria-label="View" className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ["table", "Table", Rows3],
                ["pipeline", "Pipeline", Columns3],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={f.view === v}
                onClick={() => set("view", v)}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  f.view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tier" value={f.tier} onChange={(e) => set("tier", e.target.value as Filters["tier"])} className={field}>
            <option value="">Any tier</option>
            <option value="hot">Hot (85+)</option>
            <option value="warm">Warm (60–84)</option>
            <option value="cold">Cold (&lt;60)</option>
          </select>
          <select aria-label="Zone" value={f.zone} onChange={(e) => set("zone", e.target.value)} className={field}>
            <option value="">Any zone</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <select aria-label="Stage" value={f.stage} onChange={(e) => set("stage", e.target.value as Filters["stage"])} className={field}>
            <option value="open">Open stages</option>
            <option value="">All stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <select aria-label="Financing" value={f.financing} onChange={(e) => set("financing", e.target.value as Filters["financing"])} className={field}>
            <option value="">Any financing</option>
            {(Object.keys(FIN) as Financing[]).map((k) => (
              <option key={k} value={k}>
                {FIN[k]}
              </option>
            ))}
          </select>
          <select aria-label="Intent" value={f.intent} onChange={(e) => set("intent", e.target.value as Filters["intent"])} className={field}>
            <option value="">Any intent</option>
            {INTENTS.map((i) => (
              <option key={i} value={i}>
                {INTENT_LABEL[i]}
              </option>
            ))}
          </select>
          <input aria-label="Minimum budget" inputMode="numeric" value={f.min} onChange={(e) => set("min", e.target.value.replace(/\D/g, ""))} placeholder="Min budget" className={cn(field, "w-32")} />
          <input aria-label="Maximum budget" inputMode="numeric" value={f.max} onChange={(e) => set("max", e.target.value.replace(/\D/g, ""))} placeholder="Max budget" className={cn(field, "w-32")} />
          <button
            type="button"
            aria-pressed={f.cold}
            onClick={() => set("cold", !f.cold)}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              f.cold ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Snowflake className="size-3.5" aria-hidden /> No contact 30+ days
          </button>
          {active ? (
            <button type="button" onClick={() => setF({ ...DEFAULTS, view: f.view })} className="inline-flex h-10 cursor-pointer items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3.5" aria-hidden /> Clear {active} filter{active === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-1 text-xs text-muted-foreground" aria-live="polite">
            Showing {f.view === "pipeline" ? boardLeads.length : shown.length} of {leads.length} buyers
          </p>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              aria-label={`Remove filter ${c.label}`}
              className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[11px] font-semibold text-primary ring-1 ring-primary/25 transition hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {c.label} <X className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}

      {f.view === "table" ? (
        shown.length === 0 ? (
          <p className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">No buyers match these filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Buyer leads ranked by score</caption>
              <thead>
                <tr className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                  {["Buyer", "Score", "Intent", "Budget", "Zones", "Financing", "Stage"].map((h, i) => (
                    <th key={h} scope="col" className={cn("py-3 font-semibold", i === 0 ? "px-5" : "px-3")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((l) => (
                  <tr key={l.id} data-ai-id={l.id} className="transition hover:bg-accent/40">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={l.name} size="sm" recency={contactRecency(l.lastContactAt, now)} />
                        <span>
                          <Link href={`/leads/${l.id}`} className="font-semibold text-foreground hover:text-primary focus-visible:underline">
                            {l.name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">
                            {l.source}
                            {cold.has(l.id) ? " · no contact 30+ days" : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-3">
                        <ScoreExplain tier={l.buyer.tier} score={l.buyer.score} factors={l.buyer.factors} />
                        <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted md:block" aria-hidden>
                          <span className={`block h-full rounded-full ${l.buyer.tier === "hot" ? "bg-primary" : l.buyer.tier === "warm" ? "bg-sky-400" : "bg-slate-500"}`} style={{ width: `${l.buyer.score}%` }} />
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <IntentChip lead={l} />
                    </td>
                    <td className="tabular px-3 py-3 font-mono text-xs text-foreground">{l.budget > 0 ? money(l.budget) : "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{l.zones.join(", ") || "Any"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{FIN[l.financing]}</td>
                    <td className="px-3 py-3">
                      <select
                        aria-label={`Stage for ${l.name}`}
                        value={l.stage}
                        disabled={busy === l.id}
                        onChange={(e) => void move(l, e.target.value as LeadStage)}
                        className="h-8 cursor-pointer rounded-md border border-input bg-background/60 px-2 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                      >
                        {LEAD_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible" aria-label="Pipeline">
          {BOARD.map((stage) => {
            const col = boardLeads.filter((l) => l.stage === stage);
            const budget = col.reduce((s, l) => s + l.budget, 0);
            return (
              <section
                key={stage}
                aria-labelledby={`col-${stage}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                onDrop={(e) => onDrop(e, stage)}
                className={cn("flex min-h-64 w-64 shrink-0 snap-start flex-col rounded-xl border bg-card/60 transition lg:w-auto lg:min-w-0", dragOver === stage ? "border-primary/60 bg-primary/5" : "border-border")}
              >
                <header className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2.5">
                  <h2 id={`col-${stage}`} className="text-xs font-semibold tracking-wider text-foreground uppercase">
                    {STAGE_LABEL[stage]} <span className="text-muted-foreground">· {col.length}</span>
                  </h2>
                  <span className="tabular font-mono text-[11px] text-muted-foreground" title="Sum of buyer budgets, not a forecast">
                    {budget ? money(budget) : ""}
                  </span>
                </header>
                <ul className="flex-1 space-y-2 p-2">
                  {col.map((l) => (
                    <li
                      key={l.id}
                      data-ai-id={l.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                      className={cn("cursor-grab rounded-lg border border-border bg-background/70 p-3 active:cursor-grabbing", busy === l.id && "opacity-50")}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar name={l.name} size="sm" recency={contactRecency(l.lastContactAt, now)} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/leads/${l.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-primary">
                            {l.name}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {l.budget > 0 ? money(l.budget) : "No budget stated"} · {l.zones.join(", ") || "any zone"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <IntentChip lead={l} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ScoreExplain tier={l.buyer.tier} score={l.buyer.score} factors={l.buyer.factors} />
                        <select
                          aria-label={`Move ${l.name}`}
                          value={l.stage}
                          disabled={busy === l.id}
                          onChange={(e) => void move(l, e.target.value as LeadStage)}
                          className="h-7 cursor-pointer rounded-md border border-input bg-background/60 px-1.5 text-[11px] text-muted-foreground focus:border-primary focus:outline-none"
                        >
                          {LEAD_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s === l.stage ? STAGE_LABEL[s] : `→ ${STAGE_LABEL[s]}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      {cold.has(l.id) ? (
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-sky-300">
                          <Snowflake className="size-3" aria-hidden /> No contact 30+ days
                        </p>
                      ) : null}
                    </li>
                  ))}
                  {col.length === 0 ? <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">Drop a buyer here</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
