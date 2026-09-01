"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { PipelineLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const chipTone: Record<PipelineLog["level"], string> = {
  info: "bg-surface-bright text-on-surface-variant border-outline-variant/40",
  decision: "bg-primary/10 text-primary border-primary/20",
  warn: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  error: "bg-error/10 text-error border-error/20",
  success: "bg-tertiary/10 text-tertiary border-tertiary/20",
};

const textTone: Record<PipelineLog["level"], string> = {
  info: "text-on-surface",
  decision: "text-on-surface",
  warn: "text-amber-200",
  error: "text-error",
  success: "text-on-surface",
};

export function LogStream({
  logs,
  running = false,
}: {
  logs: PipelineLog[];
  running?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="border-outline-variant/50 bg-surface-container-lowest relative flex h-[400px] flex-col rounded-lg border">
      <div className="border-outline-variant/30 bg-surface-container-low flex items-center justify-between rounded-t-lg border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                running ? "animate-ping bg-tertiary" : "bg-outline"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                running ? "bg-tertiary" : "bg-outline"
              )}
            />
          </span>
          <h3 className="font-label-sm text-on-surface text-[12px] uppercase tracking-wide">
            {t("logStream.title")}
          </h3>
        </div>
        <div className="flex gap-2 text-outline">
          <Icon name="filter_list" className="text-[16px]" />
          <Icon name="clear_all" className="text-[16px]" />
        </div>
      </div>

      {!logs.length ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-on-surface text-sm font-medium">
            {t("logStream.waitingTitle")}
          </p>
          <p className="text-on-surface-variant mt-1 max-w-sm text-xs leading-5">
            {t("logStream.waitingDesc")}
          </p>
        </div>
      ) : (
        <div className="terminal-scroll flex-1 overflow-y-auto p-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "hover:bg-surface-container/50 group flex flex-col gap-1 rounded p-2 transition-colors",
                log.level === "error" &&
                  "border-error bg-error-container/10 ml-1 border-l-2"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-code-md text-outline text-[10px]">
                  {new Date(log.ts).toLocaleTimeString(undefined, {
                    hour12: false,
                  })}
                </span>
                <span
                  className={cn(
                    "font-label-sm rounded border px-1 text-[10px]",
                    chipTone[log.level]
                  )}
                >
                  {log.agent}
                </span>
                {log.field ? (
                  <span className="font-code-md text-outline text-[10px]">
                    {t("logStream.field")}:{log.field}
                  </span>
                ) : null}
                {typeof log.confidence === "number" ? (
                  <span className="font-code-md text-outline text-[10px]">
                    {t("logStream.conf")} {log.confidence.toFixed(2)}
                  </span>
                ) : null}
              </div>
              <span
                className={cn("font-code-md text-[13px]", textTone[log.level])}
              >
                {log.message}
              </span>
              {log.evidence ? (
                <div
                  className={cn(
                    "font-code-md pl-[90px] text-[12px]",
                    log.level === "error" ? "text-error/80" : "text-on-surface-variant/70"
                  )}
                >
                  &gt; {log.evidence}
                </div>
              ) : null}
            </div>
          ))}
          {running ? (
            <div className="flex items-center gap-3 p-2 opacity-60">
              <span className="font-code-md text-outline text-[10px]">&gt;_</span>
              <span className="bg-primary h-3 w-1.5 animate-pulse" />
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
