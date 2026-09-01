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
      <div className="flex h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-black/20 px-6 text-center">
        <p className="text-sm font-medium">SSE en espera</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-5">
          Cada acción llega por Server-Sent Events: timestamp, agente, campo,
          confidence y evidencia.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[360px] rounded-xl border border-white/8 bg-black/35">
      <ol className="space-y-2 p-3">
        {logs.map((log) => (
          <li
            key={log.id}
            className={cn(
              "rounded-lg border border-white/6 bg-white/3 px-2.5 py-2 font-mono text-[11px] leading-5",
              tone[log.level]
            )}
          >
            <div className="flex flex-wrap gap-x-2 text-white/45">
              <span>{new Date(log.ts).toLocaleTimeString()}</span>
              <span className="uppercase tracking-wide">{log.agent}</span>
              {log.field ? <span>campo:{log.field}</span> : null}
              {typeof log.confidence === "number" ? (
                <span>conf {log.confidence.toFixed(2)}</span>
              ) : null}
            </div>
            <p className="mt-0.5">{log.message}</p>
            {log.evidence ? (
              <p className="text-white/45 mt-0.5">evidencia: {log.evidence}</p>
            ) : null}
          </li>
        ))}
        <li ref={endRef} />
      </ol>
    </ScrollArea>
  );
}
