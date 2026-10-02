import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const RIBBON_CARD = "flex flex-col justify-between gap-3 rounded-xl bg-card/80 p-4 transition hover:bg-muted";

/** Executive KPI tile: label + icon, a large figure, and a footer strip that says where the number comes from. */
export function RibbonKpi({
  label,
  icon: Icon,
  value,
  foot,
  footRight,
  valueClassName,
  iconClassName,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  foot: React.ReactNode;
  footRight?: React.ReactNode;
  valueClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className={RIBBON_CARD}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="truncate text-[10px] font-semibold tracking-[0.12em] uppercase">{label}</span>
        <Icon className={cn("size-[18px] shrink-0 text-primary", iconClassName)} aria-hidden />
      </div>
      <div>
        <p className={cn("tabular font-heading text-[32px] leading-10 font-semibold tracking-tight text-foreground", valueClassName)}>{value}</p>
        <div className="mt-2 flex min-h-7 items-center justify-between gap-2 rounded bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
          <span className="min-w-0 truncate">{foot}</span>
          {footRight ? <span className="shrink-0">{footRight}</span> : null}
        </div>
      </div>
    </div>
  );
}
