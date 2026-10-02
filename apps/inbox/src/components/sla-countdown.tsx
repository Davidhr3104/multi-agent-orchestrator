"use client";

import { useEffect, useState } from "react";
import type { EmailThread } from "@/lib/types";
import { slaClock } from "@/lib/sla";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function SlaCountdown({ thread }: { thread: EmailThread }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null) return null;
  const clock = slaClock(thread, now);
  if (!clock) return null;
  const abs = Math.abs(clock.remainingSec);
  const label = `${pad(abs / 3600)}:${pad((abs % 3600) / 60)}:${pad(abs % 60)}`;

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums",
        clock.breached
          ? "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-300"
          : clock.remainingSec <= 15 * 60
            ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      )}
    >
      SLA {clock.breached ? `over ${label}` : label}
    </span>
  );
}
