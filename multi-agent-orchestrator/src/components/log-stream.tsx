"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PipelineLog } from "@/lib/types";

const tone: Record<PipelineLog["level"], string> = {
  info: "text-foreground",
  decision: "text-blue-700 dark:text-blue-300",
  warn: "text-amber-700 dark:text-amber-300",
  error: "text-red-700 dark:text-red-300",
  success: "text-emerald-700 dark:text-emerald-300",
};

export function LogStream({ logs }: { logs: PipelineLog[] }) {
  if (!logs.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Los logs del orquestador aparecen aquí en tiempo real: cada decisión,
        permiso denegado y revisión cruzada.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[360px] rounded-lg border">
      <ol className="space-y-2 p-3 font-mono text-xs">
        {logs.map((log) => (
          <li key={log.id} className={tone[log.level]}>
            <span className="text-muted-foreground">
              {new Date(log.ts).toLocaleTimeString()}
            </span>{" "}
            <Badge variant="outline" className="mr-1 font-mono text-[10px]">
              {log.agent}
            </Badge>
            <span className="uppercase tracking-wide">{log.level}</span>
            {" — "}
            {log.message}
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}
