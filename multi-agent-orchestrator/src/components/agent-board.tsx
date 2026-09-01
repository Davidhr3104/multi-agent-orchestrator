"use client";

import { Icon } from "@/components/icon";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { AgentRun } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusIcon: Record<AgentRun["status"], string> = {
  idle: "hourglass_empty",
  running: "sync",
  done: "check_circle",
  skipped: "fast_forward",
  blocked: "block",
};

const statusKey: Record<AgentRun["status"], `agentBoard.status.${AgentRun["status"]}`> = {
  idle: "agentBoard.status.idle",
  running: "agentBoard.status.running",
  done: "agentBoard.status.done",
  skipped: "agentBoard.status.skipped",
  blocked: "agentBoard.status.blocked",
};

export function AgentBoard({ runs }: { runs: AgentRun[] }) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {AGENT_CATALOG.map((agent) => {
        const run = runs.find((r) => r.agent === agent.id);
        const status = run?.status ?? "idle";
        const confidence = Math.round((run?.confidence ?? 0) * 100);
        const name = t(`agent.${agent.id}.name` as const);
        const role = t(`agent.${agent.id}.role` as const);

        const isRunning = status === "running";
        const isDone = status === "done";
        const isBlocked = status === "blocked";
        const isSkipped = status === "skipped";
        const isIdle = status === "idle";

        return (
          <div
            key={agent.id}
            className={cn(
              "relative overflow-hidden rounded-lg border p-4 transition-transform duration-300",
              isRunning &&
                "border-primary/40 bg-surface-container shadow-[0_4px_24px_rgba(76,215,246,0.08)] hover:-translate-y-1",
              isDone &&
                "border-tertiary/30 bg-surface-container hover:-translate-y-1",
              isBlocked &&
                "border-error/50 bg-surface-container hover:-translate-y-1",
              isSkipped &&
                "border-outline-variant/10 bg-surface-container opacity-40 grayscale",
              isIdle &&
                "border-outline-variant/30 bg-surface-container opacity-60"
            )}
          >
            {isRunning ? (
              <div className="glow-primary absolute top-0 left-0 h-[1px] w-full bg-primary" />
            ) : null}
            {isBlocked ? (
              <div className="absolute top-0 left-0 h-[1px] w-full bg-error shadow-[0_0_8px_#ffb4ab]" />
            ) : null}

            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-label-sm rounded px-1.5 py-0.5 text-[10px] font-bold",
                    isRunning && "bg-primary text-on-primary",
                    isDone &&
                      "bg-surface-bright text-tertiary border-tertiary/50 border",
                    isBlocked && "bg-error/20 text-error border-error/30 border",
                    (isSkipped || isIdle) &&
                      "bg-surface-bright text-on-surface-variant border-outline-variant/50 border"
                  )}
                >
                  {agent.short}
                </span>
                <h4
                  className={cn(
                    "text-sm font-semibold",
                    isSkipped ? "text-outline line-through" : "text-on-surface"
                  )}
                >
                  {name}
                </h4>
              </div>
              {isRunning ? (
                <span className="relative mt-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              ) : (
                <Icon
                  name={statusIcon[status]}
                  className={cn(
                    "text-[16px]",
                    isDone && "text-tertiary",
                    isBlocked && "text-error",
                    (isSkipped || isIdle) && "text-on-surface-variant"
                  )}
                />
              )}
            </div>

            <p
              className={cn(
                "font-body-md mb-4 text-[12px] leading-4",
                isSkipped ? "text-outline line-through" : "text-on-surface-variant"
              )}
            >
              {role}
            </p>

            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className={cn(
                  "h-1 rounded-full transition-all duration-500",
                  isRunning && "bg-primary",
                  isDone && "bg-tertiary",
                  isBlocked && "bg-error",
                  (isSkipped || isIdle) && "bg-surface-bright"
                )}
                style={{ width: `${confidence}%` }}
              />
            </div>

            <div className="font-code-md flex justify-between text-[10px] text-outline">
              <span
                className={cn(
                  isBlocked && "font-bold text-error",
                  isDone && "text-tertiary"
                )}
              >
                {run?.summary || t(statusKey[status])}
              </span>
              <span>{run ? `${confidence}%` : "--"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
