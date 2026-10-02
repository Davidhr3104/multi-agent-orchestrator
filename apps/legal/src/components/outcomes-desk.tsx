"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LegalOutcomesSummary, MatterOutcome, StoredRfp } from "@helix/core";
import { formatUsdNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

type RangeId = "30d" | "q3" | "ytd";
type StageId = "detected" | "go" | "sent" | "won";
type Pill = "all" | "won" | "lost" | "pending" | "BEAR" | "SPI";

const RANGES: { id: RangeId; label: string }[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "q3", label: "Q3 2026" },
  { id: "ytd", label: "Year to date" },
];

function effectiveOutcome(rfp: StoredRfp): MatterOutcome | null {
  const decision = rfp.partnerDecision;
  if (!decision) return null;
  if (decision.outcome) return decision.outcome;
  if (decision.verdict === "NO-GO") return "no_bid";
  return "pending";
}

function parseMoneyLoose(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || /unspecified|tbd|n\/a|not stated/i.test(text)) return null;
  const thousands = text.match(/\$?\s*([\d,.]+)\s*k\b/i);
  if (thousands) {
    const amount = parseFloat(thousands[1].replace(/,/g, "")) * 1000;
    return Number.isFinite(amount) ? amount : null;
  }
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function inRange(iso: string | undefined, range: RangeId, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  if (range === "30d") return now - t <= 30 * 86_400_000 && t <= now;
  if (range === "q3") return d.getFullYear() === 2026 && d.getMonth() >= 6 && d.getMonth() <= 8;
  return d.getFullYear() === new Date(now).getFullYear() && t <= now;
}

function rfpInRange(rfp: StoredRfp, range: RangeId, now: number): boolean {
  return inRange(rfp.createdAt, range, now) || inRange(rfp.partnerDecision?.decidedAt, range, now);
}

function previousWindow(range: RangeId, now: number): (iso: string | undefined) => boolean {
  if (range === "30d") {
    return (iso) => {
      if (!iso) return false;
      const t = Date.parse(iso);
      return !Number.isNaN(t) && now - t > 30 * 86_400_000 && now - t <= 60 * 86_400_000;
    };
  }
  if (range === "q3") {
    return (iso) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getFullYear() === 2026 && d.getMonth() >= 3 && d.getMonth() <= 5;
    };
  }
  return (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getFullYear() === new Date(now).getFullYear() - 1;
  };
}

