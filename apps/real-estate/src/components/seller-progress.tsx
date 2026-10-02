import { Check } from "lucide-react";
import { SELLER_BOARD, SELLER_STAGE_LABEL } from "@/lib/sellers";
import type { SellerStage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Prospect → Price opinion → Agreement → Listed. A lost seller shows the bar greyed out with the label spelled out. */
export function SellerProgress({ stage, size = "sm" }: { stage: SellerStage; size?: "sm" | "lg" }) {
  const lost = stage === "lost";
  const at = lost ? -1 : SELLER_BOARD.indexOf(stage);
  return (
    <div role="img" aria-label={lost ? "Lost seller" : `Step ${at + 1} of ${SELLER_BOARD.length}: ${SELLER_STAGE_LABEL[stage]}`}>
      <ol className="flex items-center gap-1" aria-hidden>
        {SELLER_BOARD.map((s, i) => {
          const finished = at === SELLER_BOARD.length - 1;
          const done = i < at || finished;
          const current = i === at && !finished;
          return (
            <li key={s} className={cn("flex items-center gap-1", i < SELLER_BOARD.length - 1 && "flex-1")}>
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full font-mono font-semibold",
                  size === "lg" ? "size-7 text-xs" : "size-4 text-[9px]",
                  done && "bg-emerald-500 text-emerald-950",
                  current && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !done && !current && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className={size === "lg" ? "size-4" : "size-2.5"} strokeWidth={3} /> : i + 1}
              </span>
              {i < SELLER_BOARD.length - 1 ? <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-emerald-500/70" : "bg-muted")} /> : null}
            </li>
          );
        })}
      </ol>
      {size === "lg" ? (
        <ol className="relative mt-2 h-4 text-[11px]" aria-hidden>
          {SELLER_BOARD.map((s, i) => {
            const last = SELLER_BOARD.length - 1;
            return (
              <li
                key={s}
                className={cn("absolute whitespace-nowrap", i === at ? "font-semibold text-foreground" : "text-muted-foreground", i > 0 && i < last && "-translate-x-1/2", i === last && "-translate-x-full")}
                style={{ left: `calc(${(i / last) * 100}% + ${i === 0 ? 0 : i === last ? 0 : 14 - (28 * i) / last}px)` }}
              >
                {SELLER_STAGE_LABEL[s]}
              </li>
            );
          })}
        </ol>
      ) : null}
      {lost ? <p className="mt-1 text-[11px] font-semibold text-slate-400">Lost</p> : null}
    </div>
  );
}
