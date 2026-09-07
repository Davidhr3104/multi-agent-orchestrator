import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ICON_TONE = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
} as const;

const STATUS_TONE = {
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
} as const;

export function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  trendBadge,
  statusBadge,
  attention = false,
  right,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: keyof typeof ICON_TONE;
  trendBadge?: string;
  statusBadge?: string;
  /** Adds a thin emerald left border for cards that need the viewer's attention. */
  attention?: boolean;
  right?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "glass-panel glass-panel-interactive cursor-pointer rounded-xl p-5",
        attention && "border-l-2 border-l-primary"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium">
          <div className={cn("rounded-md p-1.5", ICON_TONE[tone])}>{icon}</div>
          <span className="font-medium text-secondary-foreground">{label}</span>
        </div>
        {trendBadge ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            {trendBadge}
          </span>
        ) : null}
        {statusBadge ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              tone !== "primary" && STATUS_TONE[tone]
            )}
          >
            {statusBadge}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        </div>
        {right}
      </div>
    </div>
  );
}
