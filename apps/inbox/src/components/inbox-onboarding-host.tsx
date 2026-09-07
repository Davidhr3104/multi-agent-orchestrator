"use client";

import { useCallback, useEffect, useState } from "react";
import { SHORTCUTS_INBOX, TOUR_INBOX } from "@helix/help";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import { startHelixTour } from "@/lib/product-tour";

/** First-visit tour + "?" shortcuts for Helix for Inbox */
export function InboxOnboardingHost() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const close = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    const t = window.setTimeout(() => startHelixTour("inbox", TOUR_INBOX), 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShortcutsModal
      open={shortcutsOpen}
      onClose={close}
      shortcuts={SHORTCUTS_INBOX}
      product="Helix for Inbox"
    />
  );
}
