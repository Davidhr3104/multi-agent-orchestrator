import { cn } from "@/lib/utils";

const TONE_BY_LEVEL = {
  low: { bar: "bg-[#059669]", text: "text-[#059669]" },
  medium: { bar: "bg-amber-500", text: "text-amber-500" },
  high: { bar: "bg-[#dc2626]", text: "text-[#dc2626]" },
  critical: { bar: "bg-[#dc2626]", text: "text-[#dc2626]" },
} as const;

const LABEL_BY_LEVEL = { low: "Safe", medium: "Med", high: "High", critical: "Critical" } as const;

export function RiskScoreBar({
  score,
  level,
}: {
  score: number;
  level: "low" | "medium" | "high" | "critical";
}) {
  const t = TONE_BY_LEVEL[level];
  return (
    <div className="w-24">
      <div className={cn("mb-1 flex items-center justify-between font-mono text-[10px]", t.text)}>
        <span>{String(score).padStart(2, "0")}/100</span>
        <span className="text-[9px] font-semibold uppercase text-muted-foreground">
          {LABEL_BY_LEVEL[level]}
        </span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-black/[0.08] dark:bg-white/[0.06]">
        <div
          className={cn("h-[3px] rounded-full", t.bar)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
