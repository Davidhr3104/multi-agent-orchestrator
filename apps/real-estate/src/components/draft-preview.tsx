"use client";

import { useState } from "react";
import { Clock3, Mail, MessageCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "email", label: "Email", icon: Mail, on: "bg-sky-500/15 text-sky-300 ring-sky-500/40" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, on: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" },
  { value: "sms", label: "SMS", icon: Smartphone, on: "bg-violet-500/15 text-violet-300 ring-violet-500/40" },
] as const;

/** Plain-text segments a carrier would bill: 160 characters for one, 153 each once it has to be split. */
const smsSegments = (n: number) => (n <= 160 ? 1 : Math.ceil(n / 153));

/** How the draft would read in each channel. A preview only — no account is connected, so it can't be sent from here. */
export function DraftPreview({ subject, body, to, hasPhone }: { subject: string; body: string; to: string; hasPhone: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("email");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Preview as" className="inline-flex gap-1 rounded-lg border border-border bg-background/60 p-0.5">
          {TABS.map(({ value, label, icon: Icon, on }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ring-1 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tab === value ? on : "text-muted-foreground ring-transparent hover:text-foreground"
              )}
            >
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">Preview only — not connected</span>
      </div>
      {tab === "email" ? (
        <div role="tabpanel" className="overflow-hidden rounded-lg border border-border bg-background/50">
          <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span className="text-foreground">To:</span> {to}
            <span className="mx-2">·</span>
            <span className="font-semibold text-foreground">{subject}</span>
          </p>
          <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{body}</p>
        </div>
      ) : tab === "sms" ? (
        <div role="tabpanel" className="rounded-lg bg-slate-100 px-3 py-4 dark:bg-slate-900/70">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">{body}</div>
          <p className="tabular mt-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {body.length} characters · {smsSegments(body.length)} SMS segment{smsSegments(body.length) === 1 ? "" : "s"}
            {!hasPhone ? " · no phone number on file" : ""}
          </p>
        </div>
      ) : (
        <div
          role="tabpanel"
          className="rounded-lg border border-emerald-900/40 bg-[#0b141a] bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:14px_14px] px-3 py-4"
        >
          <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-[#e9edef] shadow-md">
            {body}
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#e9edef]/60">
              draft <Clock3 size={12} aria-hidden />
            </span>
          </div>
          {!hasPhone ? <p className="mt-3 text-center text-[11px] text-[#e9edef]/60">No phone number on file for this buyer.</p> : null}
        </div>
      )}
    </div>
  );
}
