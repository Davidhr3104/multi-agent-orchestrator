"use client";

import { useEffect } from "react";
import type { HowToUseShortcut } from "@helix/help";

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="helix-shortcuts-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#D4AF37]/25 bg-[#111827] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="helix-shortcuts-title" className="font-heading text-base font-semibold text-white">
              Keyboard shortcuts
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{product}</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <ul className="space-y-2">
          {shortcuts.map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">{row.action}</span>
              <kbd className="shrink-0 rounded border border-[#D4AF37]/30 bg-[#0A1628] px-2 py-0.5 font-mono text-[11px] text-[#D4AF37]">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-slate-500">Press ? anytime to reopen this panel.</p>
      </div>
    </div>
  );
}
