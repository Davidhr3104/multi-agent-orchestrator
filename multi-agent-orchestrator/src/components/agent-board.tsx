"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { AgentRun } from "@/lib/types";

const statusLabel: Record<AgentRun["status"], string> = {
  idle: "en espera",
  running: "corriendo",
  done: "listo",
  skipped: "omitido",
  blocked: "bloqueado",
};

export function AgentBoard({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {AGENT_CATALOG.map((agent) => {
        const run = runs.find((r) => r.agent === agent.id);
        const status = run?.status ?? "idle";
        return (
          <Card key={agent.id} className="shadow-none">
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{agent.name}</CardTitle>
                <Badge
                  variant={
                    status === "done"
                      ? "default"
                      : status === "running"
                        ? "secondary"
                        : status === "blocked"
                          ? "destructive"
                          : "outline"
                  }
                >
                  {statusLabel[status]}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm leading-5">{agent.role}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={Math.round((run?.confidence ?? 0) * 100)} />
              <p className="text-sm">
                {run?.summary || "Todavía no entra al grafo."}
              </p>
              {run ? (
                <p className="text-muted-foreground font-mono text-xs">
                  conf {run.confidence.toFixed(2)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
