"use client";

import { FileDown } from "lucide-react";

/** Uses the browser's print dialog ("Save as PDF"); the print stylesheet drops the sidebar and buttons. */
export function PrintButton({ label = "Export PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <FileDown className="size-4" aria-hidden /> {label}
    </button>
  );
}
