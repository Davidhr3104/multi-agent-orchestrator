"use client";

import { useState } from "react";
import { HelixAvatar } from "@helix/ui";

const PRESETS = [
  "What is pending HITL?",
  "Explain E3",
  "Show completeness",
  "Where are the duplicates?",
];

function openAsk(question?: string) {
  window.dispatchEvent(new CustomEvent("helix:open-ask", { detail: { question: question ?? "" } }));
}

export function AskAiBanner() {
  const [prompt, setPrompt] = useState("");

  function ask(text: string) {
    const next = text.trim();
    if (!next) {
      openAsk();
      return;
    }
    openAsk(next);
    setPrompt("");
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-accent/25 bg-[#0c1416] p-4 shadow-[0_4px_30px_rgba(26,212,196,0.12)] sm:p-5">
      <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/35 bg-accent/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-accent uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            Helix cognitive core · Limited Mode
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">Ask Helix Data AI</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Cite a cell, the HITL queue, or completeness. Nothing is rewritten until you approve.
          </p>
          <form
            className="mt-3 flex min-h-11 max-w-3xl items-center gap-2 rounded-xl border border-white/12 bg-black/40 px-3"
            onSubmit={(event) => {
              event.preventDefault();
              ask(prompt);
            }}
          >
            <HelixAvatar desk="data" size={36} decorative />
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              aria-label="Ask Helix Data AI"
              placeholder="e.g. What is pending HITL? or Explain E3"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
            />
            <button type="submit" className="min-h-9 shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-[#042f2e]">
              Ask Copilot
            </button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                className="min-h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 sm:min-h-0"
                onClick={() => ask(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAsk()}
          aria-label="Open Ask Helix AI assistant"
          className="group relative mx-auto shrink-0 cursor-pointer rounded-xl transition-transform hover:scale-[1.02] lg:mx-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ask-ai/ask-ai-visual.png" alt="" className="h-44 w-auto rounded-xl object-contain" />
          <span className="absolute right-2 bottom-2 left-2 flex items-center justify-center gap-1 rounded-md bg-black/70 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-black/85">
            Ask Helix <span aria-hidden>→</span>
          </span>
        </button>
      </div>
    </section>
  );
}
