"use client";

import { MorphPanel } from "@helix/ui";

const QUICK_CHIPS = [
  { label: "Explain this thread's urgency", question: "Why was this thread flagged as urgent?" },
  { label: "What does needs review mean?", question: "What does 'needs review' mean in this inbox?" },
  { label: "How is sentiment detected?", question: "How does the engine detect sentiment?" },
];

export function AskAiCard({
  threadId,
  onOpenDrawer,
}: {
  threadId?: string;
  onOpenDrawer?: (initialQuestion?: string) => void;
}) {
  function openWorkspace(text?: string) {
    if (onOpenDrawer) {
      onOpenDrawer(text);
      return;
    }
    window.dispatchEvent(new CustomEvent("helix:ask", { detail: text ?? "" }));
  }

  return (
    <div className="glass-panel relative overflow-hidden rounded-xl border border-border p-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 15% 0%, rgba(26,212,196,0.18) 0%, rgba(10,125,115,0.06) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Helix AI
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0a7d73]">
              <span className="inline-block size-1.5 rounded-full bg-[#1ad4c4]" />
              Desk workspace
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {threadId ? "Ask Helix AI about this thread" : "Ask Helix AI"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {threadId
                ? "Ask why this thread was classified the way it was, grounded in its actual reasoning."
                : "Ask how triage, urgency, and routing work in this inbox."}
            </p>
          </div>

          <MorphPanel
            title="Ask Helix for Inbox"
            logoSrc="/helix-inbox-icon.png"
            avatarDesk="inbox"
            accent="#1ad4c4"
            accentInk="#042f2e"
            placeholder="Ask AI e.g. why is this thread marked urgent?"
            chips={QUICK_CHIPS}
            onAsk={(text) => openWorkspace(text)}
          />
        </div>

        <button
          type="button"
          onClick={() => openWorkspace()}
          aria-label="Open Ask Helix AI assistant"
          className="group relative mx-auto shrink-0 cursor-pointer rounded-lg transition-transform hover:scale-[1.02] lg:mx-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ask-ai/ask-ai-visual.png" alt="" className="h-44 w-auto rounded-lg object-contain" />
          <span className="absolute right-2 bottom-2 left-2 flex items-center justify-center gap-1 rounded-md bg-black/70 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-black/85">
            Ask Helix <span aria-hidden>→</span>
          </span>
        </button>
      </div>
    </div>
  );
}
