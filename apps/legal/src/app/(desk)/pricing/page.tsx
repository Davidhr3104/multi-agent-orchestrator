"use client";

import { useEffect, useState } from "react";
import type { StoredRfp } from "@helix/core";
import { ChartCard, EmptyChart, HBarList } from "@helix/ui";
import { fmtUsd, Ink, INK } from "@/components/desk-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PricingBook, PricingQuote } from "@/lib/pricing-types";
import { formatIsoDate, formatUsdNumber } from "@/lib/money";
import { PricingPanel } from "@/components/pricing-panel";

export default function PricingPage() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [quotes, setQuotes] = useState<Record<string, PricingQuote>>({});
  const [book, setBook] = useState<PricingBook | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attorneys, setAttorneys] = useState(8);
  const [rfpsMonth, setRfpsMonth] = useState(12);
  const [manualMin, setManualMin] = useState(90);
  const [rate, setRate] = useState(450);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[]; pricing?: Record<string, PricingQuote> }) => {
        setRfps(d.rfps ?? []);
        setQuotes(d.pricing ?? {});
        setSelectedId((d.rfps ?? [])[0]?.id ?? null);
      });
    void fetch("/api/pricing")
      .then((r) => r.json())
      .then((d: PricingBook) => setBook(d));
  }, []);

  const selected = rfps.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="mx-auto w-full max-w-[1780px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Smart pricing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Bid floor / target / ceiling from historical matters and the practice rate card.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0f1b30] p-5">
        <h2 className="text-lg font-semibold text-white">Review-hours simulator</h2>
        <p className="mt-1 text-sm text-slate-400">
          Compares a manual first pass with Helix&apos;s 12-minute extract. It does not include partner strategy time.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-400">
            Attorneys on the desk · {attorneys}
            <input className="mt-2 w-full" type="range" min={1} max={40} value={attorneys} onChange={(e) => setAttorneys(Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-400">
            RFPs / month · {rfpsMonth}
            <input className="mt-2 w-full" type="range" min={1} max={80} value={rfpsMonth} onChange={(e) => setRfpsMonth(Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-400">
            Manual minutes / RFP · {manualMin}
            <input className="mt-2 w-full" type="range" min={20} max={240} value={manualMin} onChange={(e) => setManualMin(Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-400">
            Billable rate · {formatUsdNumber(rate)}/hr
            <input className="mt-2 w-full" type="range" min={150} max={1200} step={25} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </label>
        </div>
        <p className="mt-4 font-mono-numbers text-2xl font-semibold text-white">
          {formatUsdNumber(Math.max(0, Math.round((((manualMin - 12) * rfpsMonth) / 60) * rate)))} / month
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {Math.max(0, Math.round(((manualMin - 12) * rfpsMonth) / 60))} billable hours recovered across {attorneys}{" "}
          attorney{attorneys === 1 ? "" : "s"}, at the rate above. Partner strategy time is not included.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(book?.rules ?? []).map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <CardTitle className="text-white">{rule.practiceArea}</CardTitle>
              <CardDescription>
                {rule.jurisdiction} · avg {formatUsdNumber(rule.avgRate)}/hr
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {formatUsdNumber(rule.minRate)} – {formatUsdNumber(rule.maxRate)}
            </CardContent>
          </Card>
        ))}
      </section>

      <Ink>
        <ChartCard
          title="Proposed vs won, historical matters"
          subtitle="What the firm proposed, and what it was awarded when it won"
          demo={book?.source !== "supabase"}
          source={`Source: historical pricing book (${book?.source ?? "loading"}). Matters not won show the proposal only.`}
        >
          {(book?.historical ?? []).length === 0 ? (
            <EmptyChart label="No historical pricing yet" />
          ) : (
            <HBarList
              format={fmtUsd}
              items={(book?.historical ?? []).flatMap((h) => {
                const rows: { label: string; value: number; color: string; hint?: string }[] = [{ label: `${h.rfpTitle} · proposed`, value: h.proposedAmount, color: INK.neutral as string }];
                if (h.wonAmount != null) rows.push({ label: `${h.rfpTitle} · won`, value: h.wonAmount, color: INK.won as string, hint: h.proposedAmount > 0 ? `${Math.round(((h.wonAmount - h.proposedAmount) / h.proposedAmount) * 100)}% vs proposed` : undefined });
                return rows;
              })}
            />
          )}
        </ChartCard>
      </Ink>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="glass-card overflow-hidden rounded-2xl lg:col-span-3">
          <div className="border-b border-white/5 px-5 py-4">
            <h2 className="font-heading text-lg font-semibold text-white">Desk quotes</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RFP</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>RFP budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfps.map((rfp) => {
                const quote = quotes[rfp.id];
                const on = selectedId === rfp.id;
                return (
                  <TableRow
                    key={rfp.id}
                    className={on ? "bg-gold-500/10" : "cursor-pointer"}
                    onClick={() => setSelectedId(rfp.id)}
                  >
                    <TableCell className="text-slate-100">{rfp.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{quote?.practiceArea ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-gold-300">
                      {quote ? formatUsdNumber(quote.target) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">
                      {quote?.rfpBudget != null ? formatUsdNumber(quote.rfpBudget) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
        <section className="lg:col-span-2">
          {selected ? <PricingPanel rfpId={selected.id} /> : <p className="text-sm text-slate-400">Select an RFP.</p>}
        </section>
      </div>

      <section className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-white">Historical pricing</h2>
          <p className="text-xs text-slate-500">Source: {book?.source ?? "—"}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matter</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Proposed</TableHead>
              <TableHead>Won</TableHead>
              <TableHead>Win rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(book?.historical ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-slate-100">{row.rfpTitle}</TableCell>
                <TableCell className="font-mono text-xs text-slate-400">{formatIsoDate(row.createdAt)}</TableCell>
                <TableCell>{row.practiceArea}</TableCell>
                <TableCell>{row.estimatedHours}</TableCell>
                <TableCell className="font-mono">{formatUsdNumber(row.proposedAmount)}</TableCell>
                <TableCell className="font-mono text-emerald-300">
                  {row.wonAmount != null ? formatUsdNumber(row.wonAmount) : "—"}
                </TableCell>
                <TableCell>{row.winRate.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
