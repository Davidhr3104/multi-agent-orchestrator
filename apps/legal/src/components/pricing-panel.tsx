"use client";

import { useEffect, useState } from "react";
import type { StoredRfp } from "@helix/core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PRACTICE_AREAS, type PricingQuote } from "@/lib/pricing-types";
import { formatUsdNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

function fitClass(fit: PricingQuote["vsBudget"]) {
  if (fit === "over") return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  if (fit === "under") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (fit === "at") return "border-gold-500/40 bg-gold-500/10 text-gold-300";
  return "border-white/15 text-slate-400";
}

export function PricingPanel({
  rfpId,
  rfp,
  initialQuote,
}: {
  rfpId: string;
  rfp?: StoredRfp;
  initialQuote?: PricingQuote | null;
}) {
  const [quote, setQuote] = useState<PricingQuote | null>(initialQuote ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [practiceArea, setPracticeArea] = useState<string>(initialQuote?.practiceArea ?? "Healthcare");
  const [complexity, setComplexity] = useState(String(initialQuote?.complexityScore ?? 6));
  const [hours, setHours] = useState(String(initialQuote?.estimatedHours ?? 120));

  async function load(refresh: boolean, useForm = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/rfps/${rfpId}/pricing`, {
        method: refresh ? "POST" : "GET",
        headers: refresh ? { "Content-Type": "application/json" } : undefined,
        body: refresh
          ? JSON.stringify({
              rfp,
              ...(useForm
                ? {
                    practiceArea,
                    complexityScore: Number(complexity),
                    estimatedHours: Number(hours),
                  }
                : {}),
            })
          : undefined,
      });
      const data = (await res.json()) as { quote?: PricingQuote; error?: string };
      if (!res.ok || !data.quote) throw new Error(data.error || `HTTP ${res.status}`);
      setQuote(data.quote);
      setPracticeArea(data.quote.practiceArea);
      setComplexity(String(data.quote.complexityScore));
      setHours(String(data.quote.estimatedHours));
      setError(null);
    } catch (err) {
      if (!quote && initialQuote) setQuote(initialQuote);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setQuote(initialQuote ?? null);
    setError(null);
    void load(false).then(() => void load(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the open RFP changes
  }, [rfpId]);

  if (error && !quote) {
    return (
      <Alert className="border-amber-500/30">
        <AlertTitle className="text-amber-200">Pricing fallback</AlertTitle>
        <AlertDescription>Could not reach the calculator ({error}).</AlertDescription>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void load(true, true);
          }}
        >
          {busy ? "Pricing…" : "Retry"}
        </Button>
      </Alert>
    );
  }

  if (!quote) return <p className="text-sm text-slate-400">Calculating bid…</p>;

  return (
    <div className="space-y-3">
      {quote.claudeFailed ? (
        <Alert className="border-amber-500/30">
          <AlertTitle className="text-amber-200">Claude unavailable</AlertTitle>
          <AlertDescription>Showing the historical rate-card quote. Partner should still sign off on the bid.</AlertDescription>
        </Alert>
      ) : null}
      <Card className={cn("ring-1", fitClass(quote.vsBudget))}>
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center justify-between gap-2 text-white">
            Smart price
            <Badge variant="outline" className={fitClass(quote.vsBudget)}>
              {formatUsdNumber(quote.target)}
            </Badge>
          </CardTitle>
          <CardDescription>{quote.why}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-slate-500 uppercase">Floor</p>
            <p className="font-mono text-slate-200">{formatUsdNumber(quote.floor)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 uppercase">Target</p>
            <p className="font-mono font-semibold text-gold-300">{formatUsdNumber(quote.target)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 uppercase">Ceiling</p>
            <p className="font-mono text-slate-200">{formatUsdNumber(quote.ceiling)}</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1 text-xs text-slate-400">Practice</Label>
          <Select value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)}>
            {PRACTICE_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs text-slate-400">Complexity (1–10)</Label>
          <Input value={complexity} onChange={(e) => setComplexity(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <Label className="mb-1 text-xs text-slate-400">Hours</Label>
          <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {quote.estimatedHours}h × {formatUsdNumber(quote.hourlyRate)}/hr · RFP budget{" "}
        {quote.rfpBudget != null ? formatUsdNumber(quote.rfpBudget) : "—"} · vs budget {quote.vsBudget}
        {quote.comparableTitle ? ` · comp ${quote.comparableTitle}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void load(true, true)}>
          {busy ? "Pricing…" : "Recalculate"}
        </Button>
        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>Rate card</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>How this bid was built</DialogTitle>
              <DialogDescription>
                Engine {quote.engine}
                {quote.claudeFailed ? " (heuristic fallback)" : ""} · {quote.jurisdiction}
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>Floor / target / ceiling come from {quote.practiceArea} min / avg / max hourly rates × hours.</li>
              <li>Hours scale from the closest won matter by practice area and complexity.</li>
              <li>
                Amounts always print as full USD, e.g. {formatUsdNumber(85000)} — never compact “k” notation.
              </li>
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
