import { cn } from "@/lib/utils";
import type { Interest, ShowingStatus } from "@/lib/types";

const STATUS: Record<ShowingStatus, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-sky-400/10 text-sky-300 ring-sky-400/30" },
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/20 text-slate-300 ring-slate-400/40" },
  no_show: { label: "No-show", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/40" },
};

export function ShowingStatusBadge({ status, late }: { status: ShowingStatus; late?: boolean }) {
  const s = late ? { label: "Needs feedback", cls: "bg-primary/15 text-primary ring-primary/40" } : STATUS[status];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", s.cls)}>{s.label}</span>;
}

const INTEREST: Record<Interest, { label: string; cls: string }> = {
  high: { label: "High interest", cls: "text-emerald-300" },
  medium: { label: "Medium interest", cls: "text-sky-300" },
  low: { label: "Low interest", cls: "text-amber-300" },
  none: { label: "No interest", cls: "text-rose-300" },
};

export function InterestLabel({ interest }: { interest: Interest }) {
  return <span className={cn("text-xs font-semibold", INTEREST[interest].cls)}>{INTEREST[interest].label}</span>;
}