function share(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function namedIncumbent(rfp: StoredRfp): boolean {
  return /\b(?:incumbent|versus|vs\.?|competitor)\s+[A-Z]/.test(`${rfp.body} ${rfp.title}`);
}

function seenBefore(rfp: StoredRfp, book: StoredRfp[]): boolean {
  const issuer = rfp.issuer.trim().toLowerCase();
  if (!issuer || /unspecified/i.test(issuer)) return false;
  return book.filter((row) => row.issuer.trim().toLowerCase() === issuer).length > 1;
}

function winSignals(rfp: StoredRfp, book: StoredRfp[]): string[] {
  const signals: string[] = [];
  if (rfp.tier === "hot" || rfp.tier === "warm") signals.push("Competitive price band");
  if ((rfp.method === "BEAR" || rfp.method === "SPI") && rfp.matchScore >= 60) signals.push("Technical alignment");
  if (seenBefore(rfp, book)) signals.push("Issuer already on this desk");
  return signals.length ? signals : ["No dominant success signal on the record"];
}

function lossSignals(rfp: StoredRfp): string[] {
  const signals: string[] = [];
  if (rfp.matchScore < 50 || rfp.tier === "cold") signals.push("Price / fit below the desk band");
  if (namedIncumbent(rfp)) signals.push("Incumbent named on the solicitation");
  if (!rfp.issuer || /unspecified/i.test(rfp.issuer)) signals.push("Jurisdiction or issuer not established");
  return signals.length ? signals : ["Closed without a single dominant factor on the record"];
}

function lossReason(rfp: StoredRfp): string {
  return lossSignals(rfp)[0];
}

function winReason(rfp: StoredRfp, book: StoredRfp[]): string {
  return winSignals(rfp, book)[0];
}

export function OutcomesDesk({
  initialRfps,
  initialOutcomes,
  asOf,
}: {
  initialRfps: StoredRfp[];
  initialOutcomes: LegalOutcomesSummary;
  asOf: number;
}) {
  const [rfps, setRfps] = useState(initialRfps);
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [range, setRange] = useState<RangeId>("ytd");
  const [stage, setStage] = useState<StageId | null>(null);
  const [pill, setPill] = useState<Pill>("all");
  const [issuer, setIssuer] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<StoredRfp | null>(null);
  const now = asOf;

  async function refresh() {
    const res = await fetch("/api/outcomes", { cache: "no-store" });
    const data = (await res.json()) as { rfps?: StoredRfp[]; outcomes?: LegalOutcomesSummary };
    setRfps(data.rfps ?? []);
    if (data.outcomes) setOutcomes(data.outcomes);
  }

  const scoped = useMemo(() => rfps.filter((r) => rfpInRange(r, range, now)), [rfps, range, now]);

  const funnel = useMemo(() => {
    const detected = scoped.length;
    const evaluated = scoped.filter((r) => r.partnerDecision && r.partnerDecision.verdict !== "NO-GO");
    const sent = evaluated.filter((r) => r.partnerDecision?.verdict === "GO");
    const won = scoped.filter((r) => effectiveOutcome(r) === "won");
    return [
      { id: "detected" as const, label: "RFPs detected", count: detected },
      { id: "go" as const, label: "Evaluated (Go)", count: evaluated.length },
      { id: "sent" as const, label: "Proposals advanced", count: sent.length },
      { id: "won" as const, label: "Awarded (Won)", count: won.length },
    ];
  }, [scoped]);

  const hero = useMemo(() => {
    const won = scoped.filter((r) => effectiveOutcome(r) === "won");
    const lost = scoped.filter((r) => effectiveOutcome(r) === "lost");
    const wonUsd = won.reduce((sum, r) => sum + (parseMoneyLoose(r.partnerDecision?.wonAmount) ?? parseMoneyLoose(r.partnerDecision?.bidAmount) ?? parseMoneyLoose(r.amount) ?? 0), 0);
    const hours = Math.round((scoped.length * (90 - 12)) / 60);
    const closed = won.length + lost.length;
    const rate = closed === 0 ? null : won.length / closed;
    const priorTest = previousWindow(range, now);
    const prior = rfps.filter((r) => priorTest(r.partnerDecision?.decidedAt) || priorTest(r.createdAt));
    const priorWon = prior.filter((r) => effectiveOutcome(r) === "won").length;
    const priorLost = prior.filter((r) => effectiveOutcome(r) === "lost").length;
    const priorClosed = priorWon + priorLost;
    const priorRate = priorClosed === 0 ? null : priorWon / priorClosed;
    const delta = rate != null && priorRate != null ? Math.round((rate - priorRate) * 1000) / 10 : null;
    return { wonUsd, hours: Math.round(hours), rate, delta, won: won.length, lost: lost.length };
  }, [scoped, rfps, range, now]);

  const factors = useMemo(() => {
    const won = scoped.filter((r) => effectiveOutcome(r) === "won");
    const lost = scoped.filter((r) => effectiveOutcome(r) === "lost");
    const winBuckets = ["Competitive price band", "Technical alignment", "Issuer already on this desk", "No dominant success signal on the record"];
    const lossBuckets = ["Price / fit below the desk band", "Incumbent named on the solicitation", "Jurisdiction or issuer not established", "Closed without a single dominant factor on the record"];
    return {
      win: winBuckets.map((label) => ({ label, n: won.filter((r) => winSignals(r, scoped).includes(label)).length, total: won.length })),
      loss: lossBuckets.map((label) => ({ label, n: lost.filter((r) => lossSignals(r).includes(label)).length, total: lost.length })),
    };
  }, [scoped]);

  const incumbent = useMemo(() => {
    const closed = scoped.filter((r) => effectiveOutcome(r) === "won" || effectiveOutcome(r) === "lost");
    const groups = [
      { label: "Incumbent named", test: (r: StoredRfp) => namedIncumbent(r) },
      { label: "No incumbent named", test: (r: StoredRfp) => !namedIncumbent(r) },
    ];
    return groups.map((group) => {
      const rows = closed.filter(group.test);
      const won = rows.filter((r) => effectiveOutcome(r) === "won").length;
      const lost = rows.filter((r) => effectiveOutcome(r) === "lost").length;
      return { label: group.label, won, lost, rate: won + lost === 0 ? null : won / (won + lost) };
    });
  }, [scoped]);

  const insight = useMemo(() => {
    const closed = scoped.filter((r) => effectiveOutcome(r) === "won" || effectiveOutcome(r) === "lost");
    const high = closed.filter((r) => r.matchScore >= 80);
    const low = closed.filter((r) => r.matchScore < 80);
    const highRate = high.length ? high.filter((r) => effectiveOutcome(r) === "won").length / high.length : null;
    const lowRate = low.length ? low.filter((r) => effectiveOutcome(r) === "won").length / low.length : null;
    if (highRate == null || lowRate == null || lowRate === 0) {
      return "Not enough won and lost matters in this window to claim a fit-index multiplier. The desk only counts recorded outcomes.";
    }
    const times = Math.round((highRate / lowRate) * 10) / 10;
    return `In this window, matters with a fit index of 80 or higher won ${Math.round(highRate * 100)}% of the time, versus ${Math.round(lowRate * 100)}% below 80 (${times}x). This is the closed book, not a forecast.`;
  }, [scoped]);

  const rows = useMemo(() => {
    const list = scoped.filter((rfp) => {
      if (stage === "go") return rfp.partnerDecision != null && rfp.partnerDecision.verdict !== "NO-GO";
      if (stage === "sent") return rfp.partnerDecision?.verdict === "GO";
      if (stage === "won") return effectiveOutcome(rfp) === "won";
      return true;
    });
    return list
      .filter((rfp) => {
        const outcome = effectiveOutcome(rfp);
        if (pill === "won" || pill === "lost" || pill === "pending") return outcome === pill;
        if (pill === "BEAR" || pill === "SPI") return rfp.method === pill;
        return true;
      })
      .filter((rfp) => issuer === "all" || rfp.issuer === issuer)
      .sort((a, b) => (b.partnerDecision?.decidedAt ?? b.createdAt).localeCompare(a.partnerDecision?.decidedAt ?? a.createdAt));
  }, [scoped, stage, pill, issuer]);

  const issuers = useMemo(
    () => [...new Set(scoped.map((rfp) => rfp.issuer).filter(Boolean))].sort(),
    [scoped]
  );

  async function setOutcome(id: string, outcome: MatterOutcome) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/rfps/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = (await res.json()) as { rfp?: StoredRfp; error?: string };
      if (!res.ok || !data.rfp) {
        setError(data.error ?? "Could not update outcome");
        return;
      }
      setRfps((prev) => prev.map((r) => (r.id === data.rfp!.id ? data.rfp! : r)));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5 font-sans">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Outcomes</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-[#6B7280]">
            Funnel and win/loss factors from recorded decisions in this window. Proposal “sent” is a GO verdict — the desk does not store a filing timestamp.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] transition",
                range === item.id ? "border-[#93C5FD] bg-[#1E3A8A]/40 text-[#DBEAFE]" : "border-[#1F2937] text-[#9CA3AF] hover:border-[#334155]"
              )}
            >
              {item.label}
            </button>
          ))}
          <button type="button" onClick={() => void refresh()} className="rounded-[4px] border border-[#374151] px-3 py-1 text-[11px] text-[#9CA3AF]">
            Refresh
          </button>
          <Link href="/analytics" className="text-[11px] text-[#93C5FD] hover:underline">
            Analytics
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-[4px] border border-[#7F1D1D] px-3 py-2 text-[11px] text-[#FCA5A5]">{error}</p> : null}

      <section className="grid gap-3 min-[1100px]:grid-cols-5">
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 shadow-subtle transition hover:border-blue-500/40 hover:shadow-lg min-[1100px]:col-span-3">
          <h2 className="text-[13px] font-semibold text-[#F3F4F6]">Procurement funnel</h2>
          <p className="mt-1 text-[11px] text-[#6B7280]">Click a stage to filter the table.</p>
          <div className="mt-4 flex flex-col items-center gap-1.5">
            {funnel.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setStage((current) => (current === step.id ? null : step.id))}
                className={cn(
                  "flex items-center justify-between rounded-md px-4 py-2.5 text-left transition hover:brightness-125",
                  stage === step.id ? "bg-[#1D4ED8] text-white" : "bg-[#1E293B] text-[#E5E7EB]"
                )}
                style={{ width: `${100 - index * 14}%` }}
              >
                <span className="text-[12px] font-medium">{step.label}</span>
                <span className="font-mono-numbers text-[13px] font-semibold">{step.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 min-[1100px]:col-span-2">
          <Highlight label="Win value" value={formatUsdNumber(hero.wonUsd)} />
          <Highlight label="Lawyer hours saved" value={`${hero.hours}h`} hint="Same assumption as Pricing: 90 min manual first pass, 12 min with Helix, per RFP in this window." />
          <Highlight
            label="Win rate"
            value={hero.rate == null ? "—" : `${Math.round(hero.rate * 100)}%`}
            hint={
              hero.delta == null
                ? `${hero.won} won · ${hero.lost} lost · no prior window to compare`
                : `${hero.delta > 0 ? "+" : ""}${hero.delta} pts vs prior window · desk book ${outcomes.won} won overall`
            }
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <FactorPanel title="Why we won" empty="No awarded matters in this window." rows={factors.win} tone="win" />
        <FactorPanel title="Why we lost" empty="No lost matters in this window." rows={factors.loss} tone="loss" />
      </section>

      <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 transition hover:border-[#334155]">
        <h2 className="text-[13px] font-semibold text-[#F3F4F6]">Incumbent matrix</h2>
        <p className="mt-1 text-[11px] text-[#6B7280]">Win rate when the solicitation names an incumbent versus when it does not.</p>
        <table className="mt-3 w-full text-left text-[12px]">
          <thead>
            <tr className="text-[10px] tracking-wide text-[#6B7280] uppercase">
              <th className="py-2">Situation</th>
              <th>Won</th>
              <th>Lost</th>
              <th>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {incumbent.map((row) => (
              <tr key={row.label} className="border-t border-[#1F2937]">
                <td className="py-2 text-[#E5E7EB]">{row.label}</td>
                <td className="font-mono-numbers text-[#6EE7B7]">{row.won}</td>
                <td className="font-mono-numbers text-[#FCA5A5]">{row.lost}</td>
                <td className="font-mono-numbers">{row.rate == null ? "—" : `${Math.round(row.rate * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-[#1E3A8A]/50 bg-[#0F172A] p-4">
        <h2 className="text-[13px] font-semibold text-[#DBEAFE]">AI post-mortem</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-[#CBD5E1]">{insight}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["won", "Won"],
            ["lost", "Lost"],
            ["pending", "Pending"],
            ["BEAR", "BEAR"],
            ["SPI", "SPI"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPill(id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px]",
              pill === id ? "border-white bg-white text-[#0B0F19]" : "border-[#1F2937] text-[#9CA3AF] hover:border-[#475569]"
            )}
          >
            {label}
          </button>
        ))}
        <select
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
          className="rounded-full border border-[#1F2937] bg-[#0B0F19] px-3 py-1 text-[11px] text-[#E5E7EB]"
          aria-label="Client"
        >
          <option value="all">All clients</option>
          {issuers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-x-auto rounded-xl border border-[#1F2937] bg-[#111827]">
        <table className="w-full min-w-[920px] text-left">
          <thead>
            <tr className="border-b border-[#1F2937] text-[10px] tracking-wide text-[#6B7280] uppercase">
              <th className="px-4 py-3">Matter</th>
              <th className="px-3 py-3">Fit</th>
              <th className="px-3 py-3">Outcome</th>
              <th className="px-3 py-3">Value</th>
              <th className="px-3 py-3">Compare</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#6B7280]">
                  Nothing in this window and filter.
                </td>
              </tr>
            ) : (
              rows.map((rfp) => {
                const outcome = effectiveOutcome(rfp);
                const value = parseMoneyLoose(rfp.partnerDecision?.wonAmount) ?? parseMoneyLoose(rfp.amount);
                return (
                  <tr key={rfp.id} className="border-b border-[#1F2937]/80 transition hover:bg-white/[0.03] hover:shadow-inner">
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#F3F4F6]">{rfp.title}</p>
                      <p className="mt-0.5 text-[10px] text-[#6B7280]">
                        {rfp.issuer || "Issuer unset"} · {rfp.method}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#0B0F19]">
                          <div
                            className={cn("h-full", rfp.matchScore >= 75 ? "bg-[#6EE7B7]" : rfp.matchScore >= 50 ? "bg-[#FCD34D]" : "bg-[#FCA5A5]")}
                            style={{ width: `${rfp.matchScore}%` }}
                          />
                        </div>
                        <span className="font-mono-numbers text-[11px] text-[#E5E7EB]">{rfp.matchScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <OutcomeBadge outcome={outcome} reason={outcome === "lost" ? lossReason(rfp) : outcome === "won" ? winReason(rfp, scoped) : "Still open on the desk"} />
                    </td>
                    <td className={cn("font-mono-numbers px-3 py-3 text-[12px]", outcome === "won" ? "font-bold text-[#6EE7B7]" : "text-[#D1D5DB]")}>
                      {value == null ? "—" : formatUsdNumber(value)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="rounded border border-[#334155] px-2 py-1 text-[10px] text-[#E5E7EB] hover:border-[#93C5FD]" onClick={() => setCompare(rfp)}>
                          Draft vs result
                        </button>
                        {rfp.partnerDecision && rfp.partnerDecision.verdict !== "NO-GO"
                          ? (["won", "lost", "pending"] as const).map((next) => (
                              <button
                                key={next}
                                type="button"
                                disabled={busyId === rfp.id || outcome === next}
                                onClick={() => void setOutcome(rfp.id, next)}
                                className="rounded border border-[#1F2937] px-1.5 py-1 text-[10px] text-[#9CA3AF] disabled:opacity-40"
                              >
                                {next}
                              </button>
                            ))
                          : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {compare ? (
        <CompareModal
          rfp={compare}
          signals={effectiveOutcome(compare) === "won" ? winSignals(compare, scoped) : effectiveOutcome(compare) === "lost" ? lossSignals(compare) : []}
          onClose={() => setCompare(null)}
        />
      ) : null}
    </main>
  );
}

function Highlight({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#14532D]/60 bg-[#052E16] p-4 transition hover:border-[#6EE7B7]/40 hover:shadow-lg">
      <p className="text-[10px] font-semibold tracking-wide text-[#86EFAC] uppercase">{label}</p>
      <p className="font-mono-numbers mt-1 text-[26px] font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-[#86EFAC]/80">{hint}</p> : null}
    </div>
  );
}

function FactorPanel({
  title,
  empty,
  rows,
  tone,
}: {
  title: string;
  empty: string;
  rows: { label: string; n: number; total: number }[];
  tone: "win" | "loss";
}) {
  const any = rows.some((row) => row.n > 0);
  return (
    <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 transition hover:border-[#334155]">
      <h2 className="text-[13px] font-semibold text-[#F3F4F6]">{title}</h2>
      <p className="mt-1 text-[10px] text-[#6B7280]">Share of closed matters in this window that show the signal. A matter can count in more than one row.</p>
      {!any ? <p className="mt-3 text-[12px] text-[#6B7280]">{empty}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between gap-3 text-[11px] text-[#D1D5DB]">
              <span>{row.label}</span>
              <span className="font-mono-numbers">{row.total === 0 ? "—" : `${share(row.n, row.total)}%`}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#0B0F19]">
              <div className={cn("h-full", tone === "win" ? "bg-[#6EE7B7]" : "bg-[#FCA5A5]")} style={{ width: `${share(row.n, row.total)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutcomeBadge({ outcome, reason }: { outcome: MatterOutcome | null; reason: string }) {
  const label = outcome === "won" ? "WON" : outcome === "lost" ? "LOST" : outcome === "pending" ? "PENDING" : outcome === "no_bid" ? "NO BID" : "IN REVIEW";
  return (
    <span
      title={reason}
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-semibold",
        outcome === "won" && "bg-[#064E3B] text-[#6EE7B7]",
        outcome === "lost" && "bg-[#7F1D1D]/70 text-[#FCA5A5]",
        outcome !== "won" && outcome !== "lost" && "bg-[#1E3A8A]/50 text-[#BFDBFE]"
      )}
    >
      {label}
    </span>
  );
}

function CompareModal({ rfp, signals, onClose }: { rfp: StoredRfp; signals: string[]; onClose: () => void }) {
  const outcome = effectiveOutcome(rfp);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-[#1F2937] bg-[#111827] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-widest text-[#9CA3AF] uppercase">Draft vs result</p>
            <h2 className="mt-1 text-[16px] font-semibold text-white">{rfp.title}</h2>
          </div>
          <button type="button" className="text-[12px] text-[#9CA3AF]" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-[#1F2937] p-3">
            <p className="text-[10px] text-[#9CA3AF] uppercase">What the desk scored</p>
            <p className="mt-2 text-[12px] text-[#E5E7EB]">Fit {rfp.matchScore} · {rfp.method} · {rfp.tier}</p>
            <p className="mt-1 text-[12px] text-[#9CA3AF]">Amount on the RFP: {rfp.amount}</p>
            <p className="mt-2 max-h-40 overflow-auto text-[11px] leading-relaxed text-[#9CA3AF]">{rfp.body.slice(0, 500)}</p>
          </div>
          <div className="rounded border border-[#1F2937] p-3">
            <p className="text-[10px] text-[#9CA3AF] uppercase">What was recorded</p>
            <p className="mt-2 text-[12px] text-[#E5E7EB]">
              {rfp.partnerDecision ? `${rfp.partnerDecision.verdict} by ${rfp.partnerDecision.decidedBy}` : "No partner decision"}
            </p>
            <p className="mt-1 text-[12px] text-[#E5E7EB]">Outcome: {outcome ?? "not set"}</p>
            <p className="mt-1 text-[12px] text-[#9CA3AF]">{signals.length ? signals.join(" · ") : "No closed result to compare."}</p>
            <p className="mt-2 text-[11px] text-[#6B7280]">Incumbent: {namedIncumbent(rfp) ? "named in the solicitation" : "none named"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
