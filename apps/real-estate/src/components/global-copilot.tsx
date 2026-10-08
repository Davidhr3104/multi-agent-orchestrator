"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { MorphPanel } from "@helix/ui";
import { AskAiDrawer } from "@/components/ask-ai-drawer";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "helix:open-copilot";

/** Opens the one Helix AI drawer from anywhere: Ctrl/⌘+K, the sidebar button, or a page section. */
export function openCopilot(question?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { question } }));
}

export function GlobalCopilot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<string | undefined>(undefined);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInitial(undefined);
        setOpen((o) => !o);
      }
    };
    const onOpen = (e: Event) => {
      setInitial((e as CustomEvent<{ question?: string }>).detail?.question?.trim() || undefined);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  return <AskAiDrawer open={open} onOpenChange={setOpen} initialQuestion={initial} />;
}

export function AskHelixButton({ question }: { question: string }) {
  return (
    <button
      type="button"
      onClick={() => openCopilot(question)}
      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary ring-1 ring-primary/25 transition hover:bg-primary/15"
    >
      <Sparkles className="size-3.5" aria-hidden /> Ask: &ldquo;{question}&rdquo;
    </button>
  );
}

/** Top-bar search: whatever is typed goes to Helix AI, which answers from the desk and links the records. */
export function HeaderSearch() {
  return (
    <div className="w-full max-w-xl">
      <MorphPanel
        title="Ask Helix for Real Estate"
        logoSrc="/logo-icon.png"
        avatarDesk="real-estate"
        accent="#c9a24b"
        accentInk="#0f131e"
        placeholder="Ask Helix or search buyers, listings, showings…"
        chips={[
          { label: "Hottest buyers", question: "Who are the hottest buyers right now?" },
          { label: "Stale listings", question: "Which listings are going stale?" },
        ]}
        onAsk={(q) => openCopilot(q)}
      />
    </div>
  );
}

export function CopilotButton({ collapsed }: { collapsed: boolean }) {
  return (
    <button
      type="button"
      onClick={() => openCopilot()}
      title="Ask Helix AI (Ctrl+K)"
      className={cn(
        "group flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg bg-primary/10 px-3 text-sm font-medium text-foreground ring-1 ring-primary/25 transition hover:bg-primary/15 hover:ring-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        collapsed && "lg:justify-center lg:px-0"
      )}
    >
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
      <span className={cn("flex-1 text-left", collapsed && "lg:sr-only")}>Ask Helix</span>
      <kbd className={cn("hidden rounded border border-border bg-background/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground lg:inline", collapsed && "lg:hidden")}>Ctrl K</kbd>
    </button>
  );
}
