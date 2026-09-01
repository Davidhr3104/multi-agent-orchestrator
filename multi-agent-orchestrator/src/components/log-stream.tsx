"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PipelineLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<PipelineLog["level"], string> = {
  info: "text-slate-200",
  decision: "text-cyan-300",
  warn: "text-amber-300",
  error: "text-red-300",
  success: "text-emerald-300",
};

export function LogStream({ logs }: { logs: PipelineLog[] }) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (!logs.length) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-black/20 px-6 text-center">
        <p className="text-sm font-medium">Sala de control vacía</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-5">
          Cuando corras el pipeline, cada decisión del orquestador, permiso
          denegado y revisión cruzada aparece aquí con timestamp.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[320px] rounded-xl border border-white/8 bg-black/35">
      <ol className="space-y-1.5 p-3 font-mono text-[11px] leading-5">
        {logs.map((log) => (
          <li key={log.id} className={cn("flex gap-2", tone[log.level])}>
            <span className="text-white/35 shrink-0">
              {new Date(log.ts).toLocaleTimeString()}
            </span>
            <span className="w-16 shrink-0 uppercase tracking-wide text-white/50">
              {log.agent}
            </span>
            <span className="min-w-0">{log.message}</span>
          </li>
        ))}
        <li ref={endRef} />
      </ol>
    </ScrollArea>
  );
}
