"use client";

import { useEffect, useState } from "react";
import type { StoredRfp } from "@helix/core";
import type { ConflictReport } from "@/lib/conflict-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function verdictClass(verdict: ConflictReport["verdict"]) {
  if (verdict === "NO-GO") return "border-rose-500/40 bg-rose-500/10 text-rose-300";
  if (verdict === "CONDITIONAL") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
}

export function ConflictPanel({
  rfpId,
  rfp,
  initialReport,
}: {
  rfpId: string;
  rfp?: StoredRfp;
  initialReport?: ConflictReport | null;
}) {
  const [report, setReport] = useState<ConflictReport | null>(initialReport ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(refresh: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/rfps/${rfpId}/conflicts`, {
        method: refresh ? "POST" : "GET",
        headers: refresh ? { "Content-Type": "application/json" } : undefined,
        body: refresh && rfp ? JSON.stringify({ rfp }) : undefined,
      });
      const data = (await res.json()) as { report?: ConflictReport; error?: string };
      if (!res.ok || !data.report) throw new Error(data.error || `HTTP ${res.status}`);
      setReport(data.report);
      setError(null);
    } catch (err) {
      // Keep any desk-level COI we already have so the tab never blanks out.
      if (!report && initialReport) setReport(initialReport);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setReport(initialReport ?? null);
    setError(null);
    void load(false).then(() => void load(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the open RFP changes
  }, [rfpId]);

  if (error && !report) {
    return (
      <Alert className="border-amber-500/30">
        <AlertTitle className="text-amber-200">Conflict engine fallback</AlertTitle>
        <AlertDescription>
          Could not reach the checker ({error}). Re-open this RFP or run a heuristic refresh.
        </AlertDescription>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void load(true);
          }}
        >
          {busy ? "Checking…" : "Retry"}
        </Button>
      </Alert>
    );
  }

  if (!report) {
    return <p className="text-sm text-slate-400">Running conflict check…</p>;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert className="border-amber-500/30">
          <AlertTitle className="text-amber-200">Live refresh failed</AlertTitle>
          <AlertDescription>
            Showing the last known COI ({error}). Retry keeps this sheet open.
          </AlertDescription>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void load(true);
            }}
          >
            {busy ? "Checking…" : "Retry"}
          </Button>
        </Alert>
      ) : null}
      {report.claudeFailed ? (
        <Alert className="border-amber-500/30">
          <AlertTitle className="text-amber-200">Claude unavailable</AlertTitle>
          <AlertDescription>
            Showing the heuristic firm-book match. Ethics partner should still clear CONDITIONAL / NO-GO hits.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className={cn("ring-1", verdictClass(report.verdict))}>
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center justify-between gap-2">
            Conflict of interest
            <Badge variant="outline" className={verdictClass(report.verdict)}>
              {report.verdict} {report.score}
            </Badge>
          </CardTitle>
          <CardDescription>{report.why}</CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="text-[11px] text-slate-500">
            Engine: {report.engine}
            {report.claudeFailed ? " (fallback)" : ""} · checked {new Date(report.checkedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Separator />
      <ScrollArea className="h-56">
        <ul className="space-y-2 pr-3">
          {report.hits.length === 0 ? (
            <li className="text-sm text-emerald-400">No matches against current/former clients or opposing parties.</li>
          ) : (
            report.hits.map((hit, i) => (
              <li
                key={`${hit.matchedName}-${i}`}
                className={cn(
                  "rounded-lg p-3 text-sm ring-1",
                  hit.severity === "red"
                    ? "bg-rose-500/10 ring-rose-500/30"
                    : "bg-amber-500/10 ring-amber-500/30"
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{hit.relation.replaceAll("_", " ")}</Badge>
                  <span className="font-medium text-slate-100">{hit.matchedName}</span>
                </div>
                <p className="text-xs text-slate-400">{hit.detail}</p>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void load(true);
        }}
      >
        {busy ? "Checking…" : "Re-run checker"}
      </Button>
    </div>
  );
}
