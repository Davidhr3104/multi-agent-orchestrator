"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type SplitTone = "money" | "rule" | "penalty" | "neutral";

export type SplitField = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  quote: string;
  tone?: SplitTone;
};

function markClass(tone: SplitTone | undefined, active: boolean) {
  if (!active) return "bg-[#1b2a45] text-[#E5E7EB]";
  if (tone === "money") return "bg-[#FCD34D] text-[#0a1322]";
  if (tone === "penalty") return "bg-[#FCA5A5] text-[#450A0A]";
  if (tone === "rule") return "bg-[#93C5FD] text-[#0a1322]";
  return "bg-[#E5E7EB] text-[#0a1322]";
}

function highlight(body: string, quote: string, tone: SplitTone | undefined) {
  if (!quote) return body;
  const at = body.toLowerCase().indexOf(quote.toLowerCase().slice(0, 120));
  if (at < 0) return body;
  const end = Math.min(body.length, at + Math.min(quote.length, 120));
  return (
    <>
      {body.slice(0, at)}
      <mark id="split-hit" className={cn("rounded px-0.5", markClass(tone, true))}>
        {body.slice(at, end)}
      </mark>
      {body.slice(end)}
    </>
  );
}

export function DocumentSplit({
  title,
  body,
  fields,
  initialQuote,
}: {
  title: string;
  body: string;
  fields: SplitField[];
  initialQuote?: string | null;
}) {
  const seeded = fields.find((f) => initialQuote && f.quote && initialQuote.toLowerCase().includes(f.quote.toLowerCase().slice(0, 24)));
  const [active, setActive] = useState(seeded?.id ?? fields[0]?.id ?? "");
  const [pin, setPin] = useState(initialQuote?.trim() ?? "");
  const field = fields.find((f) => f.id === active) ?? fields[0];
  const needle = pin || field?.quote || "";
  const shown = useMemo(() => body.slice(0, 6000), [body]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="min-h-[220px] rounded-[6px] border border-[#1b2a45] bg-[#0a1322] p-3">
        <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">Source text · clause highlights</p>
        <p className="mt-1 text-[10px] text-[#6B7280]">
          {title}. Gold is financial, blue is regulatory, red is penalty. The original PDF file is not stored, so this is the extracted text.
        </p>
        <div className="mt-2 flex gap-2 text-[9px]">
          <span className="rounded bg-[#FCD34D] px-1.5 py-0.5 text-[#0a1322]">Financial</span>
          <span className="rounded bg-[#93C5FD] px-1.5 py-0.5 text-[#0a1322]">Regulatory</span>
          <span className="rounded bg-[#FCA5A5] px-1.5 py-0.5 text-[#450A0A]">Penalty</span>
        </div>
        <div className="mt-2 max-h-80 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap text-[#9CA3AF]">
          {highlight(shown, needle, field?.tone)}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">Extracted fields</p>
        {fields.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "w-full rounded-[4px] border px-3 py-2 text-left",
              active === item.id ? "border-[#F59E0B] bg-[#162032]" : "border-[#1b2a45] bg-[#0a1322]"
            )}
            onClick={() => {
              setActive(item.id);
              setPin(item.quote);
              window.setTimeout(() => document.getElementById("split-hit")?.scrollIntoView({ block: "nearest" }), 0);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#F3F4F6]">{item.label}</span>
              <span className="font-mono-numbers text-[10px] text-[#FCD34D]">{item.confidence}% conf.</span>
            </div>
            <p className="mt-1 text-[12px] text-[#E5E7EB]">{item.value}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
