"use client";

import { Icon } from "@/components/icon";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { AgentDecision, PipelineResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const decisionTone: Record<AgentDecision, string> = {
  aprobado: "bg-tertiary/15 text-tertiary border-tertiary/30",
  "requiere revisión": "bg-amber-400/15 text-amber-200 border-amber-400/30",
  bloqueado: "bg-error/15 text-error border-error/30",
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

export function ExportButtons({
  result,
  onPdfError,
}: {
  result: PipelineResult;
  onPdfError?: (message: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => downloadJson(result)}
        className="font-label-sm text-on-surface-variant hover:text-on-surface bg-surface-container border-outline-variant/30 flex items-center gap-2 rounded border px-2 py-1 text-[12px] transition-colors"
      >
        <Icon name="data_object" className="text-[14px]" /> JSON
      </button>
      <button
        type="button"
        onClick={() => {
          downloadPdf(result).catch((err) =>
            onPdfError?.(err instanceof Error ? err.message : String(err))
          );
        }}
        className="font-label-sm text-on-surface-variant hover:text-on-surface bg-surface-container border-outline-variant/30 flex items-center gap-2 rounded border px-2 py-1 text-[12px] transition-colors"
      >
        <Icon name="picture_as_pdf" className="text-[14px]" /> PDF
      </button>
    </div>
  );
}

export function ResultDashboard({ result }: { result: PipelineResult }) {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const totalSteps = result.agents.length;
  const doneSteps = result.agents.filter((a) => a.status === "done").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Tiempo Total" value={`${seconds}s`} />
        <StatCard label="Agentes Activos" value={String(result.activeAgents)} />
        <StatCard
          label="Pasos Completados"
          value={`${doneSteps} / ${totalSteps}`}
        />
        <StatCard
          label="Confianza (Avg)"
          value={`${Math.round(result.overallConfidence * 100)}%`}
          highlight
        />
      </div>

      <div className="bg-outline-variant/20 h-px w-full" />

      <div className="overflow-hidden rounded-lg border border-outline-variant/30">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container-low text-on-surface-variant text-[11px] tracking-wide uppercase">
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
                <tr key={run.agent} className="border-outline-variant/20 border-t">
                  <td className="text-on-surface px-3 py-2.5 font-medium">
                    {name}
                  </td>
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
                  <td className="font-code-md px-3 py-2.5 text-xs">
                    {run.confidence.toFixed(2)}
                  </td>
                  <td className="text-on-surface-variant px-3 py-2.5 text-xs">
                    {run.summary}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
        <Chip>min {result.thresholds.minConfidence.toFixed(2)}</Chip>
        <Chip>HITL {result.thresholds.hitlThreshold.toFixed(2)}</Chip>
        <Chip>Claude {result.claudeEnabled ? "on" : "off"}</Chip>
        <Chip>Supabase {result.supabaseEnabled ? "on" : "off"}</Chip>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded border p-3",
        highlight
          ? "border-tertiary/30 bg-surface-container"
          : "border-outline-variant/20 bg-surface-container"
      )}
    >
      {highlight ? <div className="bg-tertiary/5 absolute inset-0" /> : null}
      <span
        className={cn(
          "font-label-sm relative z-10 text-[10px] uppercase tracking-wider",
          highlight ? "text-tertiary" : "text-outline"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-code-md relative z-10 mt-1 text-[20px]",
          highlight ? "text-tertiary font-bold" : "text-on-surface"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-outline-variant/30 rounded-full border px-2 py-0.5">
      {children}
    </span>
  );
}
