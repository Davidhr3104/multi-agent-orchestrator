"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { AgentRun } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusLabel: Record<AgentRun["status"], string> = {
  idle: "en espera",
  running: "en curso",
  done: "listo",
  skipped: "omitido",
  blocked: "bloqueado",
};

export function AgentBoard({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {AGENT_CATALOG.map((agent) => {
        const run = runs.find((r) => r.agent === agent.id);
        const status = run?.status ?? "idle";
        return (
          <div
            key={agent.id}
            className={cn(
              "rounded-xl border border-white/8 bg-white/4 p-3 backdrop-blur-sm",
              status === "running" && "ring-1 ring-cyan-400/40"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg font-mono text-[10px] font-semibold tracking-wide",
                    status === "running" && "helix-scan bg-cyan-400/20 text-cyan-200",
                    status === "done" && "bg-emerald-400/15 text-emerald-200",
                    status === "blocked" && "bg-red-400/15 text-red-200",
                    status === "skipped" && "bg-white/8 text-white/50",
                    status === "idle" && "bg-white/8 text-white/60"
                  )}
                >
                  {agent.short}
                </span>
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-muted-foreground max-w-[16rem] text-xs leading-4">
                    {agent.role}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  status === "done"
                    ? "default"
                    : status === "blocked"
                      ? "destructive"
                      : "outline"
                }
              >
                {statusLabel[status]}
              </Badge>
            </div>
            <Progress value={Math.round((run?.confidence ?? 0) * 100)} />
            <p className="text-muted-foreground mt-2 text-xs">
              {run?.summary || "Esperando al orquestador."}
            </p>
          </div>
        );
      })}
    </div>
  );
}
