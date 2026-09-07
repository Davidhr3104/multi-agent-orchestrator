"use client";

import type { EmptyStateCopy } from "@helix/help";
import { cn } from "@/lib/utils";

export function EducationalEmpty({
  copy,
  className,
}: {
  copy: EmptyStateCopy;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-12 text-center", className)}>
      <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      {copy.cta ? <p className="mt-3 text-xs font-medium text-accent">{copy.cta}</p> : null}
    </div>
  );
}
