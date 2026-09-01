"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { AgentDecision, PipelineResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Download, FileJson } from "lucide-react";

const decisionTone: Record<AgentDecision, string> = {
  aprobado: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  "requiere revisión": "bg-amber-400/15 text-amber-100 border-amber-400/30",
  bloqueado: "bg-red-400/15 text-red-200 border-red-400/30",
};

function downloadJson(result: PipelineResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `helix-${result.runId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(result: PipelineResult) {
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error("No se pudo generar el PDF.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `helix-${result.runId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultDashboard({
  result,
  onPdfError,
}: {
  result: PipelineResult;
  onPdfError?: (message: string) => void;
}) {
  const seconds = (result.durationMs / 1000).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Dashboard de corrida</p>
          <p className="text-muted-foreground font-mono text-[11px]">
            {result.runId}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadJson(result)}>
            <FileJson data-icon="inline-start" />
            JSON
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              downloadPdf(result).catch((err) =>
                onPdfError?.(err instanceof Error ? err.message : String(err))
              );
            }}
          >
            <Download data-icon="inline-start" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tiempo total" value={`${seconds}s`} />
        <Stat label="Agentes activos" value={String(result.activeAgents)} />
        <Stat
          label="Confidence promedio"
          value={`${Math.round(result.overallConfidence * 100)}%`}
        />
        <Stat
          label="Checkpoint"
          value={result.humanRequired ? "HITL" : "sin HITL"}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/30 text-[11px] tracking-wide text-white/55 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Agente</th>
              <th className="px-3 py-2 font-medium">Decisión</th>
              <th className="px-3 py-2 font-medium">Conf.</th>
              <th className="px-3 py-2 font-medium">Resumen</th>
            </tr>
          </thead>
          <tbody>
            {result.agents.map((run) => {
              const name =
                AGENT_CATALOG.find((a) => a.id === run.agent)?.name ?? run.agent;
              const decision = run.decision ?? "requiere revisión";
              return (
                <tr key={run.agent} className="border-t border-white/8">
                  <td className="px-3 py-2.5 font-medium">{name}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        decisionTone[decision]
                      )}
                    >
                      {decision}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {run.confidence.toFixed(2)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 text-xs">
                    {run.summary}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-white/55">
        <Badge variant="outline">
          min {result.thresholds.minConfidence.toFixed(2)}
        </Badge>
        <Badge variant="outline">
          HITL {result.thresholds.hitlThreshold.toFixed(2)}
        </Badge>
        <Badge variant="outline">
          Claude {result.claudeEnabled ? "on" : "off"}
        </Badge>
        <Badge variant="outline">
          Supabase {result.supabaseEnabled ? "on" : "off"}
        </Badge>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
