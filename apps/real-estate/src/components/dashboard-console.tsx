"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { openCopilot } from "@/components/global-copilot";

const SUGGESTED = [
  "Who are my hottest buyers?",
  "Notify buyers about the Riverside loft",
  "Draft check-ins for cold buyers",
  "How is my pipeline doing?",
];

/** Dashboard entry to Helix AI. Questions open the copilot, which answers from the desk; any change it proposes waits for your click. */
export function DashboardConsole({ brief }: { brief: string[] }) {
  const [q, setQ] = useState("");
  const ask = (text: string) => {
    if (!text.trim()) return openCopilot();
    openCopilot(text);
    setQ("");
  };

  return (
    <div data-tour="re-ask" className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-xl bg-card/90 p-6 lg:col-span-7">
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-[100px]" aria-hidden />
      <div className="relative flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--gold-soft,var(--primary))] uppercase">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          AI desk assistant
        </span>
        <div>
          <h2 className="font-heading text-[32px] leading-10 font-semibold tracking-tight text-foreground">Ask Helix Real Estate AI</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Find the best buyer for a listing, see who went cold, check what needs feedback — or have Helix draft outreach. Answers come from this desk and link the
            records; anything that changes data waits for your click.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="flex flex-col items-stretch gap-2 rounded-xl bg-background p-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] sm:flex-row"
        >
          <label className="flex flex-1 items-center gap-3 px-3 py-2">
            <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="sr-only">Ask Helix</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask: “Which buyers fit Cedar Ridge Villa?” or “Who hasn’t heard from me in a month?”"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </label>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-amber-600 px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_16px_rgba(251,191,36,0.3)] transition hover:brightness-110"
          >
            Ask Helix <ArrowRight className="size-4" aria-hidden />
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Try</span>
          {SUGGESTED.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="cursor-pointer rounded bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-[var(--gold-soft,var(--primary))]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div data-tour="re-today" className="relative flex items-start gap-3 rounded-lg bg-background/80 p-4 text-sm">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-[0.16em] text-[var(--gold-soft,var(--primary))] uppercase">Desk brief</span>
            <span className="text-[10px] text-muted-foreground">Counted from this desk just now</span>
          </div>
          <ul className="mt-1 space-y-0.5 leading-relaxed text-foreground">
            {brief.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
