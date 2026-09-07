"use client";

import { useEffect, useState } from "react";
import type { HowToUseShortcut } from "@helix/help";
import { cn } from "@/lib/utils";

export function ShortcutsModal({
  open,
  onClose,
  shortcuts,
  product,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: HowToUseShortcut[];
  product: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="helix-shortcuts-title"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl",
          "dark:border-white/10 dark:bg-[#120A24]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="helix-shortcuts-title" className="text-base font-semibold text-foreground">
              Keyboard shortcuts
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{product}</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <ul className="space-y-2">
          {shortcuts.map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.action}</span>
              <kbd className="shrink-0 rounded border border-border bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-muted-foreground">Press ? anytime to reopen this panel.</p>
      </div>
    </div>
  );
}
