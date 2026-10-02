"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ListingCopy } from "@/lib/listing-copy";

export function PromoCopy({ copy }: { copy: ListingCopy[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyText = async (c: ListingCopy) => {
    try {
      await navigator.clipboard.writeText(c.text);
      setCopied(c.key);
      setTimeout(() => setCopied((k) => (k === c.key ? null : k)), 1800);
    } catch {
      setCopied(null);
    }
  };
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {copy.map((c) => (
        <div key={c.key} className="flex flex-col rounded-lg border border-border bg-background/40">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-foreground">{c.label}</span>
            <button
              type="button"
              onClick={() => copyText(c)}
              className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {copied === c.key ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied === c.key ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="flex-1 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line text-foreground/90">{c.text}</p>
        </div>
      ))}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
