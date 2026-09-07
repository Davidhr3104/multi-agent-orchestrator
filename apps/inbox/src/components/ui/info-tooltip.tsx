"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type InfoTooltipProps = {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  label?: string;
};

/**
 * Compact contextual help trigger for Helix desks.
 * Light/dark aware; product accent comes from surrounding theme tokens.
 */
export function InfoTooltip({
  content,
  side = "top",
  className,
  label = "More information",
}: InfoTooltipProps) {
  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={label}
          className={cn(
            "ml-1.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
            className
          )}
        >
          <Info className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
