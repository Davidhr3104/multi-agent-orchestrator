import * as React from "react";
import { cn } from "@/lib/utils";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-navy-950/80 px-2.5 text-sm text-slate-200 outline-none focus-visible:border-gold-500/60 focus-visible:ring-1 focus-visible:ring-gold-500/40",
        className
      )}
      {...props}
    />
  );
}

export { Select };
